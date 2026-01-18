// src/renderer/components/video/DropZone.tsx
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DropZoneProps {
  onFilesDropped: (files: File[]) => void;
  children: React.ReactNode;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFilesDropped, children }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragging(false);
      }
      return newCount;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const files: File[] = [];
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        // Filter for video files
        if (file.type.startsWith('video/') || 
            ['.mp4', '.mov', '.avi', '.mkv', '.webm'].some(ext => 
              file.name.toLowerCase().endsWith(ext)
            )) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      onFilesDropped(files);
    }
  }, [onFilesDropped]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative"
    >
      {children}
      
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-dark-primary/20 backdrop-blur-sm flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-dark-bg-secondary rounded-2xl border-2 border-dashed border-dark-primary p-12 max-w-md mx-4"
            >
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="w-20 h-20 bg-dark-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                >
                  <svg className="w-10 h-10 text-dark-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </motion.div>
                <h3 className="text-xl font-semibold text-dark-text-primary mb-2">
                  Drop Video Files Here
                </h3>
                <p className="text-sm text-dark-text-tertiary">
                  Release to import videos
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
