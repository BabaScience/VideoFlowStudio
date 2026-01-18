// src/renderer/components/processing/RepetitionCard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '../common/Button';
import { RepetitionItem } from './RepetitionReview';

interface RepetitionCardProps {
  repetition: RepetitionItem;
  videoDuration: number;
  isVerified: boolean;
  onVerify: (verified: boolean) => void;
}

export const RepetitionCard: React.FC<RepetitionCardProps> = ({
  repetition,
  videoDuration,
  isVerified,
  onVerify,
}) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConfidenceColor = () => {
    switch (repetition.confidence) {
      case 'high':
        return 'text-dark-error';
      case 'medium':
        return 'text-dark-warning';
      case 'low':
        return 'text-dark-text-tertiary';
      default:
        return 'text-dark-text-tertiary';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-lg border ${
        isVerified
          ? 'bg-dark-success/10 border-dark-success/50'
          : 'bg-dark-bg-tertiary border-dark-border'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={`text-xs font-semibold uppercase ${getConfidenceColor()}`}>
              {repetition.confidence} confidence
            </div>
            <div className="text-xs text-dark-text-tertiary">
              {Math.round(repetition.similarityScore * 100)}% similar
            </div>
          </div>
          <div className="text-sm text-dark-text-primary mb-1">
            First occurrence: {formatTime(repetition.firstOccurrence.start)} - {formatTime(repetition.firstOccurrence.end)}
          </div>
          <div className="text-xs text-dark-text-tertiary">
            {repetition.repetitions.length} repetition{repetition.repetitions.length !== 1 ? 's' : ''} found
          </div>
        </div>
        {isVerified && (
          <div className="w-5 h-5 bg-dark-success rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Repetition Times */}
      <div className="space-y-1 mb-3">
        {repetition.repetitions.map((rep, index) => (
          <div key={index} className="text-xs text-dark-text-tertiary pl-4">
            Repetition {index + 1}: {formatTime(rep.start)} - {formatTime(rep.end)}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          onClick={() => onVerify(!isVerified)}
          variant={isVerified ? 'primary' : 'ghost'}
          size="sm"
          className={isVerified ? '' : 'text-dark-text-secondary'}
        >
          {isVerified ? 'Verified' : 'Mark as Verified'}
        </Button>
        <Button
          onClick={() => onVerify(false)}
          variant="ghost"
          size="sm"
          className="text-dark-error hover:text-dark-error"
        >
          False Positive
        </Button>
      </div>
    </motion.div>
  );
};
