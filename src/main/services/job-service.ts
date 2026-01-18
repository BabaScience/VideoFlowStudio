// src/main/services/job-service.ts
import { DatabaseConnection } from '../database/connection';
import { QueueManager, JobType } from '../queue/queue-manager';
import { VideoService } from './video-service';
import { SegmentService } from './segment-service';
import { PreferencesService } from './preferences-service';
import path from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import { app } from 'electron';

export interface VideoProcessingJob {
  id: string;
  type: JobType;
  videoId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
}

export class JobService {
  private get db() {
    return DatabaseConnection.getDatabase();
  }
  private queueManager: QueueManager;
  private videoService: VideoService;
  private segmentService: SegmentService;
  private preferencesService: PreferencesService;

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager;
    this.videoService = new VideoService();
    this.segmentService = new SegmentService();
    this.preferencesService = new PreferencesService();

    // Listen to queue events and update database
    this.queueManager.on('job:completed', async ({ jobId, result }) => {
      await this.updateJobStatus(jobId, 'completed', result);
    });

    this.queueManager.on('job:failed', async ({ jobId, error }) => {
      await this.updateJobStatus(jobId, 'failed', undefined, error);
    });

    this.queueManager.on('job:progress', async ({ jobId, progress }) => {
      await this.updateJobProgress(jobId, progress);
    });
  }

  async createSilenceRemovalJob(
    videoId: string,
    config: any
  ): Promise<VideoProcessingJob> {
    const video = await this.videoService.getVideoById(videoId);
    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    const jobId = randomUUID();
    // Use user's preferred output directory or fall back to default
    const userOutputDir = await this.preferencesService.getPreference('outputDirectory');
    const baseOutputDir = userOutputDir || path.join(app.getPath('userData'), 'outputs');
    const outputDir = path.join(baseOutputDir, jobId);
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `processed_${video.filename}`);

    // Create job record in database
    const job: VideoProcessingJob = {
      id: jobId,
      type: JobType.SILENCE_REMOVAL,
      videoId,
      status: 'waiting',
      progress: 0,
      createdAt: new Date(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO jobs (
        id, video_id, type, config, status, progress, output_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      job.id,
      job.videoId,
      job.type,
      JSON.stringify(config),
      job.status,
      job.progress,
      outputPath,
      job.createdAt.toISOString()
    );

    // Add to queue - pass the database jobId so events use the correct ID
    await this.queueManager.addJob({
      type: JobType.SILENCE_REMOVAL,
      videoId,
      videoPath: video.filepath,
      config,
      outputPath,
      jobId, // Pass the database jobId
    });

    return job;
  }

  async createRepetitionDetectionJob(
    videoId: string,
    config: any
  ): Promise<VideoProcessingJob> {
    const video = await this.videoService.getVideoById(videoId);
    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    const jobId = randomUUID();
    // Use user's preferred output directory or fall back to default
    const userOutputDir = await this.preferencesService.getPreference('outputDirectory');
    const baseOutputDir = userOutputDir || path.join(app.getPath('userData'), 'outputs');
    const outputDir = path.join(baseOutputDir, jobId);
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `processed_${video.filename}`);

    // Create job record in database
    const job: VideoProcessingJob = {
      id: jobId,
      type: JobType.REPETITION_DETECTION,
      videoId,
      status: 'waiting',
      progress: 0,
      createdAt: new Date(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO jobs (
        id, video_id, type, config, status, progress, output_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      job.id,
      job.videoId,
      job.type,
      JSON.stringify(config),
      job.status,
      job.progress,
      outputPath,
      job.createdAt.toISOString()
    );

    // Add to queue - pass the database jobId so events use the correct ID
    await this.queueManager.addJob({
      type: JobType.REPETITION_DETECTION,
      videoId,
      videoPath: video.filepath,
      config,
      outputPath,
      jobId, // Pass the database jobId
    });

    return job;
  }

  async getJobStatus(jobId: string): Promise<VideoProcessingJob | null> {
    const stmt = this.db.prepare('SELECT * FROM jobs WHERE id = ?');
    const row = stmt.get(jobId) as any;

    if (!row) return null;

    return {
      id: row.id,
      type: row.type as JobType,
      videoId: row.video_id,
      status: row.status as 'waiting' | 'active' | 'completed' | 'failed',
      progress: row.progress,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      error: row.error || undefined,
      result: row.result ? JSON.parse(row.result) : undefined,
    };
  }

  async getAllJobs(): Promise<VideoProcessingJob[]> {
    const stmt = this.db.prepare('SELECT * FROM jobs ORDER BY created_at DESC');
    const rows = stmt.all() as any[];

    return rows.map((row) => ({
      id: row.id,
      type: row.type as JobType,
      videoId: row.video_id,
      status: row.status as 'waiting' | 'active' | 'completed' | 'failed',
      progress: row.progress,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      error: row.error || undefined,
      result: row.result ? JSON.parse(row.result) : undefined,
    }));
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = await this.getJobStatus(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // If job is active or waiting, stop it
    if (job.status === 'active' || job.status === 'waiting') {
      await this.queueManager.stopJob(jobId);
    } else {
      // Just remove from queue if it exists
      await this.queueManager.cancelJob(jobId);
    }

    // Update database status
    await this.updateJobStatus(jobId, 'failed', undefined, 'Cancelled by user');

    // Clean up temporary files
    await this.cleanupJobFiles(jobId);
  }

  async cleanupJobFiles(jobId: string): Promise<void> {
    try {
      const job = await this.getJobStatus(jobId);
      if (!job) return;

      // Get output path from database
      const stmt = this.db.prepare('SELECT output_path FROM jobs WHERE id = ?');
      const row = stmt.get(jobId) as any;
      
      if (row?.output_path) {
        const outputPath = row.output_path;
        const outputDir = path.dirname(outputPath);
        
        // Delete output directory if it exists
        try {
          await fs.rm(outputDir, { recursive: true, force: true });
          console.log(`Cleaned up output directory for job ${jobId}: ${outputDir}`);
        } catch (error) {
          console.warn(`Failed to delete output directory ${outputDir}:`, error);
        }
      }

      // Clean up temporary directories (pattern: /tmp/videoflow-*)
      // Note: We can't track all temp dirs perfectly, but we can try to clean known patterns
      try {
        const tmpDir = '/tmp';
        const entries = await fs.readdir(tmpDir);
        const videoflowDirs = entries.filter(entry => entry.startsWith('videoflow-'));
        
        for (const dir of videoflowDirs) {
          const dirPath = path.join(tmpDir, dir);
          try {
            await fs.rm(dirPath, { recursive: true, force: true });
          } catch (error) {
            // Ignore errors for temp dirs - they might be in use by other processes
          }
        }
      } catch (error) {
        // Ignore errors reading /tmp directory
        console.warn('Could not clean up temporary directories:', error);
      }
    } catch (error) {
      console.error(`Error cleaning up files for job ${jobId}:`, error);
      // Don't throw - cleanup failures shouldn't block cancellation
    }
  }

  async deleteJob(jobId: string): Promise<void> {
    const job = await this.getJobStatus(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // If job is active or waiting, cancel it first
    if (job.status === 'active' || job.status === 'waiting') {
      await this.cancelJob(jobId);
    } else {
      // Clean up files even if not cancelling
      await this.cleanupJobFiles(jobId);
    }

    // Remove from BullMQ queue if it still exists
    try {
      await this.queueManager.cancelJob(jobId);
    } catch (error) {
      // Job might not exist in queue anymore, that's okay
      console.warn(`Job ${jobId} not found in queue (may have already been removed)`);
    }

    // Delete from database
    const stmt = this.db.prepare('DELETE FROM jobs WHERE id = ?');
    stmt.run(jobId);
    console.log(`Deleted job ${jobId} from database`);
  }

  async updateJobProgress(jobId: string, progress: number): Promise<void> {
    const stmt = this.db.prepare('UPDATE jobs SET progress = ? WHERE id = ?');
    stmt.run(progress, jobId);
  }

  async updateJobStatus(
    jobId: string,
    status: 'waiting' | 'active' | 'completed' | 'failed',
    result?: any,
    error?: string
  ): Promise<void> {
    try {
      const updates: string[] = ['status = ?'];
      const values: any[] = [status];

      if (status === 'active') {
        // Set started_at only if not already set
        const existingJob = await this.getJobStatus(jobId);
        if (!existingJob?.startedAt) {
          updates.push('started_at = ?');
          values.push(new Date().toISOString());
        }
      }

      if (status === 'completed') {
        updates.push('completed_at = ?');
        values.push(new Date().toISOString());
        
        if (result !== undefined) {
          updates.push('result = ?');
          values.push(JSON.stringify(result));
        }
      }

      if (status === 'failed' && error) {
        updates.push('error = ?');
        values.push(error);
      }

      values.push(jobId);

      const stmt = this.db.prepare(
        `UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`
      );
      stmt.run(...values);
    } catch (error) {
      console.error(`Failed to update job status for ${jobId}:`, error);
      throw error;
    }
  }

  async exportResult(jobId: string, destinationPath: string): Promise<string> {
    const job = await this.getJobStatus(jobId);
    if (!job || job.status !== 'completed') {
      throw new Error('Job not completed or not found');
    }

    const stmt = this.db.prepare('SELECT output_path FROM jobs WHERE id = ?');
    const row = stmt.get(jobId) as any;

    if (!row || !row.output_path) {
      throw new Error('Output file not found');
    }

    // Copy file to destination
    await fs.copyFile(row.output_path, destinationPath);

    return destinationPath;
  }

  async saveJobSegments(jobId: string, result: any): Promise<void> {
    const job = await this.getJobStatus(jobId);
    if (!job) {
      console.warn(`Job ${jobId} not found when saving segments`);
      return;
    }

    const segments: Array<{
      startTime: number;
      endTime: number;
      type: 'silence' | 'repetition' | 'keep';
      confidence?: number;
    }> = [];

    // Extract silence segments
    if (result.metadata?.silenceSegments && Array.isArray(result.metadata.silenceSegments)) {
      for (const segment of result.metadata.silenceSegments) {
        if (segment && typeof segment.startTime === 'number' && typeof segment.endTime === 'number') {
          segments.push({
            startTime: Number(segment.startTime),
            endTime: Number(segment.endTime),
            type: 'silence',
            confidence: undefined,
          });
        }
      }
    }

    // Extract keep segments (non-silence parts)
    if (result.metadata?.keepSegments && Array.isArray(result.metadata.keepSegments)) {
      for (const segment of result.metadata.keepSegments) {
        if (segment && typeof segment.start === 'number' && typeof segment.end === 'number') {
          segments.push({
            startTime: Number(segment.start),
            endTime: Number(segment.end),
            type: 'keep',
            confidence: undefined,
          });
        }
      }
    }

    // Extract repetition segments
    if (result.metadata?.repetitiveSegments && Array.isArray(result.metadata.repetitiveSegments)) {
      for (const segment of result.metadata.repetitiveSegments) {
        if (segment && segment.firstOccurrence) {
          // Add first occurrence
          if (typeof segment.firstOccurrence.start === 'number' && typeof segment.firstOccurrence.end === 'number') {
            segments.push({
              startTime: Number(segment.firstOccurrence.start),
              endTime: Number(segment.firstOccurrence.end),
              type: 'repetition',
              confidence: typeof segment.similarityScore === 'number' ? Number(segment.similarityScore) : undefined,
            });
          }
          // Add repetitions
          if (Array.isArray(segment.repetitions)) {
            for (const repetition of segment.repetitions) {
              if (repetition && typeof repetition.start === 'number' && typeof repetition.end === 'number') {
                segments.push({
                  startTime: Number(repetition.start),
                  endTime: Number(repetition.end),
                  type: 'repetition',
                  confidence: typeof segment.similarityScore === 'number' ? Number(segment.similarityScore) : undefined,
                });
              }
            }
          }
        }
      }
    }

    if (segments.length > 0) {
      await this.segmentService.saveSegments(job.videoId, jobId, segments);
      console.log(`Saved ${segments.length} segments for job ${jobId}`);
    }
  }

  async getJobSegments(jobId: string): Promise<any[]> {
    return await this.segmentService.getSegmentsByJobId(jobId);
  }

  async getVideoSegments(videoId: string): Promise<any[]> {
    return await this.segmentService.getSegmentsByVideoId(videoId);
  }
}
