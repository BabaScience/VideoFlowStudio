// src/renderer/components/processing/RepetitionReview.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../common/Button';
import { RepetitionCard } from './RepetitionCard';

export interface RepetitionItem {
  id: string;
  firstOccurrence: { start: number; end: number };
  repetitions: Array<{ start: number; end: number }>;
  similarityScore: number;
  confidence: 'high' | 'medium' | 'low';
  userVerified?: boolean;
}

interface RepetitionReviewProps {
  repetitions: RepetitionItem[];
  videoDuration: number;
  onVerify: (id: string, verified: boolean) => Promise<void>;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RepetitionReview: React.FC<RepetitionReviewProps> = ({
  repetitions,
  videoDuration,
  onVerify,
  onConfirm,
  onCancel,
}) => {
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());

  const handleVerify = async (id: string, verified: boolean) => {
    await onVerify(id, verified);
    setVerifiedIds(prev => {
      const next = new Set(prev);
      if (verified) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const verifiedCount = verifiedIds.size;
  const totalRepetitions = repetitions.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-bg-secondary rounded-xl border border-dark-border p-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-dark-text-primary mb-2">
          Review Detected Repetitions
        </h3>
        <p className="text-sm text-dark-text-tertiary">
          Review and verify detected repetitive segments. Mark false positives to exclude them from processing.
        </p>
        <div className="mt-3 text-sm text-dark-text-secondary">
          {verifiedCount} of {totalRepetitions} verified
        </div>
      </div>

      {/* Repetition List */}
      <div className="space-y-3 mb-6 max-h-96 overflow-auto">
        <AnimatePresence>
          {repetitions.map((repetition) => (
            <RepetitionCard
              key={repetition.id}
              repetition={repetition}
              videoDuration={videoDuration}
              isVerified={verifiedIds.has(repetition.id)}
              onVerify={(verified) => handleVerify(repetition.id, verified)}
            />
          ))}
        </AnimatePresence>

        {repetitions.length === 0 && (
          <div className="text-center py-8 text-dark-text-tertiary">
            No repetitions detected
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          onClick={onCancel}
          variant="ghost"
          size="md"
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="primary"
          size="md"
        >
          Continue Processing
        </Button>
      </div>
    </motion.div>
  );
};
