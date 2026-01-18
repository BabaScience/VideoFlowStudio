// src/renderer/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { useVideoStore } from '../stores/video-store';
import { useUIStore } from '../stores/ui-store';

export const useKeyboardShortcuts = () => {
  const { importVideos, getSelectedVideo } = useVideoStore();
  const { setView } = useUIStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+O: Import Video
      if ((event.metaKey || event.ctrlKey) && event.key === 'o') {
        event.preventDefault();
        importVideos();
      }

      // Cmd+P: Process Selected Video
      if ((event.metaKey || event.ctrlKey) && event.key === 'p') {
        event.preventDefault();
        const selectedVideo = getSelectedVideo();
        if (selectedVideo) {
          // Switch to processing view
          setView('processing');
        }
      }

      // Space: Play/Pause Preview (only when not in input/textarea)
      if (event.key === ' ' && 
          event.target instanceof HTMLElement &&
          event.target.tagName !== 'INPUT' &&
          event.target.tagName !== 'TEXTAREA') {
        event.preventDefault();
        // Trigger play/pause on video element if preview is open
        const videoElement = document.querySelector('video');
        if (videoElement) {
          if (videoElement.paused) {
            videoElement.play();
          } else {
            videoElement.pause();
          }
        }
      }

      // Cmd+1: Videos view
      if ((event.metaKey || event.ctrlKey) && event.key === '1') {
        event.preventDefault();
        setView('videos');
      }

      // Cmd+2: Queue view
      if ((event.metaKey || event.ctrlKey) && event.key === '2') {
        event.preventDefault();
        setView('queue');
      }

      // Cmd+3: Processing view
      if ((event.metaKey || event.ctrlKey) && event.key === '3') {
        event.preventDefault();
        setView('processing');
      }

      // Cmd+4: Output view
      if ((event.metaKey || event.ctrlKey) && event.key === '4') {
        event.preventDefault();
        setView('output');
      }

      // Cmd+,: Settings
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        setView('settings');
      }

      // Cmd+W: Close Window (macOS) - handled by Electron
      // Cmd+Q: Quit Application - handled by Electron
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [importVideos, setView, getSelectedVideo]);
};
