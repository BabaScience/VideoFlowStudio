// src/renderer/components/output/ProcessedVideoCard.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface ProcessedVideo {
  id: string;
  jobId: string;
  originalVideoId: string;
  originalFilename: string;
  outputPath: string;
  type: 'silence' | 'repetition';
  completedAt: Date;
  timeSaved?: number;
  segmentsRemoved?: number;
}

interface ProcessedVideoCardProps {
  video: ProcessedVideo;
  selected: boolean;
  onSelect: () => void;
}

export const ProcessedVideoCard: React.FC<ProcessedVideoCardProps> = ({
  video,
  selected,
  onSelect,
}) => {
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTypeBadgeColor = () => {
    return video.type === 'silence'
      ? 'bg-dark-primary/20 text-dark-primary'
      : 'bg-dark-warning/20 text-dark-warning';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={`group relative cursor-pointer rounded-xl overflow-hidden transition-all duration-300 ${
        selected
          ? 'ring-2 ring-dark-primary ring-offset-2 ring-offset-dark-bg-primary shadow-xl shadow-dark-primary/20'
          : 'hover:shadow-lg hover:shadow-black/20'
      }`}
      onClick={onSelect}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-dark-bg-tertiary overflow-hidden">
        <video
          src={`local://${video.outputPath}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          preload="metadata"
          muted
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Type Badge */}
        <div className={`absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-semibold ${getTypeBadgeColor()}`}>
          {video.type === 'silence' ? 'Silence Removed' : 'Repetition Removed'}
        </div>

        {/* Play Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 bg-dark-bg-secondary">
        <h3 className="text-sm font-semibold text-dark-text-primary mb-1 truncate">
          {video.originalFilename}
        </h3>
        <div className="flex items-center justify-between text-xs text-dark-text-tertiary mb-2">
          <span>{formatDate(video.completedAt)}</span>
        </div>
        
        {/* Stats */}
        {(video.timeSaved !== undefined || video.segmentsRemoved !== undefined) && (
          <div className="flex items-center gap-3 text-xs text-dark-text-secondary mt-2 pt-2 border-t border-dark-border">
            {video.timeSaved !== undefined && video.timeSaved > 0 && (
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Saved {formatTime(video.timeSaved)}</span>
              </div>
            )}
            {video.segmentsRemoved !== undefined && video.segmentsRemoved > 0 && (
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>{video.segmentsRemoved} segments</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
