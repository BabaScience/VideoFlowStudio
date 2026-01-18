// src/renderer/components/video/VideoPreview.tsx
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoStore } from '../../stores/video-store';
import { Button } from '../common/Button';
import { Timeline } from '../timeline/Timeline';
import { TimelineControls } from '../timeline/TimelineControls';

export const VideoPreview: React.FC = () => {
  const { selectedVideoId, videos, selectVideo } = useVideoStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [segments, setSegments] = useState<any[]>([]);
  const [zoom, setZoom] = useState(1);

  const selectedVideo = videos.find(v => v.id === selectedVideoId);

  useEffect(() => {
    if (!selectedVideo) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setSegments([]);
      return;
    }

    // Load segments for this video
    const loadSegments = async () => {
      try {
        if (!window.api?.video?.segments) {
          console.warn('Video segments API not available');
          setSegments([]);
          return;
        }
        const videoSegments = await window.api.video.segments(selectedVideo.id);
        setSegments(videoSegments);
      } catch (error) {
        console.error('Failed to load segments:', error);
        setSegments([]);
      }
    };

    loadSegments();

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
  }, [selectedVideo]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  // Seek is now handled by Timeline component

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (!selectedVideo) {
    return null;
  }

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
              {selectedVideo.filename}
            </h3>
            <p className="text-sm text-dark-text-tertiary">
              {formatTime(duration)} • {selectedVideo.format.toUpperCase()}
            </p>
          </div>
          <button
            onClick={() => selectVideo(selectedVideo.id)}
            className="text-dark-text-tertiary hover:text-dark-text-primary p-2 rounded-lg hover:bg-dark-bg-tertiary transition-colors"
            aria-label="Close preview"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Player */}
        <div className="relative bg-black rounded-lg overflow-hidden mb-4 aspect-video">
          <video
            ref={videoRef}
            src={`local://${selectedVideo.filepath}`}
            className="w-full h-full object-contain"
            preload="metadata"
            controls={false}
          />

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="w-12 h-12 border-4 border-dark-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Play/Pause overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors cursor-pointer"
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

        {/* Timeline */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-dark-text-primary">Timeline</h3>
            <TimelineControls
              zoom={zoom}
              onZoomIn={() => setZoom(Math.min(4, zoom * 1.5))}
              onZoomOut={() => setZoom(Math.max(0.25, zoom / 1.5))}
              onZoomReset={() => setZoom(1)}
              onFitToWindow={() => setZoom(1)}
            />
          </div>
          <Timeline
            duration={duration}
            segments={segments}
            playbackPosition={currentTime}
            onSeek={(time) => {
              const video = videoRef.current;
              if (video) {
                video.currentTime = time;
                setCurrentTime(time);
              }
            }}
            zoom={zoom}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Button
            onClick={togglePlayPause}
            variant="primary"
            size="md"
            className="flex items-center gap-2"
          >
            {isPlaying ? (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play
              </>
            )}
          </Button>
          <Button
            onClick={() => {
              const video = videoRef.current;
              if (video) {
                video.currentTime = 0;
                video.pause();
                setIsPlaying(false);
              }
            }}
            variant="ghost"
            size="md"
          >
            Reset
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
