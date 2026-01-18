// src/renderer/App.tsx
import React, { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { VideoLibrary } from './components/video/VideoLibrary';
import { ProcessingPanel } from './components/processing/ProcessingPanel';
import { QueueMonitor } from './components/processing/QueueMonitor';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { OutputPanel } from './components/output/OutputPanel';
import { useVideoStore } from './stores/video-store';
import { useJobStore } from './stores/job-store';
import { useUIStore } from './stores/ui-store';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const App: React.FC = () => {
  const { loadVideos } = useVideoStore();
  const { loadJobs, subscribeToJobUpdates } = useJobStore();
  const { currentView } = useUIStore();

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  useEffect(() => {
    // Load initial data
    loadVideos();
    loadJobs();

    // Subscribe to job updates
    const unsubscribe = subscribeToJobUpdates();

    return () => {
      unsubscribe();
    };
  }, []);

  const renderMainContent = () => {
    switch (currentView) {
      case 'videos':
        return <VideoLibrary />;
      case 'queue':
        return <QueueMonitor />;
      case 'processing':
        return <ProcessingPanel />;
      case 'settings':
        return <SettingsPanel />;
      case 'output':
        return <OutputPanel />;
      default:
        return <VideoLibrary />;
    }
  };

  return (
    <ErrorBoundary>
      <AppShell>
      {renderMainContent()}
    </AppShell>
    </ErrorBoundary>
  );
};

export default App;
