// src/renderer/components/timeline/TimelineControls.tsx
import React from 'react';
import { Button } from '../common/Button';

interface TimelineControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFitToWindow: () => void;
}

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitToWindow,
}) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onZoomOut}
        disabled={zoom <= 0.25}
        className="text-dark-text-tertiary hover:text-dark-text-primary"
        aria-label="Zoom Out"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
        </svg>
      </Button>

      <span className="text-xs text-dark-text-tertiary min-w-[3rem] text-center">
        {Math.round(zoom * 100)}%
      </span>

      <Button
        variant="ghost"
        size="sm"
        onClick={onZoomIn}
        disabled={zoom >= 4}
        className="text-dark-text-tertiary hover:text-dark-text-primary"
        aria-label="Zoom In"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
        </svg>
      </Button>

      <div className="w-px h-4 bg-dark-border mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={onZoomReset}
        className="text-dark-text-tertiary hover:text-dark-text-primary text-xs"
        aria-label="Reset Zoom"
      >
        Reset
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onFitToWindow}
        className="text-dark-text-tertiary hover:text-dark-text-primary text-xs"
        aria-label="Fit to Window"
      >
        Fit
      </Button>
    </div>
  );
};
