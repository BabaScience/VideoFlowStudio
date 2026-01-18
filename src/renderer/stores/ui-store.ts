// src/renderer/stores/ui-store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

type ViewType = 'videos' | 'queue' | 'processing' | 'settings' | 'output';

interface UIStore {
  currentView: ViewType;
  sidebarOpen: boolean;
  darkMode: boolean;

  // Actions
  setView: (view: ViewType) => void;
  toggleSidebar: () => void;
  setDarkMode: (enabled: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  devtools(
    (set) => ({
      currentView: 'videos',
      sidebarOpen: true,
      darkMode: false,

      setView: (view) => {
        set({ currentView: view });
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },

      setDarkMode: (enabled) => {
        set({ darkMode: enabled });
      },
    }),
    { name: 'UIStore' }
  )
);
