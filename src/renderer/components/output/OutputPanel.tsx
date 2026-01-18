// src/renderer/components/output/OutputPanel.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProcessedVideoCard } from './ProcessedVideoCard';
import { ProcessedVideoPreview } from './ProcessedVideoPreview';

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

export const OutputPanel: React.FC = () => {
  const [processedVideos, setProcessedVideos] = useState<ProcessedVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  useEffect(() => {
    loadProcessedVideos();
  }, []);

  const loadProcessedVideos = async () => {
    try {
      if (!window.api?.output?.list) {
        console.error('Output API not available');
        setIsLoading(false);
        return;
      }
      const videos = await window.api.output.list();
      setProcessedVideos(videos);
    } catch (error) {
      console.error('Failed to load processed videos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedVideo = processedVideos.find(v => v.id === selectedVideoId);

  return (
    <div className="h-full flex flex-col">
      {/* Header Section */}
      <div className="px-8 pt-8 pb-6 border-b border-dark-divider">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold text-dark-text-primary mb-1">Output</h2>
            <p className="text-sm text-dark-text-tertiary">
              {processedVideos.length} processed {processedVideos.length === 1 ? 'video' : 'videos'}
            </p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-8">
        {/* Video Preview - Show when video is selected */}
        {selectedVideo && (
          <ProcessedVideoPreview
            videoPath={selectedVideo.outputPath}
            filename={selectedVideo.originalFilename}
            onClose={() => setSelectedVideoId(null)}
          />
        )}

        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full"
          >
            <div className="w-12 h-12 border-4 border-dark-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-dark-text-tertiary">Loading processed videos...</p>
          </motion.div>
        ) : processedVideos.length === 0 ? (
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-dark-text-primary mb-2">No processed videos yet</h3>
            <p className="text-dark-text-tertiary mb-6 max-w-md">
              Processed videos will appear here once you complete a processing job. Start by processing a video from the Videos section.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6"
          >
            {processedVideos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ProcessedVideoCard
                  video={video}
                  selected={selectedVideoId === video.id}
                  onSelect={() => setSelectedVideoId(video.id)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};
