// src/main/ffmpeg/silence-detector.ts
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { FFmpegWrapper } from './wrapper';
import { ProcessingResult } from '../queue/queue-manager';

export interface SilenceDetectionConfig {
  thresholdDb: number; // -50 to -20 dB
  minDuration: number; // 0.5 to 10 seconds
  paddingBefore: number; // 0 to 1 second
  paddingAfter: number; // 0 to 1 second
  detectAudioOnly: boolean;
  safeMode?: boolean; // Re-encode segments (default: false for speed)
  minKeepDuration?: number; // Minimum keep segment duration in seconds (default: 0.3)
  useSinglePass?: boolean; // Use filter_complex single-pass (default: false)
}

export interface SilenceSegment {
  startTime: number;
  endTime: number;
  duration: number;
  decibels: number;
}

export class SilenceRemovalProcessor {
  private ffmpeg: FFmpegWrapper;
  private activeProcesses: Map<string, ChildProcess> = new Map();

  constructor() {
    this.ffmpeg = new FFmpegWrapper();
  }

  cancelProcess(jobId: string): boolean {
    const process = this.activeProcesses.get(jobId);
    if (process && !process.killed) {
      try {
        process.kill('SIGTERM');
        // Force kill after 2 seconds if still running
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 2000);
        this.activeProcesses.delete(jobId);
        console.log(`Cancelled FFmpeg process for job ${jobId}`);
        return true;
      } catch (error) {
        console.error(`Failed to kill process for job ${jobId}:`, error);
        return false;
      }
    }
    return false;
  }

  async process(
    videoPath: string,
    config: SilenceDetectionConfig,
    outputPath: string,
    progressCallback: (progress: number) => Promise<void>,
    jobId?: string
  ): Promise<ProcessingResult> {
    console.log(`Starting silence removal for: ${videoPath}`);

    // Step 1: Detect silence segments (10% progress)
    await progressCallback(10);
    const silenceSegments = await this.detectSilence(videoPath, config, jobId);

    if (silenceSegments.length === 0) {
      console.log('No silence detected, returning original video');
      await fs.copyFile(videoPath, outputPath);
      
      const metadata = await this.ffmpeg.getVideoMetadata(videoPath);
      
      return {
        originalDuration: metadata.duration,
        processedDuration: metadata.duration,
        segmentsRemoved: 0,
        timeSaved: 0,
        outputFilePath: outputPath,
      };
    }

    console.log(`Detected ${silenceSegments.length} silence segments`);

    // Step 2: Get source metadata for quality preservation (30% progress)
    await progressCallback(30);
    const sourceMetadata = await this.ffmpeg.getVideoMetadata(videoPath);
    const minKeepDuration = config.minKeepDuration || 0.3;
    let keepSegments = this.calculateKeepSegments(
      silenceSegments,
      sourceMetadata,
      minKeepDuration
    );

    // Validate segments: clamp to bounds, remove invalid, merge overlaps
    keepSegments = this.validateSegments(keepSegments, sourceMetadata.duration);

    // Debug logging: log segments with precise times
    console.log('Processing segments:', keepSegments.map(s => 
      `${s.start.toFixed(6)}s-${s.end.toFixed(6)}s (duration: ${(s.end - s.start).toFixed(6)}s)`
    ));
    const totalKeepDuration = keepSegments.reduce((sum, s) => sum + (s.end - s.start), 0);
    console.log(`Total keep duration: ${totalKeepDuration.toFixed(6)}s`);
    console.log(`Original duration: ${sourceMetadata.duration.toFixed(6)}s`);
    console.log(`Expected time saved: ${(sourceMetadata.duration - totalKeepDuration).toFixed(6)}s`);

    if (keepSegments.length === 0) {
      console.log('No segments to keep after filtering, returning original video');
      await fs.copyFile(videoPath, outputPath);
      
      return {
        originalDuration: sourceMetadata.duration,
        processedDuration: sourceMetadata.duration,
        segmentsRemoved: silenceSegments.length,
        timeSaved: 0,
        outputFilePath: outputPath,
      };
    }

    // Step 3: Process segments (50% progress)
    await progressCallback(50);
    
    if (config.useSinglePass) {
      // Single-pass approach: trim and concat in one FFmpeg command
      await this.ffmpeg.processWithSinglePass(
        videoPath,
        keepSegments,
        outputPath,
        sourceMetadata
      );
    } else {
      // Multi-step approach: extract segments then concatenate
      const tempDir = await fs.mkdtemp(path.join('/tmp', 'videoflow-'));
      const safeMode = config.safeMode || false;
      
      const segmentPaths = await this.splitVideoIntoSegments(
        videoPath,
        keepSegments,
        tempDir,
        safeMode,
        sourceMetadata
      );

      // Step 4: Concatenate segments (80% progress)
      await progressCallback(80);
      await this.concatenateSegments(segmentPaths, outputPath, sourceMetadata);
      
      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    // Step 5: Calculate results (95% progress)
    await progressCallback(95);

    const originalMetadata = await this.ffmpeg.getVideoMetadata(videoPath);
    const processedMetadata = await this.ffmpeg.getVideoMetadata(outputPath);

    const result: ProcessingResult = {
      originalDuration: originalMetadata.duration,
      processedDuration: processedMetadata.duration,
      segmentsRemoved: silenceSegments.length,
      timeSaved: originalMetadata.duration - processedMetadata.duration,
      outputFilePath: outputPath,
      metadata: {
        silenceSegments,
        keepSegments,
      },
    };

    console.log(`Silence removal complete. Saved ${result.timeSaved.toFixed(2)}s`);

    return result;
  }

  private async detectSilence(
    videoPath: string,
    config: SilenceDetectionConfig,
    jobId?: string
  ): Promise<SilenceSegment[]> {
    return new Promise((resolve, reject) => {
      const segments: SilenceSegment[] = [];
      let currentSegment: Partial<SilenceSegment> = {};
      let stderr = '';

      const ffmpegArgs = [
        '-i',
        videoPath,
        '-af',
        `silencedetect=noise=${config.thresholdDb}dB:d=${config.minDuration}`,
        '-f',
        'null',
        '-',
      ];

      const ffmpegProcess = spawn(this.ffmpeg.getBinaryPath(), ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Track process if jobId is provided
      if (jobId) {
        this.activeProcesses.set(jobId, ffmpegProcess);
      }

      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();

        // Parse silence detection output in real-time
        const lines = data.toString().split('\n');
        lines.forEach((line: string) => {
          const startMatch = line.match(/silence_start: ([\d.]+)/);
          const endMatch = line.match(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/);

          if (startMatch) {
            currentSegment = {
              startTime: parseFloat(startMatch[1]),
            };
          }

          if (endMatch && currentSegment.startTime !== undefined) {
            const endTime = parseFloat(endMatch[1]);
            // duration is available in endMatch[2] but not needed here

            // Apply padding
            const adjustedStart = Math.max(
              0,
              currentSegment.startTime - config.paddingBefore
            );
            const adjustedEnd = endTime + config.paddingAfter;

            segments.push({
              startTime: adjustedStart,
              endTime: adjustedEnd,
              duration: adjustedEnd - adjustedStart,
              decibels: config.thresholdDb,
            });

            currentSegment = {};
          }
        });
      });

      ffmpegProcess.on('close', (code) => {
        // Remove from tracking when process completes
        if (jobId) {
          this.activeProcesses.delete(jobId);
        }
        
        if (code === 0 || segments.length > 0) {
          // Merge overlapping or adjacent segments
          const mergedSegments = this.mergeAdjacentSegments(segments);
          resolve(mergedSegments);
        } else {
          reject(new Error(`FFmpeg silence detection failed: ${stderr}`));
        }
      });

      ffmpegProcess.on('error', (err) => {
        reject(new Error(`FFmpeg process error: ${err.message}`));
      });
    });
  }

  private mergeAdjacentSegments(segments: SilenceSegment[]): SilenceSegment[] {
    if (segments.length === 0) return [];

    const sorted = segments.sort((a, b) => a.startTime - b.startTime);
    const merged: SilenceSegment[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];

      // Merge if segments overlap or are within 0.5 seconds
      if (current.startTime <= last.endTime + 0.5) {
        last.endTime = Math.max(last.endTime, current.endTime);
        last.duration = last.endTime - last.startTime;
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  private validateSegments(
    segments: Array<{ start: number; end: number }>,
    videoDuration: number
  ): Array<{ start: number; end: number }> {
    const validSegments: Array<{ start: number; end: number }> = [];
    
    for (const seg of segments) {
      // Clamp to video bounds
      const start = Math.max(0, Math.min(seg.start, videoDuration));
      const end = Math.max(start, Math.min(seg.end, videoDuration));
      const duration = end - start;
      
      // Skip zero or negative duration segments
      if (duration <= 0) {
        console.warn(`Skipping invalid segment: ${start.toFixed(6)}s-${end.toFixed(6)}s (duration: ${duration.toFixed(6)}s)`);
        continue;
      }
      
      // Check for overlap with previous segment
      if (validSegments.length > 0) {
        const last = validSegments[validSegments.length - 1];
        if (start < last.end) {
          console.warn(`Merging overlapping segments: ${last.start.toFixed(6)}s-${last.end.toFixed(6)}s and ${start.toFixed(6)}s-${end.toFixed(6)}s`);
          last.end = Math.max(last.end, end);
          continue;
        }
      }
      
      validSegments.push({ start, end });
    }
    
    return validSegments;
  }

  private calculateKeepSegments(
    silenceSegments: SilenceSegment[],
    metadata: any,
    minKeepDuration: number = 0.3
  ): Array<{ start: number; end: number }> {
    const keepSegments: Array<{ start: number; end: number }> = [];
    let currentTime = 0;

    silenceSegments.forEach((silence) => {
      if (currentTime < silence.startTime) {
        keepSegments.push({
          start: currentTime,
          end: silence.startTime,
        });
      }
      currentTime = silence.endTime;
    });

    // Add final segment if there's content after last silence
    // Clamp end to video duration to prevent extending beyond bounds
    if (currentTime < metadata.duration) {
      keepSegments.push({
        start: currentTime,
        end: Math.min(metadata.duration, metadata.duration), // Explicit clamp
      });
    }

    // Filter out segments shorter than minKeepDuration and merge adjacent segments
    const filteredSegments: Array<{ start: number; end: number }> = [];
    for (let i = 0; i < keepSegments.length; i++) {
      const segment = keepSegments[i];
      const duration = segment.end - segment.start;

      if (duration >= minKeepDuration) {
        // Check if we can merge with previous segment
        if (filteredSegments.length > 0) {
          const lastSegment = filteredSegments[filteredSegments.length - 1];
          // Merge if gap is small (less than 0.1s) or segments are adjacent
          if (segment.start - lastSegment.end < 0.1) {
            lastSegment.end = segment.end;
            continue;
          }
        }
        filteredSegments.push(segment);
      } else {
        console.log(`Filtered out short keep segment: ${segment.start}s-${segment.end}s (duration: ${duration.toFixed(2)}s)`);
      }
    }

    return filteredSegments;
  }

  private async splitVideoIntoSegments(
    videoPath: string,
    segments: Array<{ start: number; end: number }>,
    tempDir: string,
    safeMode: boolean,
    sourceMetadata?: VideoMetadata
  ): Promise<string[]> {
    const segmentPaths: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const outputPath = path.join(tempDir, `segment_${i.toString().padStart(4, '0')}.mp4`);

      if (safeMode && sourceMetadata) {
        // Re-encode segment for safe mode (eliminates frozen frames)
        await this.ffmpeg.extractSegmentWithReencode(
          videoPath,
          segment.start,
          segment.end,
          outputPath,
          sourceMetadata
        );
      } else {
        // Fast mode: use copy (may have rare frozen frames)
        await this.ffmpeg.extractSegment(
          videoPath,
          segment.start,
          segment.end,
          outputPath
        );
      }

      segmentPaths.push(outputPath);
    }

    return segmentPaths;
  }

  private async concatenateSegments(
    segmentPaths: string[],
    outputPath: string,
    sourceMetadata?: any
  ): Promise<void> {
    // Use re-encode concatenation to ensure smooth playback and quality preservation
    await this.ffmpeg.concatenateVideosWithReencode(
      segmentPaths,
      outputPath,
      sourceMetadata
    );
  }
}
