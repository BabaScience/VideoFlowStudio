// src/renderer/components/timeline/TimelineSegment.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TimelineSegmentData } from './Timeline';

interface TimelineSegmentProps {
  segment: TimelineSegmentData;
  duration: number;
  zoom: number;
}

export const TimelineSegment: React.FC<TimelineSegmentProps> = ({
  segment,
  duration,
  zoom,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  if (duration === 0) return null;

  const startPercent = (segment.startTime / duration) * 100;
  const widthPercent = ((segment.endTime - segment.startTime) / duration) * 100;

  const getSegmentColor = () => {
    switch (segment.type) {
      case 'silence':
        return 'bg-dark-error/30 border-dark-error/50';
      case 'repetition':
        return 'bg-dark-warning/30 border-dark-warning/50';
      case 'keep':
        return 'bg-dark-success/30 border-dark-success/50';
      default:
        return 'bg-dark-bg-secondary border-dark-border';
    }
  };

  const getSegmentLabel = () => {
    switch (segment.type) {
      case 'silence':
        return 'Silence';
      case 'repetition':
        return 'Repetition';
      case 'keep':
        return 'Keep';
      default:
        return '';
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      className={`absolute top-0 bottom-0 border-l border-r ${getSegmentColor()} ${
        isHovered ? 'opacity-100 z-30' : 'opacity-70 z-10'
      } transition-opacity`}
      style={{
        left: `${startPercent}%`,
        width: `${widthPercent}%`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={false}
      animate={{
        left: `${startPercent}%`,
        width: `${widthPercent}%`,
      }}
      transition={{ duration: 0.2 }}
    >
      {/* Segment Label on Hover */}
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-dark-bg-secondary rounded text-xs text-dark-text-primary whitespace-nowrap border border-dark-border shadow-lg z-40"
        >
          <div className="font-semibold">{getSegmentLabel()}</div>
          <div className="text-dark-text-tertiary">
            {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
          </div>
          {segment.confidence !== undefined && (
            <div className="text-dark-text-tertiary">
              Confidence: {Math.round(segment.confidence * 100)}%
            </div>
          )}
        </motion.div>
      )}

      {/* Verified Indicator */}
      {segment.userVerified && (
        <div className="absolute top-1 right-1 w-2 h-2 bg-dark-success rounded-full" />
      )}
    </motion.div>
  );
};
