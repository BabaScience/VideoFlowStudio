// src/renderer/components/layout/StatusBar.tsx
import React from 'react';
import { useJobStore } from '../../stores/job-store';
import { useVideoStore } from '../../stores/video-store';

export const StatusBar: React.FC = () => {
  const { activeJobs } = useJobStore();
  const { videos } = useVideoStore();

  // Calculate total storage used
  const totalStorage = videos.reduce((sum, video) => sum + video.size, 0);
  const storageGB = (totalStorage / (1024 * 1024 * 1024)).toFixed(2);

  return (
    <footer className="h-8 bg-dark-bg-secondary border-t border-dark-divider flex items-center justify-between px-6 text-xs text-dark-text-tertiary flex-shrink-0">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-dark-success rounded-full" />
          Ready
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span>
          Jobs: <span className="text-dark-text-secondary font-medium">{activeJobs.length}</span> active
        </span>
        <span>•</span>
        <span>
          Storage: <span className="text-dark-text-secondary font-medium">{storageGB} GB</span> used
        </span>
      </div>
    </footer>
  );
};
