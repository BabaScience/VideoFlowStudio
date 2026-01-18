// src/main/ffmpeg/repetition-detector.ts
import { ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { FFmpegWrapper, VideoMetadata } from './wrapper';
import { ProcessingResult } from '../queue/queue-manager';

export interface RepetitionDetectionConfig {
  similarityThreshold: number; // 0.6 to 0.95
  minRepetitionLength: number; // Minimum segment length in seconds
  samplingInterval: number; // Frame sampling rate (e.g., every 5th frame)
  contextWindow?: number; // Seconds before/after to analyze
  hashAlgorithm?: 'phash' | 'dhash' | 'average';
  safeMode?: boolean; // Re-encode segments (default: false for speed)
  minKeepDuration?: number; // Minimum keep segment duration in seconds (default: 0.3)
  useSinglePass?: boolean; // Use filter_complex single-pass (default: false)
  useAI?: boolean; // Enable GPT analysis for verbal repetitions (default: false)
  analyzeTranscript?: boolean; // Use transcript for repetition detection (default: false)
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
    jobId?: string
  ): Promise<ProcessingResult> {
    console.log(`Starting repetition detection for: ${videoPath}`);

    let aiVerbalRepetitions: any[] = [];
    let videoId: string | undefined;

    // Step 0: AI Analysis (if enabled) - 5% progress
    if (config.useAI && config.analyzeTranscript) {
      try {
        const { AIService } = await import('../services/ai-service.js');
        const aiService = new AIService();
        
        if (aiService.isAvailable() && jobId) {
          console.log('Using AI-enhanced repetition detection with GPT');
          await progressCallback(5);
          
          // Get video ID from job
          // Note: JobService requires QueueManager, but we only need getJobStatus which doesn't use it
          // We'll access the database directly instead
          const { DatabaseConnection } = await import('../database/connection.js');
          const db = DatabaseConnection.getDatabase();
          const jobStmt = db.prepare('SELECT video_id FROM jobs WHERE id = ?');
          const job = jobStmt.get(jobId) as { video_id: string } | undefined;
          videoId = job?.video_id;

          // Run AI analysis for verbal repetitions
          const aiAnalysis = await aiService.analyzeVideo(
            videoPath,
            {
              useWhisper: true,
              useGPT: true,
              detectRepetitions: true,
            },
            jobId,
            videoId
          );

          if (aiAnalysis.contentAnalysis?.repetitions) {
            aiVerbalRepetitions = aiAnalysis.contentAnalysis.repetitions;
            console.log(`AI detected ${aiVerbalRepetitions.length} verbal repetitions`);
          }
        }
      } catch (error) {
        console.warn('AI-enhanced detection failed, continuing with visual detection:', error);
      }
    }

    // Step 1: Extract frames (20% progress)
    await progressCallback(20);
    const metadata = await this.ffmpeg.getVideoMetadata(videoPath);
    const fps = metadata.video?.fps || 30;
    let frameInterval = config.samplingInterval / fps;
    
    // Limit number of frames to prevent excessive processing
    const expectedFrames = Math.ceil(metadata.duration / frameInterval);
    const maxFrames = 1000; // Limit to prevent excessive processing
    
    if (expectedFrames > maxFrames) {
      console.warn(`Video would generate ${expectedFrames} frames, limiting to ${maxFrames}`);
      // Adjust sampling interval to limit frames
      frameInterval = metadata.duration / maxFrames;
      console.log(`Adjusted frame interval to ${frameInterval.toFixed(3)}s (was ${(config.samplingInterval / fps).toFixed(3)}s)`);
    }
    
    const tempDir = await fs.mkdtemp(path.join('/tmp', 'videoflow-repetition-'));
    
    console.log(`Extracting frames: fps=${fps}, interval=${frameInterval.toFixed(3)}s, expected frames=${Math.ceil(metadata.duration / frameInterval)}`);
    
    // Note: extractFrames spawns FFmpeg internally, but we can't easily track it
    // For now, we'll track processes at a higher level if needed
    // The main cancellation will work by killing the worker process
    const framePaths = await this.ffmpeg.extractFrames(
      videoPath,
      tempDir,
      1 / frameInterval
    );
    
    console.log(`Extracted ${framePaths.length} frames`);

    // Step 2: Compute perceptual hashes (40% progress)
    await progressCallback(40);
    console.log(`Computing hashes for ${framePaths.length} frames...`);
    
    // Process hashes in batches to avoid blocking and provide progress
    const batchSize = 50;
    const hashes: string[] = [];
    for (let i = 0; i < framePaths.length; i += batchSize) {
      const batch = framePaths.slice(i, i + batchSize);
      const batchHashes = await Promise.all(
        batch.map((framePath) => this.computePerceptualHash(framePath))
      );
      hashes.push(...batchHashes);
      
      // Update progress: 40% to 60% for hash computation
      const hashProgress = 40 + ((i + batch.length) / framePaths.length) * 20;
      await progressCallback(hashProgress);
    }
    
    console.log(`Computed ${hashes.length} hashes`);

    // Step 3: Detect repetitions (60% progress)
    await progressCallback(60);
    const visualRepetitiveSegments = await this.detectRepetitions(
      hashes,
      frameInterval,
      config,
      async (progress: number) => {
        // Map internal progress (0-100) to overall progress (60-70%)
        await progressCallback(60 + (progress / 100) * 10);
      }
    );

    // Merge AI verbal repetitions with visual repetitions
    let repetitiveSegments = visualRepetitiveSegments;
    
    if (aiVerbalRepetitions.length > 0) {
      // Convert AI verbal repetitions to RepetitiveSegment format
      const aiSegments: RepetitiveSegment[] = aiVerbalRepetitions.map((rep: any) => ({
        firstOccurrence: rep.firstOccurrence,
        repetitions: rep.repetitions || [],
        similarityScore: rep.similarityScore || 0.8,
        confidence: (rep.similarityScore || 0.8) > 0.9 ? 'high' : (rep.similarityScore || 0.8) > 0.75 ? 'medium' : 'low',
      }));

      // Merge with visual repetitions (combine both types)
      repetitiveSegments = [...visualRepetitiveSegments, ...aiSegments];
      console.log(`Combined ${visualRepetitiveSegments.length} visual + ${aiSegments.length} verbal repetitions`);
    }

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
    const minKeepDuration = config.minKeepDuration || 0.3;
    let keepSegments = this.calculateKeepSegments(
      repetitiveSegments,
      metadata.duration,
      minKeepDuration
    );

    // Validate segments: clamp to bounds, remove invalid, merge overlaps
    keepSegments = this.validateSegments(keepSegments, metadata.duration);

    // Debug logging: log segments with precise times
    console.log('Processing segments:', keepSegments.map(s => 
      `${s.start.toFixed(6)}s-${s.end.toFixed(6)}s (duration: ${(s.end - s.start).toFixed(6)}s)`
    ));
    const totalKeepDuration = keepSegments.reduce((sum, s) => sum + (s.end - s.start), 0);
    console.log(`Total keep duration: ${totalKeepDuration.toFixed(6)}s`);
    console.log(`Original duration: ${metadata.duration.toFixed(6)}s`);
    console.log(`Expected time saved: ${(metadata.duration - totalKeepDuration).toFixed(6)}s`);

    if (keepSegments.length === 0) {
      console.log('No segments to keep after filtering, returning original video');
      await fs.copyFile(videoPath, outputPath);
      await fs.rm(tempDir, { recursive: true, force: true });

      return {
        originalDuration: metadata.duration,
        processedDuration: metadata.duration,
        segmentsRemoved: repetitiveSegments.length,
        timeSaved: 0,
        outputFilePath: outputPath,
      };
    }

    // Step 5: Process segments (85% progress)
    await progressCallback(85);
    
    if (config.useSinglePass) {
      // Single-pass approach: trim and concat in one FFmpeg command
      await this.ffmpeg.processWithSinglePass(
        videoPath,
        keepSegments,
        outputPath,
        metadata
      );
      await fs.rm(tempDir, { recursive: true, force: true });
    } else {
      // Multi-step approach: extract segments then concatenate
      const segmentDir = path.join(tempDir, 'segments');
      await fs.mkdir(segmentDir, { recursive: true });
      const safeMode = config.safeMode || false;
      
      const segmentPaths = await this.splitVideoIntoSegments(
        videoPath,
        keepSegments,
        segmentDir,
        safeMode,
        metadata
      );

      await this.concatenateSegments(segmentPaths, outputPath, metadata);
      
      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    // Step 6: Finalize (95% progress)
    await progressCallback(95);

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
    try {
      // Add timeout to prevent hanging on corrupted images
      const buffer = await Promise.race([
        sharp(imagePath)
          .resize(32, 32, { fit: 'fill' })
          .greyscale()
          .raw()
          .toBuffer(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Hash computation timeout')), 10000)
        )
      ]);

      const average =
        buffer.reduce((a, b) => a + b, 0) / buffer.length;
      const hash = Array.from(buffer)
        .map((pixel: number) => (pixel > average ? '1' : '0'))
        .join('');

      return hash;
    } catch (error) {
      console.error(`Failed to compute hash for ${imagePath}:`, error);
      // Return a default hash to prevent blocking the entire process
      // Use a pattern that won't match anything (all zeros)
      return '0'.repeat(1024); // Default hash (32*32 = 1024 pixels)
    }
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

  private async detectRepetitions(
    hashes: string[],
    frameInterval: number,
    config: RepetitionDetectionConfig,
    progressCallback?: (progress: number) => Promise<void>
  ): Promise<RepetitiveSegment[]> {
    const repetitiveSegments: RepetitiveSegment[] = [];
    const minFrames = Math.ceil(
      config.minRepetitionLength / frameInterval
    );
    const windowSize = minFrames;
    
    // Limit comparison range: only compare windows within reasonable time distance
    // (e.g., max 60 seconds apart to avoid comparing unrelated segments)
    // This dramatically reduces O(n²) complexity
    const maxFrameDistance = Math.min(
      Math.ceil(60 / frameInterval), // Max 60 seconds apart
      hashes.length // Don't exceed array bounds
    );

    // Calculate total comparisons more accurately
    let totalComparisons = 0;
    for (let i = 0; i < hashes.length - windowSize; i++) {
      const maxJ = Math.min(i + maxFrameDistance, hashes.length - windowSize);
      totalComparisons += Math.max(0, maxJ - (i + windowSize));
    }
    
    let completedComparisons = 0;
    let lastProgressUpdate = 0;
    
    console.log(`Detecting repetitions: ${hashes.length} hashes, windowSize=${windowSize}, maxFrameDistance=${maxFrameDistance}, total comparisons=${totalComparisons}`);

    for (let i = 0; i < hashes.length - windowSize; i++) {
      const window1 = hashes.slice(i, i + windowSize);
      
      // Limit inner loop to reasonable distance
      const maxJ = Math.min(i + maxFrameDistance, hashes.length - windowSize);
      
      for (let j = i + windowSize; j < maxJ; j++) {
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
        
        completedComparisons++;
        
        // Report progress every 100 comparisons or every 1% progress, whichever comes first
        if (progressCallback && totalComparisons > 0) {
          const currentProgress = Math.min(100, (completedComparisons / totalComparisons) * 100);
          // Update progress every 1% or every 100 comparisons
          if (completedComparisons % 100 === 0 || currentProgress - lastProgressUpdate >= 1) {
            lastProgressUpdate = currentProgress;
            await progressCallback(currentProgress);
          }
        }
      }
      
      // Also update progress after each outer loop iteration for very long videos
      if (progressCallback && totalComparisons > 0 && i % 10 === 0) {
        const currentProgress = Math.min(100, (completedComparisons / totalComparisons) * 100);
        await progressCallback(currentProgress);
      }
    }
    
    // Final progress update
    if (progressCallback) {
      await progressCallback(100);
    }
    
    console.log(`Repetition detection complete: found ${repetitiveSegments.length} repetitive segments after ${completedComparisons} comparisons`);

    return repetitiveSegments;
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
    repetitiveSegments: RepetitiveSegment[],
    duration: number,
    minKeepDuration: number = 0.3
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
    // Clamp end to video duration to prevent extending beyond bounds
    if (currentTime < duration) {
      keepSegments.push({
        start: currentTime,
        end: Math.min(duration, duration), // Explicit clamp
      });
    }

    // Filter out segments shorter than minKeepDuration and merge adjacent segments
    const filteredSegments: Array<{ start: number; end: number }> = [];
    for (let i = 0; i < keepSegments.length; i++) {
      const segment = keepSegments[i];
      const segmentDuration = segment.end - segment.start;

      if (segmentDuration >= minKeepDuration) {
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
        console.log(`Filtered out short keep segment: ${segment.start}s-${segment.end}s (duration: ${segmentDuration.toFixed(2)}s)`);
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
      const outputPath = path.join(
        tempDir,
        `segment_${i.toString().padStart(4, '0')}.mp4`
      );

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
    if (segmentPaths.length === 0) {
      throw new Error('No segments to concatenate');
    }

    // Use re-encode concatenation to ensure smooth playback and quality preservation
    await this.ffmpeg.concatenateVideosWithReencode(
      segmentPaths,
      outputPath,
      sourceMetadata
    );
  }
}
