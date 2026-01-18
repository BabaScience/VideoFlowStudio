// src/renderer/components/processing/SegmentEditor.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../common/Button';

interface SegmentEditorProps {
  segment: {
    id: string;
    startTime: number;
    endTime: number;
    type: 'silence' | 'repetition';
    confidence?: number;
  };
  videoDuration: number;
  onSave: (changes: { startTime: number; endTime: number }) => void;
  onCancel: () => void;
  onDelete: () => void;
}

export const SegmentEditor: React.FC<SegmentEditorProps> = ({
  segment,
  videoDuration,
  onSave,
  onCancel,
  onDelete,
}) => {
  const [startTime, setStartTime] = useState(segment.startTime);
  const [endTime, setEndTime] = useState(segment.endTime);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSave = () => {
    if (startTime >= 0 && endTime <= videoDuration && startTime < endTime) {
      onSave({ startTime, endTime });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-dark-bg-secondary rounded-xl border border-dark-border p-6"
    >
      <h4 className="text-md font-semibold text-dark-text-primary mb-4">
        Edit Segment
      </h4>

      <div className="space-y-4 mb-6">
        <div>
          <label className="text-sm font-medium text-dark-text-secondary mb-2 block">
            Start Time (seconds)
          </label>
          <input
            type="number"
            min="0"
            max={videoDuration}
            step="0.1"
            value={startTime}
            onChange={(e) => setStartTime(Math.max(0, Math.min(videoDuration, parseFloat(e.target.value) || 0)))}
            className="w-full px-3 py-2 bg-dark-bg-tertiary border border-dark-border rounded-lg text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-dark-primary"
          />
          <div className="text-xs text-dark-text-tertiary mt-1">
            {formatTime(startTime)}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-dark-text-secondary mb-2 block">
            End Time (seconds)
          </label>
          <input
            type="number"
            min="0"
            max={videoDuration}
            step="0.1"
            value={endTime}
            onChange={(e) => setEndTime(Math.max(0, Math.min(videoDuration, parseFloat(e.target.value) || 0)))}
            className="w-full px-3 py-2 bg-dark-bg-tertiary border border-dark-border rounded-lg text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-dark-primary"
          />
          <div className="text-xs text-dark-text-tertiary mt-1">
            {formatTime(endTime)}
          </div>
        </div>

        <div className="bg-dark-bg-tertiary rounded-lg p-3">
          <div className="text-xs text-dark-text-tertiary mb-1">Duration</div>
          <div className="text-sm font-semibold text-dark-text-primary">
            {formatTime(endTime - startTime)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          onClick={onDelete}
          variant="ghost"
          size="sm"
          className="text-dark-error hover:text-dark-error"
        >
          Delete
        </Button>
        <div className="flex gap-2">
          <Button
            onClick={onCancel}
            variant="ghost"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="primary"
            size="sm"
            disabled={startTime >= endTime || startTime < 0 || endTime > videoDuration}
          >
            Save
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
