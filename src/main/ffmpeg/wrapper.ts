// src/main/ffmpeg/wrapper.ts
import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import fs from 'fs/promises';

export interface VideoMetadata {
  duration: number;
  format: {
    formatName: string;
    formatLongName: string;
    size: number;
    bitRate: number;
  };
  video?: {
    codec: string;
    width: number;
    height: number;
    fps: number;
    bitRate: number;
  };
  audio?: {
    codec: string;
    sampleRate: number;
    channels: number;
    bitRate: number;
  };
}

export class FFmpegWrapper {
  private ffmpegPath: string;
  private ffprobePath: string;

  constructor() {
    let binariesDir: string;
    
    if (app.isPackaged) {
      // In production, binaries are in extraResources
      binariesDir = path.join(process.resourcesPath, 'binaries');
    } else {
      // In development, binaries should be in project root/binaries
      binariesDir = path.join(app.getAppPath(), 'binaries');
    }

    this.ffmpegPath = path.join(binariesDir, 'ffmpeg');
    this.ffprobePath = path.join(binariesDir, 'ffprobe');
  }

  getBinaryPath(): string {
    return this.ffmpegPath;
  }

  async getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        videoPath,
      ];

      const ffprobe = spawn(this.ffprobePath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const metadata = this.parseFFprobeOutput(stdout);
            resolve(metadata);
          } catch (error) {
            reject(new Error(`Failed to parse metadata: ${(error as Error).message}`));
          }
        } else {
          reject(new Error(`FFprobe failed: ${stderr}`));
        }
      });

      ffprobe.on('error', (err) => {
        reject(new Error(`FFprobe process error: ${err.message}`));
      });
    });
  }

  private parseFFprobeOutput(jsonOutput: string): VideoMetadata {
    const data = JSON.parse(jsonOutput);

    const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
    const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');

    const metadata: VideoMetadata = {
      duration: parseFloat(data.format.duration),
      format: {
        formatName: data.format.format_name,
        formatLongName: data.format.format_long_name,
        size: parseInt(data.format.size),
        bitRate: parseInt(data.format.bit_rate),
      },
    };

    if (videoStream) {
      metadata.video = {
        codec: videoStream.codec_name,
        width: videoStream.width,
        height: videoStream.height,
        fps: this.parseFps(videoStream.r_frame_rate),
        bitRate: parseInt(videoStream.bit_rate || '0'),
      };
    }

    if (audioStream) {
      metadata.audio = {
        codec: audioStream.codec_name,
        sampleRate: parseInt(audioStream.sample_rate),
        channels: audioStream.channels,
        bitRate: parseInt(audioStream.bit_rate || '0'),
      };
    }

    return metadata;
  }

  private parseFps(fpsString: string): number {
    const parts = fpsString.split('/');
    if (parts.length === 2) {
      return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(fpsString);
  }

  async getVideoCodecInfo(videoPath: string): Promise<{
    videoCodec: string;
    audioCodec: string;
    videoBitrate?: number;
    audioBitrate?: number;
    pixelFormat?: string;
  }> {
    const metadata = await this.getVideoMetadata(videoPath);
    
    return {
      videoCodec: metadata.video?.codec || 'unknown',
      audioCodec: metadata.audio?.codec || 'unknown',
      videoBitrate: metadata.video?.bitRate || undefined,
      audioBitrate: metadata.audio?.bitRate || undefined,
      pixelFormat: undefined, // Would need additional ffprobe query for pixel format
    };
  }

  async extractSegment(
    inputPath: string,
    startTime: number,
    endTime: number,
    outputPath: string,
    options?: { alignToKeyframe?: boolean }
  ): Promise<void> {
    const duration = endTime - startTime;

    // Move -ss before -i for more accurate seeking
    // Add -copyinkf to include non-keyframes at start (prevents blank frames)
    // Use make_zero instead of 1 for better timestamp handling
    const args = [
      '-ss',
      startTime.toString(),
      '-i',
      inputPath,
      '-t',
      duration.toString(),
      '-c',
      'copy',
      '-copyinkf',
      '-avoid_negative_ts',
      'make_zero',
      outputPath,
    ];

    await this.executeFFmpeg(args);
  }

  async concatenateVideos(
    concatFilePath: string,
    outputPath: string
  ): Promise<void> {
    const args = [
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatFilePath,
      '-c',
      'copy',
      outputPath,
    ];

    await this.executeFFmpeg(args);
  }

  async concatenateVideosWithReencode(
    segmentPaths: string[],
    outputPath: string,
    sourceMetadata?: VideoMetadata
  ): Promise<void> {
    if (segmentPaths.length === 0) {
      throw new Error('No segments to concatenate');
    }

    // Get codec info from first segment or source metadata
    const codecInfo = sourceMetadata
      ? {
          videoCodec: sourceMetadata.video?.codec || 'h264',
          audioCodec: sourceMetadata.audio?.codec || 'aac',
          videoBitrate: sourceMetadata.video?.bitRate,
          audioBitrate: sourceMetadata.audio?.bitRate,
        }
      : await this.getVideoCodecInfo(segmentPaths[0]);

    // Build input arguments for all segments
    const inputArgs: string[] = [];
    for (const segmentPath of segmentPaths) {
      inputArgs.push('-i', segmentPath);
    }

    // Check if source has audio
    const hasAudio = sourceMetadata?.audio !== undefined;
    
    // Build filter_complex for concatenation
    const numSegments = segmentPaths.length;
    const filterInputs: string[] = [];
    for (let i = 0; i < numSegments; i++) {
      filterInputs.push(`[${i}:v:0]`);
      if (hasAudio) {
        filterInputs.push(`[${i}:a:0]`);
      }
    }
    const filterComplex = hasAudio
      ? `${filterInputs.join('')}concat=n=${numSegments}:v=1:a=1[outv][outa]`
      : `${filterInputs.join('')}concat=n=${numSegments}:v=1[outv]`;

    // Determine video encoder and quality settings based on source codec
    let videoEncoder = 'libx264';
    let videoQualityArgs: string[] = [];
    const audioEncoder = codecInfo.audioCodec === 'aac' ? 'aac' : 'aac';
    const audioBitrate = codecInfo.audioBitrate || 192000; // Default to 192kbps

    // Choose encoder and quality settings based on source codec
    if (codecInfo.videoCodec === 'hevc' || codecInfo.videoCodec === 'h265') {
      videoEncoder = 'libx265';
      videoQualityArgs = ['-crf', '20', '-preset', 'slow'];
    } else if (codecInfo.videoCodec === 'vp9') {
      videoEncoder = 'libvpx-vp9';
      videoQualityArgs = ['-crf', '30', '-b:v', '0'];
    } else {
      // Default to H.264 with high quality
      videoEncoder = 'libx264';
      if (codecInfo.videoBitrate) {
        // Use bitrate-based encoding if we know the source bitrate
        videoQualityArgs = ['-b:v', codecInfo.videoBitrate.toString(), '-preset', 'slow'];
      } else {
        // Use CRF for quality-based encoding (visually lossless)
        videoQualityArgs = ['-crf', '18', '-preset', 'slow'];
      }
    }

    // Build final FFmpeg command
    const args = [
      ...inputArgs,
      '-filter_complex',
      filterComplex,
      '-map',
      '[outv]',
    ];

    // Add audio mapping and encoding only if audio exists
    if (hasAudio) {
      args.push('-map', '[outa]');
      args.push('-c:a', audioEncoder);
      args.push('-b:a', Math.round(audioBitrate / 1000).toString() + 'k');
    }

    args.push(
      '-c:v',
      videoEncoder,
      ...videoQualityArgs,
      '-fflags',
      '+genpts',
      '-movflags',
      '+faststart',
      outputPath
    );

    await this.executeFFmpeg(args);
  }

  async generateThumbnail(
    videoPath: string,
    outputPath: string,
    timestamp: number = 1
  ): Promise<void> {
    const args = [
      '-i',
      videoPath,
      '-ss',
      timestamp.toString(),
      '-vframes',
      '1',
      '-vf',
      'scale=320:-1',
      outputPath,
    ];

    await this.executeFFmpeg(args);
  }

  async extractAudioStream(
    videoPath: string,
    outputPath: string
  ): Promise<void> {
    const args = [
      '-i',
      videoPath,
      '-vn',
      '-acodec',
      'copy',
      outputPath,
    ];

    await this.executeFFmpeg(args);
  }

  async extractFrames(
    videoPath: string,
    outputDir: string,
    fps: number = 1
  ): Promise<string[]> {
    await fs.mkdir(outputDir, { recursive: true });

    const args = [
      '-i',
      videoPath,
      '-vf',
      `fps=${fps}`,
      path.join(outputDir, 'frame_%04d.png'),
    ];

    await this.executeFFmpeg(args);

    // Get list of generated frames
    const files = await fs.readdir(outputDir);
    return files
      .filter((f) => f.startsWith('frame_') && f.endsWith('.png'))
      .map((f) => path.join(outputDir, f))
      .sort();
  }

  async detectScenes(
    videoPath: string,
    threshold: number = 0.3
  ): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const sceneTimestamps: number[] = [];

      const args = [
        '-i',
        videoPath,
        '-filter:v',
        `select='gt(scene,${threshold})',showinfo`,
        '-f',
        'null',
        '-',
      ];

      const ffmpeg = spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();

        // Parse scene detection output
        const lines = data.toString().split('\n');
        lines.forEach((line: string) => {
          const match = line.match(/pts_time:([\d.]+)/);
          if (match) {
            sceneTimestamps.push(parseFloat(match[1]));
          }
        });
      });

      ffmpeg.on('close', (code) => {
        if (code === 0 || sceneTimestamps.length > 0) {
          resolve(sceneTimestamps);
        } else {
          reject(new Error(`Scene detection failed: ${stderr}`));
        }
      });

      ffmpeg.on('error', (err) => {
        reject(new Error(`FFmpeg process error: ${err.message}`));
      });
    });
  }

  private executeFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (err) => {
        reject(new Error(`FFmpeg process error: ${err.message}`));
      });
    });
  }

  sanitizePath(filePath: string): string {
    // Remove potentially dangerous characters
    return filePath.replace(/[;&|`$()]/g, '');
  }
}
