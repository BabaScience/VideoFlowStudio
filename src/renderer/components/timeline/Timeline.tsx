// src/renderer/components/timeline/Timeline.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TimelineSegment } from './TimelineSegment';

export interface TimelineSegmentData {
  id: string;
  startTime: number;
  endTime: number;
  type: 'silence' | 'repetition' | 'keep';
  confidence?: number;
  userVerified?: boolean;
}

interface TimelineProps {
  duration: number;
  segments: TimelineSegmentData[];
  playbackPosition: number;
  onSeek: (time: number) => void;
  zoom?: number; // 1 = normal, 2 = 2x zoom, etc.
}

export const Timeline: React.FC<TimelineProps> = ({
  duration,
  segments,
  playbackPosition,
  onSeek,
  zoom = 1,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const getTimeFromPosition = useCallback(
    (clientX: number): number => {
      if (!timelineRef.current) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      return percentage * duration;
    },
    [duration]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const time = getTimeFromPosition(e.clientX);
    onSeek(time);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const time = getTimeFromPosition(e.clientX);
      onSeek(time);
    } else {
      const time = getTimeFromPosition(e.clientX);
      setHoverTime(time);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverTime(null);
  };

  // Calculate playhead position
  const playheadPosition = duration > 0 ? (playbackPosition / duration) * 100 : 0;

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full">
      {/* Timeline Container */}
      <div
        ref={timelineRef}
        className="relative w-full h-16 bg-dark-bg-tertiary rounded-lg cursor-pointer overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Segments */}
        {segments.map((segment) => (
          <TimelineSegment
            key={segment.id}
            segment={segment}
            duration={duration}
            zoom={zoom}
          />
        ))}

        {/* Playhead Indicator */}
        <motion.div
          className="absolute top-0 bottom-0 w-0.5 bg-dark-primary z-20 pointer-events-none"
          style={{ left: `${playheadPosition}%` }}
          initial={false}
          animate={{ left: `${playheadPosition}%` }}
          transition={{ duration: 0.1 }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-dark-primary rounded-full border-2 border-dark-bg-primary" />
        </motion.div>

        {/* Hover Time Indicator */}
        {hoverTime !== null && !isDragging && (
          <div
            className="absolute top-0 bottom-0 w-px bg-dark-text-tertiary/50 z-10 pointer-events-none"
            style={{ left: `${(hoverTime / duration) * 100}%` }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-1 bg-dark-bg-secondary rounded text-xs text-dark-text-primary whitespace-nowrap border border-dark-border">
              {formatTime(hoverTime)}
            </div>
          </div>
        )}

        {/* Time Markers */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-xs text-dark-text-tertiary pointer-events-none">
          <span>{formatTime(0)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Timeline Info */}
      <div className="flex items-center justify-between mt-2 text-xs text-dark-text-tertiary">
        <span>
          {segments.length} segment{segments.length !== 1 ? 's' : ''}
        </span>
        <span>{formatTime(playbackPosition)} / {formatTime(duration)}</span>
      </div>
    </div>
  );
};
