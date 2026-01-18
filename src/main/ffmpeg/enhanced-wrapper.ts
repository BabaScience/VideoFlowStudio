// src/main/ffmpeg/enhanced-wrapper.ts
/**
 * EnhancedFFmpegWrapper - Frame-Accurate Video Processing
 * 
 * This module addresses the frozen frame problem by implementing:
 * 1. Keyframe-aware segment extraction
 * 2. GOP (Group of Pictures) analysis
 * 3. Smart re-encoding at cut points
 * 4. Hardware acceleration (VideoToolbox on macOS)
 * 5. Quality-preserving concatenation
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { app } from 'electron';
import fs from 'fs/promises';
import { EventEmitter } from 'events';

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
    pixelFormat: string;
    profile?: string;
    level?: number;
  };
  audio?: {
    codec: string;
    sampleRate: number;
    channels: number;
    bitRate: number;
  };
  keyframes?: KeyframeInfo[];
}

export interface KeyframeInfo {
  timestamp: number;
  frameNumber: number;
  size: number;
}

export interface GOPInfo {
  startTime: number;
  endTime: number;
  keyframeTimestamp: number;
  frameCount: number;
  duration: number;
}

export interface SegmentCut {
  start: number;
  end: number;
  requiresReencode: boolean;
  nearestKeyframeBefore?: number;
  nearestKeyframeAfter?: number;
}

export interface ProcessingQuality {
  preset: 'ultrafast' | 'veryfast' | 'fast' | 'medium' | 'slow' | 'veryslow';
  crf: number; // 0-51 for H.264/H.265 (lower = better quality)
  useHardwareAccel: boolean;
  preserveOriginalQuality: boolean;
}

const DEFAULT_QUALITY: ProcessingQuality = {
  preset: 'fast',
  crf: 18, // Visually lossless
  useHardwareAccel: true,
  preserveOriginalQuality: true,
};

export class EnhancedFFmpegWrapper extends EventEmitter {
  private ffmpegPath!: string;
  private ffprobePath!: string;
  private activeProcesses: Map<string, ChildProcess> = new Map();

  constructor() {
    super();
    this.initializePaths();
  }

  private initializePaths(): void {
    let binariesDir: string;
    
    if (app.isPackaged) {
      binariesDir = path.join(process.resourcesPath, 'binaries');
    } else {
      binariesDir = path.join(app.getAppPath(), 'binaries');
    }

    this.ffmpegPath = path.join(binariesDir, 'ffmpeg');
    this.ffprobePath = path.join(binariesDir, 'ffprobe');
  }

  getBinaryPath(): string {
    return this.ffmpegPath;
  }

  /**
   * Analyzes keyframes in a video file
   * Critical for understanding GOP structure and avoiding frozen frames
   */
  async analyzeKeyframes(videoPath: string): Promise<KeyframeInfo[]> {
    return new Promise((resolve, reject) => {
      const keyframes: KeyframeInfo[] = [];

      const args = [
        '-select_streams', 'v:0',
        '-skip_frame', 'nokey', // Only show keyframes
        '-show_frames',
        '-show_entries', 'frame=pts_time,pkt_size,coded_picture_number',
        '-of', 'csv=print_section=0',
        videoPath
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
          // Parse keyframe data
          const lines = stdout.trim().split('\n');
          let frameNumber = 0;
          
          for (const line of lines) {
            const parts = line.split(',');
            if (parts.length >= 2) {
              const timestamp = parseFloat(parts[0]);
              const size = parseInt(parts[1]) || 0;
              
              if (!isNaN(timestamp)) {
                keyframes.push({
                  timestamp,
                  frameNumber: frameNumber++,
                  size,
                });
              }
            }
          }
          
          resolve(keyframes);
        } else {
          // If keyframe analysis fails, return empty array (will use fallback)
          console.warn(`Keyframe analysis failed: ${stderr}`);
          resolve([]);
        }
      });

      ffprobe.on('error', (err) => {
        reject(new Error(`FFprobe error: ${err.message}`));
      });
    });
  }

  /**
   * Analyzes GOP (Group of Pictures) structure
   */
  async analyzeGOPStructure(videoPath: string): Promise<GOPInfo[]> {
    const keyframes = await this.analyzeKeyframes(videoPath);
    const metadata = await this.getVideoMetadata(videoPath);
    const gops: GOPInfo[] = [];

    for (let i = 0; i < keyframes.length; i++) {
      const currentKeyframe = keyframes[i];
      const nextKeyframe = keyframes[i + 1];
      
      const endTime = nextKeyframe?.timestamp || metadata.duration;
      
      gops.push({
        startTime: currentKeyframe.timestamp,
        endTime: endTime,
        keyframeTimestamp: currentKeyframe.timestamp,
        frameCount: nextKeyframe 
          ? nextKeyframe.frameNumber - currentKeyframe.frameNumber
          : Math.ceil((endTime - currentKeyframe.timestamp) * (metadata.video?.fps || 30)),
        duration: endTime - currentKeyframe.timestamp,
      });
    }

    return gops;
  }

  /**
   * Finds the nearest keyframe to a given timestamp
   */
  findNearestKeyframe(
    timestamp: number, 
    keyframes: KeyframeInfo[], 
    direction: 'before' | 'after' | 'nearest'
  ): KeyframeInfo | null {
    if (keyframes.length === 0) return null;

    if (direction === 'before') {
      // Find largest keyframe timestamp <= target
      let result: KeyframeInfo | null = null;
      for (const kf of keyframes) {
        if (kf.timestamp <= timestamp) {
          result = kf;
        } else {
          break;
        }
      }
      return result;
    }

    if (direction === 'after') {
      // Find smallest keyframe timestamp >= target
      for (const kf of keyframes) {
        if (kf.timestamp >= timestamp) {
          return kf;
        }
      }
      return keyframes[keyframes.length - 1];
    }

    // Nearest
    let nearest = keyframes[0];
    let minDiff = Math.abs(keyframes[0].timestamp - timestamp);
    
    for (const kf of keyframes) {
      const diff = Math.abs(kf.timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = kf;
      }
    }
    
    return nearest;
  }

  /**
   * Optimizes cut points to align with keyframes where possible
   */
  async optimizeCutPoints(
    videoPath: string,
    segments: Array<{ start: number; end: number }>,
    tolerance: number = 0.5 // Max adjustment in seconds
  ): Promise<SegmentCut[]> {
    const keyframes = await this.analyzeKeyframes(videoPath);
    const optimizedCuts: SegmentCut[] = [];

    for (const segment of segments) {
      const startKeyframe = this.findNearestKeyframe(segment.start, keyframes, 'nearest');
      const endKeyframe = this.findNearestKeyframe(segment.end, keyframes, 'nearest');

      let optimizedStart = segment.start;
      let optimizedEnd = segment.end;
      let requiresReencode = false;

      // Check if we can align start to a keyframe
      if (startKeyframe && Math.abs(startKeyframe.timestamp - segment.start) <= tolerance) {
        optimizedStart = startKeyframe.timestamp;
      } else {
        requiresReencode = true; // Cut doesn't align with keyframe
      }

      // Check if we can align end to a keyframe
      if (endKeyframe && Math.abs(endKeyframe.timestamp - segment.end) <= tolerance) {
        optimizedEnd = endKeyframe.timestamp;
      }

      optimizedCuts.push({
        start: optimizedStart,
        end: optimizedEnd,
        requiresReencode,
        nearestKeyframeBefore: this.findNearestKeyframe(segment.start, keyframes, 'before')?.timestamp,
        nearestKeyframeAfter: this.findNearestKeyframe(segment.end, keyframes, 'after')?.timestamp,
      });
    }

    return optimizedCuts;
  }

  /**
   * Extracts a segment with smart re-encoding to prevent frozen frames
   * This is the KEY function that fixes the frozen frame problem
   */
  async extractSegmentSmart(
    inputPath: string,
    startTime: number,
    endTime: number,
    outputPath: string,
    metadata: VideoMetadata,
    quality: ProcessingQuality = DEFAULT_QUALITY
  ): Promise<void> {
    // Determine encoder based on hardware availability and source codec
    const encoder = await this.selectOptimalEncoder(metadata, quality);
    
    // Build encoding arguments based on quality settings
    const encodingArgs = this.buildEncodingArgs(encoder, metadata, quality);

    // Use filter_complex with trim for frame-accurate cutting
    // This approach:
    // 1. Seeks to position BEFORE the start (for proper decoding)
    // 2. Uses trim filter for precise frame-level cutting
    // 3. Resets timestamps properly
    // 4. Re-encodes to create clean keyframes
    
    const seekTime = Math.max(0, startTime - 5); // Seek 5 seconds before for proper GOP decoding
    
    const args = [
      // Input seeking (fast seek to near the start point)
      '-ss', this.formatTimePrecise(seekTime),
      '-i', inputPath,
      
      // Filter complex for precise trimming
      '-filter_complex', 
      `[0:v]trim=start=${this.formatTimePrecise(startTime - seekTime)}:end=${this.formatTimePrecise(endTime - seekTime)},setpts=PTS-STARTPTS[v];` +
      (metadata.audio 
        ? `[0:a]atrim=start=${this.formatTimePrecise(startTime - seekTime)}:end=${this.formatTimePrecise(endTime - seekTime)},asetpts=PTS-STARTPTS[a]`
        : ''),
      
      // Map outputs
      '-map', '[v]',
      ...(metadata.audio ? ['-map', '[a]'] : []),
      
      // Video encoding
      ...encodingArgs.video,
      
      // Audio encoding
      ...(metadata.audio ? encodingArgs.audio : []),
      
      // Output options
      '-fflags', '+genpts',
      '-movflags', '+faststart',
      '-avoid_negative_ts', 'make_zero',
      
      // Output file
      '-y', outputPath
    ];

    await this.executeFFmpeg(args, 600000); // 10 minute timeout for long segments
  }

  /**
   * Selects the optimal encoder based on hardware and quality requirements
   */
  private async selectOptimalEncoder(
    metadata: VideoMetadata, 
    quality: ProcessingQuality
  ): Promise<{
    video: string;
    audio: string;
    hardware: boolean;
  }> {
    // Check for hardware acceleration availability
    const hasVideoToolbox = await this.checkHardwareAccel('videotoolbox');
    
    let videoEncoder = 'libx264'; // Default fallback
    let useHardware = false;

    if (quality.useHardwareAccel && hasVideoToolbox) {
      // Use VideoToolbox on macOS for hardware acceleration
      if (metadata.video?.codec === 'hevc' || metadata.video?.codec === 'h265') {
        videoEncoder = 'hevc_videotoolbox';
      } else {
        videoEncoder = 'h264_videotoolbox';
      }
      useHardware = true;
    } else {
      // Software encoding - match source codec when possible
      if (metadata.video?.codec === 'hevc' || metadata.video?.codec === 'h265') {
        videoEncoder = 'libx265';
      } else if (metadata.video?.codec === 'vp9') {
        videoEncoder = 'libvpx-vp9';
      } else {
        videoEncoder = 'libx264';
      }
    }

    return {
      video: videoEncoder,
      audio: 'aac',
      hardware: useHardware,
    };
  }

  /**
   * Checks if a hardware acceleration method is available
   */
  private async checkHardwareAccel(method: string): Promise<boolean> {
    return new Promise((resolve) => {
      const args = ['-hwaccels'];
      const ffmpeg = spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';

      ffmpeg.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffmpeg.on('close', () => {
        resolve(stdout.toLowerCase().includes(method));
      });

      ffmpeg.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!ffmpeg.killed) {
          ffmpeg.kill();
          resolve(false);
        }
      }, 5000);
    });
  }

  /**
   * Builds encoding arguments based on encoder and quality settings
   */
  private buildEncodingArgs(
    encoder: { video: string; audio: string; hardware: boolean },
    metadata: VideoMetadata,
    quality: ProcessingQuality
  ): { video: string[]; audio: string[] } {
    const videoArgs: string[] = ['-c:v', encoder.video];
    const audioArgs: string[] = ['-c:a', encoder.audio];

    // Video quality settings
    if (encoder.hardware) {
      // Hardware encoder settings (VideoToolbox)
      if (quality.preserveOriginalQuality && metadata.video?.bitRate) {
        videoArgs.push('-b:v', metadata.video.bitRate.toString());
      } else {
        // Use quality-based encoding
        videoArgs.push('-q:v', Math.round(quality.crf * 0.8).toString());
      }
      videoArgs.push('-profile:v', 'high');
    } else {
      // Software encoder settings
      videoArgs.push('-crf', quality.crf.toString());
      videoArgs.push('-preset', quality.preset);
      
      if (encoder.video === 'libx264') {
        videoArgs.push('-profile:v', 'high');
        videoArgs.push('-level:v', '4.1');
      }
    }

    // Audio quality
    const audioBitrate = metadata.audio?.bitRate || 192000;
    audioArgs.push('-b:a', Math.round(audioBitrate / 1000).toString() + 'k');
    audioArgs.push('-ar', (metadata.audio?.sampleRate || 48000).toString());

    return { video: videoArgs, audio: audioArgs };
  }

  /**
   * Concatenates segments using filter_complex for seamless joins
   * This prevents the frozen frame issue at segment boundaries
   */
  async concatenateSegmentsSmart(
    segmentPaths: string[],
    outputPath: string,
    metadata: VideoMetadata,
    quality: ProcessingQuality = DEFAULT_QUALITY
  ): Promise<void> {
    if (segmentPaths.length === 0) {
      throw new Error('No segments to concatenate');
    }

    if (segmentPaths.length === 1) {
      // Single segment - just copy it
      await fs.copyFile(segmentPaths[0], outputPath);
      return;
    }

    const encoder = await this.selectOptimalEncoder(metadata, quality);
    const encodingArgs = this.buildEncodingArgs(encoder, metadata, quality);
    const hasAudio = metadata.audio !== undefined;

    // Build input arguments
    const inputArgs: string[] = [];
    for (const segmentPath of segmentPaths) {
      inputArgs.push('-i', segmentPath);
    }

    // Build filter_complex for seamless concatenation
    const filterParts: string[] = [];
    const videoLabels: string[] = [];
    const audioLabels: string[] = [];

    for (let i = 0; i < segmentPaths.length; i++) {
      // Reset PTS for each segment to ensure smooth concatenation
      filterParts.push(`[${i}:v:0]setpts=PTS-STARTPTS[v${i}]`);
      videoLabels.push(`[v${i}]`);
      
      if (hasAudio) {
        filterParts.push(`[${i}:a:0]asetpts=PTS-STARTPTS[a${i}]`);
        audioLabels.push(`[a${i}]`);
      }
    }

    // Concatenate all segments
    const concatFilter = hasAudio
      ? `${videoLabels.join('')}${audioLabels.join('')}concat=n=${segmentPaths.length}:v=1:a=1[outv][outa]`
      : `${videoLabels.join('')}concat=n=${segmentPaths.length}:v=1:a=0[outv]`;

    filterParts.push(concatFilter);

    const args = [
      ...inputArgs,
      '-filter_complex', filterParts.join(';'),
      '-map', '[outv]',
      ...(hasAudio ? ['-map', '[outa]'] : []),
      ...encodingArgs.video,
      ...(hasAudio ? encodingArgs.audio : []),
      '-fflags', '+genpts',
      '-movflags', '+faststart',
      '-y', outputPath
    ];

    await this.executeFFmpeg(args, 1800000); // 30 minute timeout for long videos
  }

  /**
   * Single-pass processing: trim + concat in one FFmpeg command
   * Most efficient approach that completely eliminates frozen frames
   */
  async processWithSinglePassSmart(
    videoPath: string,
    keepSegments: Array<{ start: number; end: number }>,
    outputPath: string,
    metadata: VideoMetadata,
    quality: ProcessingQuality = DEFAULT_QUALITY
  ): Promise<void> {
    if (keepSegments.length === 0) {
      throw new Error('No segments to process');
    }

    // Validate and clean segments
    const validSegments = keepSegments.filter(seg => {
      const duration = seg.end - seg.start;
      return duration > 0.01 && seg.start >= 0 && seg.end <= metadata.duration;
    });

    if (validSegments.length === 0) {
      throw new Error('No valid segments after validation');
    }

    const encoder = await this.selectOptimalEncoder(metadata, quality);
    const encodingArgs = this.buildEncodingArgs(encoder, metadata, quality);
    const hasAudio = metadata.audio !== undefined;

    // Build filter_complex that trims and concatenates in single pass
    const filterParts: string[] = [];
    const concatInputs: string[] = [];

    for (let i = 0; i < validSegments.length; i++) {
      const seg = validSegments[i];
      
      // Trim video with precise timestamps
      filterParts.push(
        `[0:v:0]trim=start=${this.formatTimePrecise(seg.start)}:end=${this.formatTimePrecise(seg.end)},setpts=PTS-STARTPTS[v${i}]`
      );
      
      if (hasAudio) {
        filterParts.push(
          `[0:a:0]atrim=start=${this.formatTimePrecise(seg.start)}:end=${this.formatTimePrecise(seg.end)},asetpts=PTS-STARTPTS[a${i}]`
        );
        concatInputs.push(`[v${i}][a${i}]`);
      } else {
        concatInputs.push(`[v${i}]`);
      }
    }

    // Concatenate all trimmed segments
    const concatFilter = hasAudio
      ? `${concatInputs.join('')}concat=n=${validSegments.length}:v=1:a=1[outv][outa]`
      : `${concatInputs.join('')}concat=n=${validSegments.length}:v=1:a=0[outv]`;

    filterParts.push(concatFilter);

    const args = [
      '-i', videoPath,
      '-filter_complex', filterParts.join(';'),
      '-map', '[outv]',
      ...(hasAudio ? ['-map', '[outa]'] : []),
      ...encodingArgs.video,
      ...(hasAudio ? encodingArgs.audio : []),
      '-fflags', '+genpts',
      '-movflags', '+faststart',
      '-y', outputPath
    ];

    await this.executeFFmpeg(args, 1800000);
  }

  /**
   * Formats time with high precision (microseconds)
   */
  private formatTimePrecise(seconds: number): string {
    return seconds.toFixed(6);
  }

  /**
   * Gets comprehensive video metadata
   */
  async getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
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
            const data = JSON.parse(stdout);
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
                pixelFormat: videoStream.pix_fmt,
                profile: videoStream.profile,
                level: videoStream.level,
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

            resolve(metadata);
          } catch (error) {
            reject(new Error(`Failed to parse metadata: ${(error as Error).message}`));
          }
        } else {
          reject(new Error(`FFprobe failed: ${stderr}`));
        }
      });

      ffprobe.on('error', (err) => {
        reject(new Error(`FFprobe error: ${err.message}`));
      });
    });
  }

  private parseFps(fpsString: string): number {
    const parts = fpsString.split('/');
    if (parts.length === 2) {
      return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(fpsString);
  }

  /**
   * Executes FFmpeg command with timeout and error handling
   */
  private executeFFmpeg(args: string[], timeoutMs: number = 300000): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Executing FFmpeg: ${this.ffmpegPath} ${args.join(' ').substring(0, 200)}...`);
      
      const ffmpeg = spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      let timeoutId: NodeJS.Timeout | null = null;

      timeoutId = setTimeout(() => {
        if (!ffmpeg.killed) {
          console.warn(`FFmpeg timed out after ${timeoutMs}ms`);
          ffmpeg.kill('SIGTERM');
          setTimeout(() => {
            if (!ffmpeg.killed) {
              ffmpeg.kill('SIGKILL');
            }
          }, 5000);
        }
        reject(new Error(`FFmpeg timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
        // Emit progress events based on FFmpeg output
        this.parseAndEmitProgress(data.toString());
      });

      ffmpeg.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);
        
        if (code === 0) {
          resolve();
        } else {
          const errorMsg = stderr.substring(0, 2000);
          reject(new Error(`FFmpeg failed (code ${code}): ${errorMsg}`));
        }
      });

      ffmpeg.on('error', (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(new Error(`FFmpeg process error: ${err.message}`));
      });
    });
  }

  /**
   * Parses FFmpeg output and emits progress events
   */
  private parseAndEmitProgress(output: string): void {
    // Parse time progress from FFmpeg output
    const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}.\d+)/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const seconds = parseFloat(timeMatch[3]);
      const currentTime = hours * 3600 + minutes * 60 + seconds;
      
      this.emit('progress', { currentTime });
    }

    // Parse frame count
    const frameMatch = output.match(/frame=\s*(\d+)/);
    if (frameMatch) {
      this.emit('frame', { frame: parseInt(frameMatch[1]) });
    }
  }

  /**
   * Cancels an active FFmpeg process
   */
  cancelProcess(processId: string): boolean {
    const process = this.activeProcesses.get(processId);
    if (process && !process.killed) {
      process.kill('SIGTERM');
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 2000);
      this.activeProcesses.delete(processId);
      return true;
    }
    return false;
  }
}

export default EnhancedFFmpegWrapper;
