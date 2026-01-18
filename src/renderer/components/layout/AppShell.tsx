// src/renderer/components/layout/AppShell.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { useUIStore } from '../../stores/ui-store';
import { StatusBar } from './StatusBar';
import { ProgressNotification } from '../common/ProgressNotification';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { sidebarOpen, currentView, setView } = useUIStore();

  const navItems = [
    { id: 'videos', label: 'Videos', icon: '📹' },
    { id: 'queue', label: 'Queue', icon: '⏳' },
    { id: 'processing', label: 'Processing', icon: '⚙️' },
    { id: 'output', label: 'Output', icon: '📤' },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-dark-bg-primary text-dark-text-primary overflow-hidden font-system">
      {/* Toolbar - 72px height */}
      <header className="h-[72px] bg-dark-bg-secondary border-b border-dark-divider flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-dark-primary to-dark-secondary flex items-center justify-center">
              <span className="text-white text-sm font-semibold">VF</span>
            </div>
            <h1 className="text-lg font-semibold text-dark-text-primary">VideoFlow Studio</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setView('settings')}
            className={`px-3 py-1.5 text-sm rounded-md transition-all duration-200 ${
              currentView === 'settings'
                ? 'text-dark-text-primary bg-dark-bg-tertiary'
                : 'text-dark-text-secondary hover:text-dark-text-primary hover:bg-dark-bg-tertiary'
            }`}
          >
            Settings
          </button>
          <button className="px-3 py-1.5 text-sm text-dark-text-secondary hover:text-dark-text-primary hover:bg-dark-bg-tertiary rounded-md transition-all duration-200">
            Help
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - 200px width */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarOpen ? 200 : 0 }}
          className="bg-dark-bg-secondary border-r border-dark-divider overflow-hidden flex-shrink-0"
        >
          <div className="p-4 h-full">
            <nav className="space-y-1">
              {navItems.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => setView(item.id as any)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full text-left px-4 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-3 ${
                    currentView === item.id
                      ? 'bg-dark-primary text-white shadow-lg shadow-dark-primary/20'
                      : 'text-dark-text-secondary hover:text-dark-text-primary hover:bg-dark-bg-tertiary'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                </motion.button>
              ))}
            </nav>
          </div>
        </motion.aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-dark-bg-primary">
          {children}
        </main>
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Progress Notification - Bottom Right */}
      <ProgressNotification />
    </div>
  );
};
