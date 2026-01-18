// src/renderer/components/processing/ProcessingPanel.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useVideoStore } from '../../stores/video-store';
import { useJobStore, JobType } from '../../stores/job-store';
import { Button } from '../common/Button';

export const ProcessingPanel: React.FC = () => {
  const { getSelectedVideo } = useVideoStore();
  const { createJob } = useJobStore();
  const selectedVideo = getSelectedVideo();

  const [silenceConfig, setSilenceConfig] = useState({
    thresholdDb: -40,
    minDuration: 2,
    paddingBefore: 0.5,
    paddingAfter: 0.5,
    detectAudioOnly: false,
  });

  const [repetitionConfig, setRepetitionConfig] = useState({
    similarityThreshold: 0.8,
    minRepetitionLength: 1,
    samplingInterval: 5,
  });

  const handleSilenceRemoval = async () => {
    if (!selectedVideo) return;
    await createJob(JobType.SILENCE_REMOVAL, selectedVideo.id, silenceConfig);
  };

  const handleRepetitionDetection = async () => {
    if (!selectedVideo) return;
    await createJob(JobType.REPETITION_DETECTION, selectedVideo.id, repetitionConfig);
  };

  if (!selectedVideo) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 bg-dark-bg-tertiary rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-dark-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-dark-text-primary mb-2">No video selected</h3>
          <p className="text-dark-text-tertiary">
            Please select a video from the library to configure processing options.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-dark-divider">
        <h2 className="text-2xl font-semibold text-dark-text-primary mb-1">Processing Configuration</h2>
        <p className="text-sm text-dark-text-tertiary">{selectedVideo.filename}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl space-y-6">
          {/* Silence Removal */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-bg-secondary rounded-xl p-6 border border-dark-border"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-dark-primary/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-dark-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-dark-text-primary">Silence Removal</h3>
                <p className="text-sm text-dark-text-tertiary">Remove silent segments from your video</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-dark-text-secondary">
                    Threshold
                  </label>
                  <span className="text-sm text-dark-text-primary font-medium">
                    {silenceConfig.thresholdDb} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="-20"
                  value={silenceConfig.thresholdDb}
                  onChange={(e) =>
                    setSilenceConfig({
                      ...silenceConfig,
                      thresholdDb: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-dark-bg-tertiary rounded-lg appearance-none cursor-pointer accent-dark-primary"
                />
                <div className="flex justify-between text-xs text-dark-text-tertiary mt-1">
                  <span>-50 dB</span>
                  <span>-20 dB</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-dark-text-secondary">
                    Minimum Duration
                  </label>
                  <span className="text-sm text-dark-text-primary font-medium">
                    {silenceConfig.minDuration}s
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={silenceConfig.minDuration}
                  onChange={(e) =>
                    setSilenceConfig({
                      ...silenceConfig,
                      minDuration: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-dark-bg-tertiary rounded-lg appearance-none cursor-pointer accent-dark-primary"
                />
                <div className="flex justify-between text-xs text-dark-text-tertiary mt-1">
                  <span>0.5s</span>
                  <span>10s</span>
                </div>
              </div>

              <Button
                onClick={handleSilenceRemoval}
                variant="primary"
                size="md"
                className="w-full"
              >
                Process Silence Removal
              </Button>
            </div>
          </motion.div>

          {/* Repetition Detection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-bg-secondary rounded-xl p-6 border border-dark-border"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-dark-secondary/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-dark-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-dark-text-primary">Repetition Detection</h3>
                <p className="text-sm text-dark-text-tertiary">Detect and remove repetitive segments</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-dark-text-secondary">
                    Similarity Threshold
                  </label>
                  <span className="text-sm text-dark-text-primary font-medium">
                    {Math.round(repetitionConfig.similarityThreshold * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="0.95"
                  step="0.05"
                  value={repetitionConfig.similarityThreshold}
                  onChange={(e) =>
                    setRepetitionConfig({
                      ...repetitionConfig,
                      similarityThreshold: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-dark-bg-tertiary rounded-lg appearance-none cursor-pointer accent-dark-secondary"
                />
                <div className="flex justify-between text-xs text-dark-text-tertiary mt-1">
                  <span>60%</span>
                  <span>95%</span>
                </div>
              </div>

              <Button
                onClick={handleRepetitionDetection}
                variant="primary"
                size="md"
                className="w-full"
              >
                Process Repetition Detection
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
