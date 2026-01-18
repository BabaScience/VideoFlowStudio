// src/renderer/components/video/VideoCard.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface VideoFile {
  id: string;
  filename: string;
  filepath: string;
  duration: number;
  size: number;
  format: string;
  thumbnailPath?: string;
}

interface VideoCardProps {
  video: VideoFile;
  selected: boolean;
  onSelect: () => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, selected, onSelect }) => {
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
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
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-video bg-dark-bg-tertiary overflow-hidden">
        {video.thumbnailPath ? (
          <img
            src={`local://${video.thumbnailPath}`}
            alt={video.filename}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              // Fallback if image fails to load
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <svg
                className="w-12 h-12 text-dark-text-tertiary mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <p className="text-xs text-dark-text-tertiary">No thumbnail</p>
            </div>
          </div>
        )}
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
        
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-md">
          <span className="text-xs font-medium text-white">{formatDuration(video.duration)}</span>
        </div>

        {/* Play button overlay - Show on hover or when selected */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-xl"
          >
            <svg className="w-7 h-7 text-dark-bg-primary ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </motion.button>
        </div>

        {/* Selection indicator */}
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-2 right-2 w-6 h-6 bg-dark-primary rounded-full flex items-center justify-center shadow-lg z-10"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(); // Toggle selection off
            }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4 bg-dark-bg-secondary" onClick={onSelect}>
        <h3 className="font-medium text-sm text-dark-text-primary truncate mb-1 group-hover:text-dark-primary transition-colors">
          {video.filename}
        </h3>
        <div className="flex items-center justify-between text-xs text-dark-text-tertiary">
          <span className="uppercase tracking-wide">{video.format}</span>
          <span>{formatFileSize(video.size)}</span>
        </div>
      </div>
    </motion.div>
  );
};
