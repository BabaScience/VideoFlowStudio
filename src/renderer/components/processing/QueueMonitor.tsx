// src/renderer/components/processing/QueueMonitor.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useJobStore, JobStatus } from '../../stores/job-store';
import { Button } from '../common/Button';

export const QueueMonitor: React.FC = () => {
  const { jobs, activeJobs, completedJobs, failedJobs, cancelJob, deleteJob } = useJobStore();
  const [deletingJobId, setDeletingJobId] = React.useState<string | null>(null);

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case JobStatus.ACTIVE:
        return 'text-dark-success';
      case JobStatus.COMPLETED:
        return 'text-dark-success';
      case JobStatus.FAILED:
        return 'text-dark-error';
      default:
        return 'text-dark-text-tertiary';
    }
  };

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case JobStatus.ACTIVE:
        return (
          <div className="w-2 h-2 bg-dark-success rounded-full animate-pulse" />
        );
      case JobStatus.COMPLETED:
        return (
          <svg className="w-4 h-4 text-dark-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case JobStatus.FAILED:
        return (
          <svg className="w-4 h-4 text-dark-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-dark-divider">
        <h2 className="text-2xl font-semibold text-dark-text-primary mb-1">Job Queue</h2>
        <p className="text-sm text-dark-text-tertiary">Monitor and manage video processing jobs</p>
      </div>

      {/* Stats Cards */}
      <div className="px-8 pt-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-dark-bg-secondary rounded-xl p-4 border border-dark-border"
          >
            <p className="text-xs text-dark-text-tertiary mb-1">Total</p>
            <p className="text-2xl font-semibold text-dark-text-primary">{jobs.length}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 }}
            className="bg-dark-bg-secondary rounded-xl p-4 border border-dark-border"
          >
            <p className="text-xs text-dark-text-tertiary mb-1">Active</p>
            <p className="text-2xl font-semibold text-dark-success">{activeJobs.length}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-bg-secondary rounded-xl p-4 border border-dark-border"
          >
            <p className="text-xs text-dark-text-tertiary mb-1">Completed</p>
            <p className="text-2xl font-semibold text-dark-success">{completedJobs.length}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="bg-dark-bg-secondary rounded-xl p-4 border border-dark-border"
          >
            <p className="text-xs text-dark-text-tertiary mb-1">Failed</p>
            <p className="text-2xl font-semibold text-dark-error">{failedJobs.length}</p>
          </motion.div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        <AnimatePresence mode="popLayout">
          {jobs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full text-center"
            >
              <div className="w-20 h-20 bg-dark-bg-tertiary rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-dark-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-dark-text-primary mb-2">No jobs in queue</h3>
              <p className="text-dark-text-tertiary">Processing jobs will appear here</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job, index) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-dark-bg-secondary rounded-xl p-4 border border-dark-border hover:border-dark-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(job.status)}
                        <span className={`text-xs font-semibold uppercase tracking-wide ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                        <span className="text-xs text-dark-text-tertiary">•</span>
                        <span className="text-xs text-dark-text-tertiary capitalize">{job.type.replace('-', ' ')}</span>
                      </div>
                      
                      {job.status === JobStatus.ACTIVE && (
                        <div className="mb-3">
                          <div className="w-full bg-dark-bg-tertiary rounded-full h-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${job.progress}%` }}
                              className="bg-dark-primary h-full rounded-full"
                            />
                          </div>
                          <p className="text-xs text-dark-text-tertiary mt-1">{job.progress}% complete</p>
                        </div>
                      )}
                      
                      <p className="text-xs text-dark-text-tertiary">
                        Created: {new Date(job.createdAt).toLocaleString()}
                      </p>
                      
                      {job.error && (
                        <p className="text-xs text-dark-error mt-2">{job.error}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {(job.status === JobStatus.ACTIVE || job.status === JobStatus.WAITING) && (
                        <Button
                          onClick={() => cancelJob(job.id)}
                          variant="ghost"
                          size="sm"
                          className="text-dark-text-secondary hover:text-dark-error"
                        >
                          Cancel
                        </Button>
                      )}
                      
                      {(job.status === JobStatus.COMPLETED || 
                        job.status === JobStatus.FAILED ||
                        job.status === JobStatus.CANCELLED) && (
                        <Button
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
                              setDeletingJobId(job.id);
                              try {
                                await deleteJob(job.id);
                              } catch (error) {
                                console.error('Failed to delete job:', error);
                                alert('Failed to delete job. Please try again.');
                              } finally {
                                setDeletingJobId(null);
                              }
                            }
                          }}
                          variant="ghost"
                          size="sm"
                          disabled={deletingJobId === job.id}
                          className="text-dark-text-secondary hover:text-dark-error"
                        >
                          {deletingJobId === job.id ? 'Deleting...' : 'Delete'}
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
