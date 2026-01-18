// src/renderer/components/output/ProcessedVideoPreview.tsx
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../common/Button';

interface ProcessedVideoPreviewProps {
  videoPath: string;
  filename: string;
  onClose: () => void;
}

export const ProcessedVideoPreview: React.FC<ProcessedVideoPreviewProps> = ({
  videoPath,
  filename,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoPath]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-dark-bg-secondary rounded-xl border border-dark-border p-6 mb-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-dark-text-primary truncate mb-1">
              {filename}
            </h3>
            <p className="text-sm text-dark-text-tertiary">
              Processed Video Preview
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-dark-text-tertiary hover:text-dark-text-primary p-2 rounded-lg hover:bg-dark-bg-tertiary transition-colors"
            aria-label="Close preview"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-dark-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <video
            ref={videoRef}
            src={`local://${videoPath}`}
            className="w-full h-full object-contain"
            preload="metadata"
            controls={false}
          />

          {/* Play/Pause Overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={togglePlayPause}
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className={`w-16 h-16 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-xl ${
                isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'
              } transition-opacity`}
            >
              {isPlaying ? (
                <svg className="w-8 h-8 text-dark-bg-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-dark-bg-primary ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </motion.button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div
            className="w-full h-2 bg-dark-bg-tertiary rounded-full cursor-pointer overflow-hidden"
            onClick={(e) => {
              const video = videoRef.current;
              if (!video || !duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = x / rect.width;
              const newTime = percentage * duration;
              video.currentTime = newTime;
              setCurrentTime(newTime);
            }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-dark-primary to-dark-secondary rounded-full relative"
              style={{ width: `${progressPercentage}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg" />
            </motion.div>
          </div>
          <div className="flex justify-between items-center mt-2 text-xs text-dark-text-tertiary">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Button
            onClick={togglePlayPause}
            variant="primary"
            size="md"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
