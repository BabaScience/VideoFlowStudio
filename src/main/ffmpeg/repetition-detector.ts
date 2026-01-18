// src/main/ffmpeg/repetition-detector.ts
import { ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { FFmpegWrapper } from './wrapper';
import { ProcessingResult } from '../queue/queue-manager';

export interface RepetitionDetectionConfig {
  similarityThreshold: number; // 0.6 to 0.95
  minRepetitionLength: number; // Minimum segment length in seconds
  samplingInterval: number; // Frame sampling rate (e.g., every 5th frame)
  contextWindow?: number; // Seconds before/after to analyze
  hashAlgorithm?: 'phash' | 'dhash' | 'average';
}

export interface RepetitiveSegment {
  firstOccurrence: { start: number; end: number };
  repetitions: Array<{ start: number; end: number }>;
  similarityScore: number;
  confidence: 'high' | 'medium' | 'low';
}

export class RepetitionDetectionProcessor {
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
    config: RepetitionDetectionConfig,
    outputPath: string,
    progressCallback: (progress: number) => Promise<void>,
    _jobId?: string // Reserved for future process tracking
  ): Promise<ProcessingResult> {
    console.log(`Starting repetition detection for: ${videoPath}`);
    // Note: _jobId is reserved for future process tracking implementation
    // Currently, FFmpeg processes are spawned via FFmpegWrapper.executeFFmpeg
    // which doesn't expose process handles for tracking

    // Step 1: Extract frames (20% progress)
    await progressCallback(20);
    const metadata = await this.ffmpeg.getVideoMetadata(videoPath);
    const fps = metadata.video?.fps || 30;
    const frameInterval = config.samplingInterval / fps;
    
    const tempDir = await fs.mkdtemp(path.join('/tmp', 'videoflow-repetition-'));
    
    // Note: extractFrames spawns FFmpeg internally, but we can't easily track it
    // For now, we'll track processes at a higher level if needed
    // The main cancellation will work by killing the worker process
    const framePaths = await this.ffmpeg.extractFrames(
      videoPath,
      tempDir,
      1 / frameInterval
    );

    // Step 2: Compute perceptual hashes (40% progress)
    await progressCallback(40);
    const hashes = await Promise.all(
      framePaths.map((framePath) => this.computePerceptualHash(framePath))
    );

    // Step 3: Detect repetitions (60% progress)
    await progressCallback(60);
    const repetitiveSegments = this.detectRepetitions(
      hashes,
      frameInterval,
      config
    );

    if (repetitiveSegments.length === 0) {
      console.log('No repetitions detected, returning original video');
      await fs.copyFile(videoPath, outputPath);
      await fs.rm(tempDir, { recursive: true, force: true });

      return {
        originalDuration: metadata.duration,
        processedDuration: metadata.duration,
        segmentsRemoved: 0,
        timeSaved: 0,
        outputFilePath: outputPath,
      };
    }

    console.log(`Detected ${repetitiveSegments.length} repetitive segments`);

    // Step 4: Calculate keep segments (70% progress)
    await progressCallback(70);
    const keepSegments = this.calculateKeepSegments(
      repetitiveSegments,
      metadata.duration
    );

    // Step 5: Split and concatenate (85% progress)
    await progressCallback(85);
    const segmentDir = path.join(tempDir, 'segments');
    await fs.mkdir(segmentDir, { recursive: true });
    const segmentPaths = await this.splitVideoIntoSegments(
      videoPath,
      keepSegments,
      segmentDir
    );

    await this.concatenateSegments(segmentPaths, outputPath);

    // Step 6: Cleanup (95% progress)
    await progressCallback(95);
    await fs.rm(tempDir, { recursive: true, force: true });

    const processedMetadata = await this.ffmpeg.getVideoMetadata(outputPath);

    const result: ProcessingResult = {
      originalDuration: metadata.duration,
      processedDuration: processedMetadata.duration,
      segmentsRemoved: repetitiveSegments.length,
      timeSaved: metadata.duration - processedMetadata.duration,
      outputFilePath: outputPath,
      metadata: {
        repetitiveSegments,
        keepSegments,
      },
    };

    console.log(
      `Repetition detection complete. Saved ${result.timeSaved.toFixed(2)}s`
    );

    return result;
  }

  private async computePerceptualHash(imagePath: string): Promise<string> {
    const buffer = await sharp(imagePath)
      .resize(32, 32, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer();

    const average =
      buffer.reduce((a, b) => a + b, 0) / buffer.length;
    const hash = Array.from(buffer)
      .map((pixel: number) => (pixel > average ? '1' : '0'))
      .join('');

    return hash;
  }

  private hammingDistance(hash1: string, hash2: string): number {
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) distance++;
    }
    return distance;
  }

  private similarityFromHammingDistance(
    distance: number,
    hashLength: number
  ): number {
    return 1 - distance / hashLength;
  }

  private detectRepetitions(
    hashes: string[],
    frameInterval: number,
    config: RepetitionDetectionConfig
  ): RepetitiveSegment[] {
    const repetitiveSegments: RepetitiveSegment[] = [];
    const minFrames = Math.ceil(
      config.minRepetitionLength / frameInterval
    );
    const windowSize = minFrames;

    for (let i = 0; i < hashes.length - windowSize; i++) {
      const window1 = hashes.slice(i, i + windowSize);

      for (let j = i + windowSize; j < hashes.length - windowSize; j++) {
        const window2 = hashes.slice(j, j + windowSize);

        // Calculate average similarity
        let totalSimilarity = 0;
        let comparisons = 0;

        for (let k = 0; k < windowSize; k++) {
          const distance = this.hammingDistance(window1[k], window2[k]);
          const similarity = this.similarityFromHammingDistance(
            distance,
            window1[k].length
          );
          totalSimilarity += similarity;
          comparisons++;
        }

        const avgSimilarity = totalSimilarity / comparisons;

        if (avgSimilarity >= config.similarityThreshold) {
          const start1 = i * frameInterval;
          const end1 = (i + windowSize) * frameInterval;
          const start2 = j * frameInterval;
          const end2 = (j + windowSize) * frameInterval;

          // Check if this repetition overlaps with existing ones
          const existingSegment = repetitiveSegments.find(
            (seg) =>
              (start2 >= seg.firstOccurrence.start &&
                start2 <= seg.firstOccurrence.end) ||
              (end2 >= seg.firstOccurrence.start &&
                end2 <= seg.firstOccurrence.end)
          );

          if (existingSegment) {
            // Add to existing segment's repetitions
            existingSegment.repetitions.push({ start: start2, end: end2 });
            existingSegment.similarityScore = Math.max(
              existingSegment.similarityScore,
              avgSimilarity
            );
          } else {
            // Create new repetitive segment
            repetitiveSegments.push({
              firstOccurrence: { start: start1, end: end1 },
              repetitions: [{ start: start2, end: end2 }],
              similarityScore: avgSimilarity,
              confidence:
                avgSimilarity > 0.9
                  ? 'high'
                  : avgSimilarity > 0.75
                  ? 'medium'
                  : 'low',
            });
          }
        }
      }
    }

    return repetitiveSegments;
  }

  private calculateKeepSegments(
    repetitiveSegments: RepetitiveSegment[],
    duration: number
  ): Array<{ start: number; end: number }> {
    // Flatten all segments to remove
    const segmentsToRemove: Array<{ start: number; end: number }> = [];

    repetitiveSegments.forEach((seg) => {
      // Keep first occurrence, remove repetitions
      seg.repetitions.forEach((rep) => {
        segmentsToRemove.push(rep);
      });
    });

    // Sort by start time
    segmentsToRemove.sort((a, b) => a.start - b.start);

    // Calculate keep segments
    const keepSegments: Array<{ start: number; end: number }> = [];
    let currentTime = 0;

    segmentsToRemove.forEach((remove) => {
      if (currentTime < remove.start) {
        keepSegments.push({
          start: currentTime,
          end: remove.start,
        });
      }
      currentTime = Math.max(currentTime, remove.end);
    });

    // Add final segment if there's content after last removal
    if (currentTime < duration) {
      keepSegments.push({
        start: currentTime,
        end: duration,
      });
    }

    return keepSegments;
  }

  private async splitVideoIntoSegments(
    videoPath: string,
    segments: Array<{ start: number; end: number }>,
    tempDir: string
  ): Promise<string[]> {
    const segmentPaths: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const outputPath = path.join(
        tempDir,
        `segment_${i.toString().padStart(4, '0')}.mp4`
      );

      await this.ffmpeg.extractSegment(
        videoPath,
        segment.start,
        segment.end,
        outputPath
      );

      segmentPaths.push(outputPath);
    }

    return segmentPaths;
  }

  private async concatenateSegments(
    segmentPaths: string[],
    outputPath: string
  ): Promise<void> {
    if (segmentPaths.length === 0) {
      throw new Error('No segments to concatenate');
    }

    // Create concat file list
    const concatFilePath = path.join(
      path.dirname(segmentPaths[0]),
      'concat_list.txt'
    );

    const concatContent = segmentPaths.map((p) => `file '${p}'`).join('\n');

    await fs.writeFile(concatFilePath, concatContent);

    // Execute concatenation
    await this.ffmpeg.concatenateVideos(concatFilePath, outputPath);
  }
}
