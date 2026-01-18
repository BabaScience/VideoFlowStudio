// src/renderer/types/electron.d.ts
import type { ElectronAPI } from '../../preload/index';

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

export {};
