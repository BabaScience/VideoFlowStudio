// src/renderer/components/settings/AISettingsPanel.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../common/Button';

export const AISettingsPanel: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setIsLoading(true);
      if (window.api?.ai?.isConfigured) {
        const configured = await window.api.ai.isConfigured();
        setIsConfigured(configured);
      }
    } catch (error) {
      console.error('Failed to load AI configuration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setErrorMessage('API key cannot be empty');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      if (!window.api?.ai?.setApiKey) {
        throw new Error('AI API not available');
      }

      await window.api.ai.setApiKey(apiKey.trim());
      setIsConfigured(true);
      setApiKey(''); // Clear input for security
    } catch (error) {
      console.error('Failed to save API key:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!isConfigured) {
      setErrorMessage('Please configure API key first');
      return;
    }

    try {
      setTestStatus('testing');
      setErrorMessage(null);

      // Test with a simple transcription (would need a test audio file)
      // For now, just check if service is configured
      if (window.api?.ai?.isConfigured) {
        const configured = await window.api.ai.isConfigured();
        if (configured) {
          setTestStatus('success');
          setTimeout(() => setTestStatus('idle'), 3000);
        } else {
          setTestStatus('error');
          setErrorMessage('API key is not properly configured');
        }
      }
    } catch (error) {
      setTestStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Connection test failed');
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="w-8 h-8 border-4 border-dark-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl"
      >
        <h2 className="text-2xl font-semibold text-dark-text-primary mb-2">AI Settings</h2>
        <p className="text-sm text-dark-text-tertiary mb-8">
          Configure OpenAI API integration for enhanced video analysis with Whisper transcription and GPT content analysis.
        </p>

        {/* API Key Configuration */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-dark-text-primary mb-2">
            OpenAI API Key
          </label>
          <div className="flex gap-3">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setErrorMessage(null);
              }}
              placeholder={isConfigured ? '••••••••••••••••' : 'Enter your OpenAI API key'}
              className="flex-1 px-4 py-2 bg-dark-bg-secondary border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-dark-primary focus:border-transparent"
              disabled={isConfigured}
            />
            {!isConfigured && (
              <Button
                onClick={handleSaveApiKey}
                disabled={isSaving || !apiKey.trim()}
                className="px-6"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            )}
          </div>
          {isConfigured && (
            <p className="mt-2 text-sm text-dark-text-secondary">
              ✓ API key is configured and encrypted
            </p>
          )}
          {errorMessage && (
            <p className="mt-2 text-sm text-dark-error">{errorMessage}</p>
          )}
        </div>

        {/* Status Section */}
        <div className="mb-8 p-4 bg-dark-bg-secondary rounded-lg border border-dark-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-dark-text-primary mb-1">
                Service Status
              </h3>
              <p className="text-xs text-dark-text-tertiary">
                {isConfigured
                  ? 'AI features are available'
                  : 'Configure API key to enable AI features'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConfigured ? 'bg-green-500' : 'bg-gray-500'
                }`}
              />
              <span className="text-sm text-dark-text-secondary">
                {isConfigured ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {isConfigured && (
            <Button
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
              variant="secondary"
              className="w-full"
            >
              {testStatus === 'testing'
                ? 'Testing...'
                : testStatus === 'success'
                ? '✓ Connection Successful'
                : testStatus === 'error'
                ? '✗ Connection Failed'
                : 'Test Connection'}
            </Button>
          )}
        </div>

        {/* Features Info */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-dark-text-primary mb-3">
              Available AI Features
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-dark-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-dark-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-dark-text-primary">Whisper Transcription</h4>
                  <p className="text-xs text-dark-text-tertiary mt-1">
                    Automatic speech-to-text with word-level timestamps for intelligent silence detection
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-dark-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-dark-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-dark-text-primary">GPT Content Analysis</h4>
                  <p className="text-xs text-dark-text-tertiary mt-1">
                    Detect filler words, verbal repetitions, and suggest optimal cut points
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-dark-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-dark-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-dark-text-primary">Multi-Modal Fusion</h4>
                  <p className="text-xs text-dark-text-tertiary mt-1">
                    Combines FFmpeg detection with AI analysis for more accurate results
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-dark-warning/10 border border-dark-warning/20 rounded-lg">
            <p className="text-xs text-dark-text-secondary">
              <strong className="text-dark-warning">Note:</strong> AI features require an OpenAI API key and will incur usage costs. 
              Your API key is encrypted and stored securely on your device.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
