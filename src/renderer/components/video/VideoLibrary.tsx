// src/renderer/components/video/VideoLibrary.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { useVideoStore } from '../../stores/video-store';
import { VideoCard } from './VideoCard';
import { VideoPreview } from './VideoPreview';
import { Button } from '../common/Button';
import { DropZone } from './DropZone';

export const VideoLibrary: React.FC = () => {
  const { videos, isLoading, importVideos, selectVideo, selectedVideoId } = useVideoStore();

  const handleFilesDropped = async (files: File[]) => {
    // Convert File objects to file paths and import
    // Note: In Electron, we need to use the file path, not File objects
    // This will be handled via IPC in the main process
    const filePaths = files.map(f => (f as any).path || f.name);
    try {
      // For now, trigger the import dialog
      // In a full implementation, we'd pass file paths directly
      await importVideos();
    } catch (error) {
      console.error('Failed to import dropped files:', error);
    }
  };

  return (
    <DropZone onFilesDropped={handleFilesDropped}>
      <div className="h-full flex flex-col">
      {/* Header Section */}
      <div className="px-8 pt-8 pb-6 border-b border-dark-divider">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold text-dark-text-primary mb-1">Video Library</h2>
            <p className="text-sm text-dark-text-tertiary">
              {videos.length} {videos.length === 1 ? 'video' : 'videos'}
            </p>
          </div>
          <Button onClick={importVideos} variant="primary" size="md">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Import Videos
            </span>
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-8">
        {/* Video Preview - Show when video is selected */}
        {selectedVideoId && <VideoPreview />}

        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full"
          >
            <div className="w-12 h-12 border-4 border-dark-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-dark-text-tertiary">Loading videos...</p>
          </motion.div>
        ) : videos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <div className="w-24 h-24 bg-dark-bg-tertiary rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-dark-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-dark-text-primary mb-2">No videos yet</h3>
            <p className="text-dark-text-tertiary mb-6 max-w-md">
              Import your first video to get started with VideoFlow Studio. You can process videos to remove silence or detect repetitions.
            </p>
            <Button onClick={importVideos} variant="primary" size="lg">
              Import Your First Video
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6"
          >
            {videos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <VideoCard
                  video={video}
                  selected={selectedVideoId === video.id}
                  onSelect={() => selectVideo(video.id)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
    </DropZone>
  );
};
