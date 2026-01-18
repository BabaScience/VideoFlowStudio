// src/renderer/components/settings/SettingsPanel.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../common/Button';
import { AISettingsPanel } from './AISettingsPanel';

export const SettingsPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'ai'>('general');
  const [preferences, setPreferences] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      if (!window.api?.preferences?.getAll) {
        console.error('Preferences API not available');
        setIsLoading(false);
        return;
      }
      const prefs = await window.api.preferences.getAll();
      setPreferences(prefs);
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = async (key: string, value: string) => {
    try {
      if (!window.api?.preferences?.set) {
        console.error('Preferences API not available');
        return;
      }
      await window.api.preferences.set(key, value);
      setPreferences(prev => ({ ...prev, [key]: value }));
    } catch (error) {
      console.error('Failed to update preference:', error);
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading settings...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with Tabs */}
      <div className="px-8 pt-8 pb-4 border-b border-dark-divider">
        <h2 className="text-2xl font-semibold text-dark-text-primary mb-4">Settings</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'general'
                ? 'bg-dark-primary text-white'
                : 'text-dark-text-secondary hover:text-dark-text-primary hover:bg-dark-bg-tertiary'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'ai'
                ? 'bg-dark-primary text-white'
                : 'text-dark-text-secondary hover:text-dark-text-primary hover:bg-dark-bg-tertiary'
            }`}
          >
            AI Features
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'ai' ? (
          <AISettingsPanel />
        ) : (
          <div className="p-8">
            <div className="space-y-6">
        <SettingsSection title="Output" description="Configure output preferences">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-dark-text-secondary mb-2 block">
                Default Output Directory
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={preferences.outputDirectory || ''}
                  onChange={(e) => updatePreference('outputDirectory', e.target.value)}
                  className="flex-1 px-3 py-2 bg-dark-bg-tertiary border border-dark-border rounded-lg text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-dark-primary"
                  placeholder="~/Desktop/VideoFlow Output"
                />
                <Button
                  onClick={async () => {
                    try {
                      if (!window.api?.preferences?.selectOutputDirectory) {
                        console.error('Select directory API not available');
                        return;
                      }
                      const selectedPath = await window.api.preferences.selectOutputDirectory();
                      if (selectedPath) {
                        await updatePreference('outputDirectory', selectedPath);
                      }
                    } catch (error) {
                      console.error('Failed to select output directory:', error);
                    }
                  }}
                  variant="secondary"
                  size="md"
                  className="whitespace-nowrap"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Browse
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Processing" description="Default processing settings">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-dark-text-secondary mb-2 block">
                Silence Detection Threshold (dB)
              </label>
              <input
                type="number"
                value={preferences.silenceThreshold || '-30'}
                onChange={(e) => updatePreference('silenceThreshold', e.target.value)}
                className="w-full px-3 py-2 bg-dark-bg-tertiary border border-dark-border rounded-lg text-dark-text-primary"
              />
            </div>
          </div>
        </SettingsSection>
      </div>
    </div>
        )}
      </div>
    </div>
  );
};

const SettingsSection: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-dark-bg-secondary rounded-xl border border-dark-border p-6"
  >
    <h3 className="text-lg font-semibold text-dark-text-primary mb-1">{title}</h3>
    <p className="text-sm text-dark-text-tertiary mb-4">{description}</p>
    {children}
  </motion.div>
);
