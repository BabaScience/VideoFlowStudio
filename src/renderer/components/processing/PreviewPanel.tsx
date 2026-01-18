// src/renderer/components/processing/PreviewPanel.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../common/Button';
import { Timeline } from '../timeline/Timeline';

export interface DetectedSegment {
  id: string;
  startTime: number;
  endTime: number;
  type: 'silence' | 'repetition';
  confidence?: number;
  duration: number;
}

interface PreviewPanelProps {
  segments: DetectedSegment[];
  videoDuration: number;
  onConfirm: () => void;
  onCancel: () => void;
  onModify?: (segmentId: string, changes: Partial<DetectedSegment>) => void;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  segments,
  videoDuration,
  onConfirm,
  onCancel,
  onModify,
}) => {
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);

  const silenceSegments = segments.filter(s => s.type === 'silence');
  const repetitionSegments = segments.filter(s => s.type === 'repetition');

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalTimeToRemove = segments.reduce((sum, seg) => sum + seg.duration, 0);
  const timeSavedPercent = videoDuration > 0 ? (totalTimeToRemove / videoDuration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-dark-bg-secondary rounded-xl border border-dark-border p-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-dark-text-primary mb-2">
          Preview Detected Segments
        </h3>
        <p className="text-sm text-dark-text-tertiary">
          Review the detected segments before processing. You can modify or exclude segments.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-dark-bg-tertiary rounded-lg p-3">
          <div className="text-xs text-dark-text-tertiary mb-1">Silence Segments</div>
          <div className="text-xl font-semibold text-dark-text-primary">{silenceSegments.length}</div>
        </div>
        <div className="bg-dark-bg-tertiary rounded-lg p-3">
          <div className="text-xs text-dark-text-tertiary mb-1">Repetition Segments</div>
          <div className="text-xl font-semibold text-dark-text-primary">{repetitionSegments.length}</div>
        </div>
        <div className="bg-dark-bg-tertiary rounded-lg p-3">
          <div className="text-xs text-dark-text-tertiary mb-1">Time Saved</div>
          <div className="text-xl font-semibold text-dark-success">
            {formatTime(totalTimeToRemove)} ({timeSavedPercent.toFixed(1)}%)
          </div>
        </div>
      </div>

      {/* Timeline Preview */}
      <div className="mb-6">
        <Timeline
          duration={videoDuration}
          segments={segments.map(s => ({
            id: s.id,
            startTime: s.startTime,
            endTime: s.endTime,
            type: s.type,
            confidence: s.confidence,
          }))}
          playbackPosition={playbackPosition}
          onSeek={setPlaybackPosition}
          zoom={1}
        />
      </div>

      {/* Segment List */}
      <div className="space-y-2 mb-6 max-h-64 overflow-auto">
        <AnimatePresence>
          {segments.map((segment) => (
            <motion.div
              key={segment.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedSegment === segment.id
                  ? 'bg-dark-primary/20 border-dark-primary'
                  : 'bg-dark-bg-tertiary border-dark-border hover:border-dark-primary/50'
              }`}
              onClick={() => setSelectedSegment(segment.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      segment.type === 'silence'
                        ? 'bg-dark-error'
                        : 'bg-dark-warning'
                    }`}
                  />
                  <div>
                    <div className="text-sm font-medium text-dark-text-primary capitalize">
                      {segment.type}
                    </div>
                    <div className="text-xs text-dark-text-tertiary">
                      {formatTime(segment.startTime)} - {formatTime(segment.endTime)} ({formatTime(segment.duration)})
                    </div>
                  </div>
                </div>
                {segment.confidence !== undefined && (
                  <div className="text-xs text-dark-text-tertiary">
                    {Math.round(segment.confidence * 100)}% confidence
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
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
          Process Video
        </Button>
      </div>
    </motion.div>
  );
};
