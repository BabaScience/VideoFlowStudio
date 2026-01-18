// src/renderer/stores/job-store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export enum JobType {
  SILENCE_REMOVAL = 'silence-removal',
  REPETITION_DETECTION = 'repetition-detection',
}

export enum JobStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

interface VideoProcessingJob {
  id: string;
  type: JobType;
  videoId: string;
  status: JobStatus;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
}

interface JobStore {
  jobs: VideoProcessingJob[];
  activeJobs: VideoProcessingJob[];
  completedJobs: VideoProcessingJob[];
  failedJobs: VideoProcessingJob[];
  waitingJobs: VideoProcessingJob[];

  // Actions
  loadJobs: () => Promise<void>;
  createJob: (type: JobType, videoId: string, config: any) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  updateJobProgress: (jobId: string, progress: number) => void;
  updateJobStatus: (jobId: string, status: JobStatus, result?: any) => void;
  subscribeToJobUpdates: () => () => void;
  getJobsByVideoId: (videoId: string) => VideoProcessingJob[];
}

export const useJobStore = create<JobStore>()(
  devtools(
    (set, get) => ({
      jobs: [],
      activeJobs: [],
      completedJobs: [],
      failedJobs: [],
      waitingJobs: [],

      loadJobs: async () => {
        try {
          const jobs = await window.api.job.list();
          
          set({
            jobs,
            activeJobs: jobs.filter((j) => j.status === JobStatus.ACTIVE),
            completedJobs: jobs.filter((j) => j.status === JobStatus.COMPLETED),
            failedJobs: jobs.filter((j) => j.status === JobStatus.FAILED),
            waitingJobs: jobs.filter((j) => j.status === JobStatus.WAITING),
          });
        } catch (error) {
          console.error('Failed to load jobs:', error);
        }
      },

      createJob: async (type: JobType, videoId: string, config: any) => {
        try {
          let job;

          if (type === JobType.SILENCE_REMOVAL) {
            job = await window.api.video.processSilence(videoId, config);
          } else if (type === JobType.REPETITION_DETECTION) {
            job = await window.api.video.processRepetition(videoId, config);
          }

          if (job) {
            set((state) => {
              const updatedJobs = [job, ...state.jobs];
            return {
              jobs: updatedJobs,
              activeJobs: updatedJobs.filter((j) => j.status === JobStatus.ACTIVE),
              completedJobs: updatedJobs.filter((j) => j.status === JobStatus.COMPLETED),
              failedJobs: updatedJobs.filter((j) => j.status === JobStatus.FAILED),
              waitingJobs: updatedJobs.filter((j) => j.status === JobStatus.WAITING),
            };
            });
          }
        } catch (error) {
          console.error('Failed to create job:', error);
          throw error;
        }
      },

      cancelJob: async (jobId: string) => {
        try {
          await window.api.job.cancel(jobId);

          set((state) => {
            const updatedJobs = state.jobs.map((job) =>
              job.id === jobId
                ? { ...job, status: JobStatus.FAILED, error: 'Cancelled by user' }
                : job
            );
            return {
              jobs: updatedJobs,
              activeJobs: updatedJobs.filter((j) => j.status === JobStatus.ACTIVE),
              completedJobs: updatedJobs.filter((j) => j.status === JobStatus.COMPLETED),
              failedJobs: updatedJobs.filter((j) => j.status === JobStatus.FAILED),
              waitingJobs: updatedJobs.filter((j) => j.status === JobStatus.WAITING),
            };
          });
        } catch (error) {
          console.error('Failed to cancel job:', error);
        }
      },

      deleteJob: async (jobId: string) => {
        try {
          await window.api.job.delete(jobId);

          set((state) => ({
            jobs: state.jobs.filter((j) => j.id !== jobId),
            activeJobs: state.activeJobs.filter((j) => j.id !== jobId),
            completedJobs: state.completedJobs.filter((j) => j.id !== jobId),
            failedJobs: state.failedJobs.filter((j) => j.id !== jobId),
            waitingJobs: state.waitingJobs.filter((j) => j.id !== jobId),
          }));
        } catch (error) {
          console.error('Failed to delete job:', error);
          throw error;
        }
      },

      retryJob: async (jobId: string) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job) return;

        // Remove failed job and create new one
        set((state) => ({
          failedJobs: state.failedJobs.filter((j) => j.id !== jobId),
        }));

        // Create new job with same config
        // Note: You'd need to store the original config
        await get().loadJobs();
      },

      updateJobProgress: (jobId: string, progress: number) => {
        set((state) => {
          const updatedJobs = state.jobs.map((job) =>
            job.id === jobId ? { ...job, progress } : job
          );
          
            return {
              jobs: updatedJobs,
              activeJobs: updatedJobs.filter((j) => j.status === JobStatus.ACTIVE),
              waitingJobs: updatedJobs.filter((j) => j.status === JobStatus.WAITING),
            };
        });
      },

      updateJobStatus: (jobId: string, status: JobStatus, result?: any) => {
        set((state) => {
          const updatedJobs = state.jobs.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status,
                  completedAt: status === JobStatus.COMPLETED ? new Date() : job.completedAt,
                  result: result || job.result,
                }
              : job
          );

          return {
            jobs: updatedJobs,
            activeJobs: updatedJobs.filter((j) => j.status === JobStatus.ACTIVE),
            completedJobs: updatedJobs.filter((j) => j.status === JobStatus.COMPLETED),
            failedJobs: updatedJobs.filter((j) => j.status === JobStatus.FAILED),
            waitingJobs: updatedJobs.filter((j) => j.status === JobStatus.WAITING),
          };
        });
      },

      subscribeToJobUpdates: () => {
        const handleProgress = (data: { jobId: string; progress: number }) => {
          if (!data || !data.jobId) {
            console.error('Invalid progress event data:', data);
            return;
          }
          get().updateJobProgress(data.jobId, data.progress);
        };

        const handleStarted = (data: { jobId: string }) => {
          if (!data || !data.jobId) {
            console.error('Invalid started event data:', data);
            return;
          }
          get().updateJobStatus(data.jobId, JobStatus.ACTIVE);
        };

        const handleCompleted = (data: { jobId: string; result: any }) => {
          if (!data || !data.jobId) {
            console.error('Invalid completed event data:', data);
            return;
          }
          get().updateJobStatus(data.jobId, JobStatus.COMPLETED, data.result);
        };

        const handleFailed = (data: { jobId: string; error: string }) => {
          if (!data || !data.jobId) {
            console.error('Invalid failed event data:', data);
            return;
          }
          set((state) => {
            const updatedJobs = state.jobs.map((job) =>
              job.id === data.jobId
                ? { ...job, status: JobStatus.FAILED, error: data.error }
                : job
            );
            return {
              jobs: updatedJobs,
              activeJobs: updatedJobs.filter((j) => j.status === JobStatus.ACTIVE),
              completedJobs: updatedJobs.filter((j) => j.status === JobStatus.COMPLETED),
              failedJobs: updatedJobs.filter((j) => j.status === JobStatus.FAILED),
              waitingJobs: updatedJobs.filter((j) => j.status === JobStatus.WAITING),
            };
          });
        };

        const handleCancelled = (data: { jobId: string }) => {
          if (!data || !data.jobId) {
            console.error('Invalid cancelled event data:', data);
            return;
          }
          set((state) => {
            const updatedJobs = state.jobs.map((job) =>
              job.id === data.jobId
                ? { ...job, status: JobStatus.FAILED, error: 'Cancelled by user' }
                : job
            );
            return {
              jobs: updatedJobs,
              activeJobs: updatedJobs.filter((j) => j.status === JobStatus.ACTIVE),
              completedJobs: updatedJobs.filter((j) => j.status === JobStatus.COMPLETED),
              failedJobs: updatedJobs.filter((j) => j.status === JobStatus.FAILED),
              waitingJobs: updatedJobs.filter((j) => j.status === JobStatus.WAITING),
            };
          });
        };

        window.api.on('job:progress', handleProgress);
        window.api.on('job:started', handleStarted);
        window.api.on('job:completed', handleCompleted);
        window.api.on('job:failed', handleFailed);
        window.api.on('job:cancelled', handleCancelled);

        // Return cleanup function
        return () => {
          window.api.removeListener('job:progress', handleProgress);
          window.api.removeListener('job:started', handleStarted);
          window.api.removeListener('job:completed', handleCompleted);
          window.api.removeListener('job:failed', handleFailed);
          window.api.removeListener('job:cancelled', handleCancelled);
        };
      },

      getJobsByVideoId: (videoId: string) => {
        return get().jobs.filter((j) => j.videoId === videoId);
      },
    }),
    { name: 'JobStore' }
  )
);
