// src/renderer/components/history/JobHistory.tsx
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useJobStore, JobStatus } from '../../stores/job-store';
import { formatDistanceToNow } from 'date-fns';

export const JobHistory: React.FC = () => {
  const { jobs, loadJobs } = useJobStore();
  const [filter, setFilter] = useState<'all' | JobStatus>('all');

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const filteredJobs = filter === 'all' 
    ? jobs 
    : jobs.filter(job => job.status === filter);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 pt-8 pb-6 border-b border-dark-divider">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold text-dark-text-primary mb-1">Job History</h2>
            <p className="text-sm text-dark-text-tertiary">
              {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
            </p>
          </div>
          <div className="flex gap-2">
            {(['all', JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.ACTIVE] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? 'bg-dark-primary text-white'
                    : 'bg-dark-bg-tertiary text-dark-text-secondary hover:bg-dark-bg-secondary'
                }`}
              >
                {status === 'all' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-12 text-dark-text-tertiary">
            No jobs found
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-dark-bg-secondary rounded-lg border border-dark-border p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        job.status === JobStatus.COMPLETED ? 'bg-dark-success/20 text-dark-success' :
                        job.status === JobStatus.FAILED ? 'bg-dark-error/20 text-dark-error' :
                        job.status === JobStatus.ACTIVE ? 'bg-dark-primary/20 text-dark-primary' :
                        'bg-dark-bg-tertiary text-dark-text-tertiary'
                      }`}>
                        {job.status}
                      </span>
                      <span className="text-sm text-dark-text-tertiary">
                        {formatDistanceToNow(job.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-sm text-dark-text-primary">
                      {job.type} • {job.progress}%
                    </div>
                    {job.result && (
                      <div className="text-xs text-dark-text-tertiary mt-1">
                        Saved {formatTime(job.result.timeSaved || 0)}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
