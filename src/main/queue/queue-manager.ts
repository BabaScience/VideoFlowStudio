// src/main/queue/queue-manager.ts
import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import os from 'os';
import { EventEmitter } from 'events';
import { SilenceRemovalProcessor } from '../ffmpeg/silence-detector';
import { RepetitionDetectionProcessor } from '../ffmpeg/repetition-detector';

export enum JobType {
  SILENCE_REMOVAL = 'silence-removal',
  REPETITION_DETECTION = 'repetition-detection',
  PREVIEW_GENERATION = 'preview-generation',
}

export interface VideoProcessingJobData {
  jobId: string;
  type: JobType;
  videoId: string;
  videoPath: string;
  config: any;
  outputPath: string;
}

export interface ProcessingResult {
  originalDuration: number;
  processedDuration: number;
  segmentsRemoved: number;
  timeSaved: number;
  outputFilePath: string;
  previewPath?: string;
  metadata?: any;
}

export class QueueManager extends EventEmitter {
  private connection!: IORedis;
  private queue!: Queue;
  private worker!: Worker;
  private queueEvents!: QueueEvents;
  private silenceProcessor!: SilenceRemovalProcessor;
  private repetitionProcessor!: RepetitionDetectionProcessor;
  private connectionOptions: any;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    // Redis connection options
    this.connectionOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    // Initialize Redis connection for event monitoring
    this.connection = new IORedis(this.connectionOptions);

    this.connection.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.connection.on('connect', () => {
      console.log('✓ Redis connected successfully');
    });

    // Initialize job queue with connection options (BullMQ will create its own connection)
    this.queue = new Queue('video-processing', {
      connection: this.connectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 86400, // Keep for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 604800, // Keep failures for 7 days
        },
      },
    });

    // Initialize queue events
    this.queueEvents = new QueueEvents('video-processing', {
      connection: this.connectionOptions,
    });

    this.setupQueueEventListeners();

    // Initialize processors
    this.silenceProcessor = new SilenceRemovalProcessor();
    this.repetitionProcessor = new RepetitionDetectionProcessor();

    // Initialize worker
    const concurrency = Math.max(1, os.cpus().length - 1);
    
    this.worker = new Worker(
      'video-processing',
      async (job: Job<VideoProcessingJobData>) => {
        return await this.processJob(job);
      },
      {
        connection: this.connectionOptions,
        concurrency,
        limiter: {
          max: 5,
          duration: 1000,
        },
      }
    );

    this.setupWorkerEventListeners();

    console.log(`✓ Queue manager initialized with ${concurrency} workers`);
  }

  private setupQueueEventListeners(): void {
    this.queueEvents.on('completed', async ({ jobId, returnvalue }) => {
      // BullMQ's jobId might be different from our custom jobId
      // Try to get the actual job to find our custom jobId
      const job = await this.queue.getJob(jobId);
      const customJobId = job?.data?.jobId || jobId;
      console.log(`Job ${customJobId} completed successfully`);
      this.emit('job:completed', { jobId: customJobId, result: returnvalue });
    });

    this.queueEvents.on('failed', async ({ jobId, failedReason }) => {
      // BullMQ's jobId might be different from our custom jobId
      const job = await this.queue.getJob(jobId);
      const customJobId = job?.data?.jobId || jobId;
      console.error(`Job ${customJobId} failed:`, failedReason);
      this.emit('job:failed', { jobId: customJobId, error: failedReason });
    });

    // Note: QueueEvents progress might not fire reliably, so we rely on worker progress events
    // Keeping this as a fallback
    this.queueEvents.on('progress', ({ jobId, data }) => {
      let progressValue = 0;
      if (typeof data === 'number') {
        progressValue = data;
      } else if (typeof data === 'object' && data !== null && 'progress' in data) {
        progressValue = (data as any).progress || 0;
      }
      this.emit('job:progress', { jobId, progress: progressValue });
    });
  }

  private setupWorkerEventListeners(): void {
    this.worker.on('completed', (job) => {
      console.log(`Worker completed job ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Worker failed job ${job?.id}:`, err.message);
    });

    this.worker.on('progress', (job, progress) => {
      let progressValue = 0;
      if (typeof progress === 'number') {
        progressValue = progress;
      } else if (typeof progress === 'object' && progress !== null && 'progress' in progress) {
        progressValue = (progress as any).progress || 0;
      }
      // Use the custom jobId from job.data, not BullMQ's job.id
      const jobId = job.data?.jobId || (job.id as string);
      console.log(`Job ${jobId} progress: ${progressValue}%`);
      // Emit progress event so it can be forwarded to renderer
      this.emit('job:progress', { jobId, progress: progressValue });
    });

    this.worker.on('error', (err) => {
      console.error('Worker error:', err);
    });
  }

  private async processJob(
    job: Job<VideoProcessingJobData>
  ): Promise<ProcessingResult> {
    const { type, videoPath, config, outputPath, jobId } = job.data;

    try {
      // Emit that job has started (status changed to active)
      this.emit('job:started', { jobId });
      
      await job.updateProgress(0);
      await job.log(`Starting ${type} processing for ${videoPath}`);

      let result: ProcessingResult;

      switch (type) {
        case JobType.SILENCE_REMOVAL:
          result = await this.silenceProcessor.process(
            videoPath,
            config,
            outputPath,
            async (progress: number) => {
              await job.updateProgress(progress);
            },
            jobId
          );
          break;

        case JobType.REPETITION_DETECTION:
          result = await this.repetitionProcessor.process(
            videoPath,
            config,
            outputPath,
            async (progress: number) => {
              await job.updateProgress(progress);
            },
            jobId
          );
          break;

        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      await job.updateProgress(100);
      await job.log('Processing completed successfully');

      return result;
    } catch (error) {
      await job.log(`Error: ${(error as Error).message}`);
      throw error;
    }
  }

  async addJob(
    data: Omit<VideoProcessingJobData, 'jobId'> & { jobId?: string },
    priority: number = 0
  ): Promise<Job<VideoProcessingJobData>> {
    // Use provided jobId or generate one
    const jobId = data.jobId || `job-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const job = await this.queue.add(
      data.type,
      { ...data, jobId } as VideoProcessingJobData,
      {
        priority,
        // Use the custom jobId as BullMQ's jobId to keep them in sync
        jobId,
      }
    );

    console.log(`Job ${jobId} added to queue with priority ${priority}`);

    return job;
  }

  async getJob(jobId: string): Promise<Job<VideoProcessingJobData> | undefined> {
    return await this.queue.getJob(jobId);
  }

  async getActiveJobs(): Promise<Job<VideoProcessingJobData>[]> {
    return await this.queue.getActive();
  }

  async getWaitingJobs(): Promise<Job<VideoProcessingJobData>[]> {
    return await this.queue.getWaiting();
  }

  async getCompletedJobs(): Promise<Job<VideoProcessingJobData>[]> {
    return await this.queue.getCompleted();
  }

  async getFailedJobs(): Promise<Job<VideoProcessingJobData>[]> {
    return await this.queue.getFailed();
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`Job ${jobId} cancelled and removed`);
    }
  }

  async stopJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) {
      console.warn(`Job ${jobId} not found in queue`);
      return;
    }

    const jobData = job.data;
    const jobStatus = await job.getState();

    // Kill FFmpeg processes if job is active
    if (jobStatus === 'active') {
      let cancelled = false;
      if (jobData.type === JobType.SILENCE_REMOVAL) {
        cancelled = this.silenceProcessor.cancelProcess(jobId);
      } else if (jobData.type === JobType.REPETITION_DETECTION) {
        cancelled = this.repetitionProcessor.cancelProcess(jobId);
      }
      
      if (cancelled) {
        console.log(`Stopped FFmpeg processes for job ${jobId}`);
      }
    }

    // Remove from queue
    try {
      await job.remove();
      console.log(`Job ${jobId} removed from queue`);
    } catch (error) {
      console.error(`Failed to remove job ${jobId} from queue:`, error);
    }

    // Emit cancellation event
    this.emit('job:cancelled', { jobId });
  }

  async retryJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job && (await job.isFailed())) {
      await job.retry();
      console.log(`Job ${jobId} retried`);
    }
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
    console.log('Queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.queue.resume();
    console.log('Queue resumed');
  }

  async getQueueMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down queue manager...');

    await this.worker.close();
    await this.queue.close();
    await this.queueEvents.close();
    await this.connection.quit();

    console.log('✓ Queue manager shutdown complete');
  }
}
