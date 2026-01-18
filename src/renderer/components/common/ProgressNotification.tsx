// src/renderer/components/common/ProgressNotification.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useJobStore, JobStatus } from '../../stores/job-store';

export const ProgressNotification: React.FC = () => {
  const { activeJobs, completedJobs, jobs, cancelJob } = useJobStore();
  
  // Include both active and waiting jobs (waiting jobs are queued but not yet processing)
  const processingJobs = jobs.filter(job => 
    job.status === JobStatus.ACTIVE || job.status === JobStatus.WAITING
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissedJobs, setDismissedJobs] = useState<Set<string>>(new Set());
  const [recentlyCompleted, setRecentlyCompleted] = useState<Map<string, boolean>>(new Map());

  // Track recently completed jobs
  useEffect(() => {
    const newCompleted = completedJobs.filter(
      job => !recentlyCompleted.has(job.id) && job.completedAt && 
      Date.now() - new Date(job.completedAt).getTime() < 5000
    );

    newCompleted.forEach(job => {
      setRecentlyCompleted(prev => new Map(prev).set(job.id, true));
      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        setRecentlyCompleted(prev => {
          const next = new Map(prev);
          next.delete(job.id);
          return next;
        });
      }, 3000);
    });
  }, [completedJobs, recentlyCompleted]);

  // Filter out dismissed jobs - include both active and waiting jobs
  const visibleActiveJobs = processingJobs.filter(job => !dismissedJobs.has(job.id));
  const visibleCompletedJobs = completedJobs
    .filter(job => recentlyCompleted.has(job.id) && !dismissedJobs.has(job.id))
    .slice(-1); // Show only the most recent completion

  const hasJobs = visibleActiveJobs.length > 0 || visibleCompletedJobs.length > 0;

  if (!hasJobs) {
    return null;
  }

  const primaryJob = visibleActiveJobs[0] || visibleCompletedJobs[0];
  const isCompleted = primaryJob?.status === JobStatus.COMPLETED;
  const hasMultipleJobs = visibleActiveJobs.length > 1;

  const handleDismiss = (jobId: string) => {
    setDismissedJobs(prev => new Set([...prev, jobId]));
  };

  return (
    <AnimatePresence>
      {primaryJob && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="fixed bottom-6 right-6 z-50 w-80"
        >
          {/* Primary Job Card */}
          <motion.div
            className={`bg-dark-bg-secondary rounded-xl border shadow-2xl overflow-hidden backdrop-blur-xl mb-2 ${
              isCompleted ? 'border-dark-success' : 'border-dark-border'
            }`}
            animate={isCompleted ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isCompleted ? 'bg-dark-success/20' : 'bg-dark-primary/20'
                }`}>
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    >
                      <svg className="w-5 h-5 text-dark-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  ) : (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    >
                      <svg className="w-5 h-5 text-dark-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </motion.div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-dark-text-primary truncate">
                    {isCompleted ? 'Processing Complete' : 'Processing Video'}
                  </h4>
                  <p className="text-xs text-dark-text-tertiary mt-0.5 capitalize">
                    {primaryJob.type.replace('-', ' ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {hasMultipleJobs && !isCompleted && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs text-dark-text-tertiary hover:text-dark-text-primary px-2 py-1 rounded-md hover:bg-dark-bg-tertiary transition-colors"
                  >
                    {isExpanded ? 'Less' : `${visibleActiveJobs.length} jobs`}
                  </button>
                )}
                {!isCompleted && primaryJob.status === JobStatus.ACTIVE && (
                  <button
                    onClick={() => cancelJob(primaryJob.id)}
                    className="text-xs text-dark-text-tertiary hover:text-dark-error px-2 py-1 rounded-md hover:bg-dark-bg-tertiary transition-colors"
                    aria-label="Cancel"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => handleDismiss(primaryJob.id)}
                  className="text-dark-text-tertiary hover:text-dark-text-primary p-1 rounded-md hover:bg-dark-bg-tertiary transition-colors"
                  aria-label="Dismiss"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Progress Bar - Only show if not completed */}
            {!isCompleted && (
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-dark-text-secondary">Progress</span>
                  <span className="text-xs font-semibold text-dark-text-primary">
                    {Math.round(primaryJob.progress)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-dark-bg-tertiary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${primaryJob.progress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-dark-primary to-dark-secondary rounded-full relative"
                  >
                    {/* Shimmer effect */}
                    <motion.div
                      animate={{
                        x: ['-100%', '100%'],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                        ease: 'linear',
                      }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    />
                  </motion.div>
                </div>
              </div>
            )}

            {/* Completion message */}
            {isCompleted && (
              <div className="px-4 pb-4">
                <p className="text-xs text-dark-text-secondary">
                  Video processed successfully
                </p>
              </div>
            )}

            {/* Pulse indicator - Only for active jobs */}
            {!isCompleted && (
              <div className="absolute top-4 right-4">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-2 h-2 bg-dark-success rounded-full"
                />
              </div>
            )}
          </motion.div>

          {/* Additional Jobs (when expanded) */}
          <AnimatePresence>
            {isExpanded && hasMultipleJobs && !isCompleted && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                {visibleActiveJobs.slice(1).map((job) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="bg-dark-bg-secondary rounded-lg border border-dark-border shadow-lg overflow-hidden backdrop-blur-xl"
                  >
                    <div className="px-3 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-1.5 h-1.5 bg-dark-primary rounded-full flex-shrink-0" />
                        <span className="text-xs text-dark-text-secondary truncate capitalize">
                          {job.type.replace('-', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-medium text-dark-text-primary">
                          {Math.round(job.progress)}%
                        </span>
                        <button
                          onClick={() => handleDismiss(job.id)}
                          className="text-dark-text-tertiary hover:text-dark-text-primary p-0.5 rounded hover:bg-dark-bg-tertiary transition-colors"
                          aria-label="Dismiss"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="px-3 pb-2.5">
                      <div className="w-full h-1 bg-dark-bg-tertiary rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${job.progress}%` }}
                          transition={{ duration: 0.3 }}
                          className="h-full bg-dark-primary rounded-full"
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
