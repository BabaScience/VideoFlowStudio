// src/preload/index.ts
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Whitelist of allowed IPC channels
const ALLOWED_CHANNELS = {
  invoke: [
    'video:import',
    'video:list',
    'video:metadata',
    'video:delete',
    'video:process-silence',
    'video:process-repetition',
    'video:export',
    'video:segments',
    'job:list',
    'job:status',
    'job:cancel',
    'job:delete',
    'job:segments',
    'video:segments',
    'segment:verify',
    'preferences:get',
    'preferences:set',
    'preferences:getAll',
    'preferences:selectOutputDirectory',
    'output:list',
    'output:get',
    'output:delete',
  ],
  on: [
    'job:progress',
    'job:started',
    'job:completed',
    'job:failed',
    'job:cancelled',
  ],
};

// Type-safe API exposed to renderer
export interface ElectronAPI {
  video: {
    import: () => Promise<any[]>;
    list: () => Promise<any[]>;
    metadata: (videoId: string) => Promise<any>;
    delete: (videoId: string) => Promise<void>;
    processSilence: (videoId: string, config: any) => Promise<any>;
    processRepetition: (videoId: string, config: any) => Promise<any>;
    export: (jobId: string) => Promise<string | null>;
    segments: (videoId: string) => Promise<any[]>;
  };
  job: {
    list: () => Promise<any[]>;
    status: (jobId: string) => Promise<any>;
    cancel: (jobId: string) => Promise<void>;
    delete: (jobId: string) => Promise<void>;
    segments: (jobId: string) => Promise<any[]>;
  };
  segment: {
    verify: (segmentId: string, verified: boolean) => Promise<void>;
  };
  preferences: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    getAll: () => Promise<Record<string, string>>;
    selectOutputDirectory: () => Promise<string | null>;
  };
  output: {
    list: () => Promise<any[]>;
    get: (jobId: string) => Promise<any | null>;
    delete: (jobId: string) => Promise<void>;
  };
  on: (channel: string, callback: (...args: any[]) => void) => void;
  removeListener: (channel: string, callback: (...args: any[]) => void) => void;
}

// Expose protected API to renderer process
contextBridge.exposeInMainWorld('api', {
  video: {
    import: () => ipcRenderer.invoke('video:import'),
    list: () => ipcRenderer.invoke('video:list'),
    metadata: (videoId: string) => ipcRenderer.invoke('video:metadata', videoId),
    delete: (videoId: string) => ipcRenderer.invoke('video:delete', videoId),
    processSilence: (videoId: string, config: any) =>
      ipcRenderer.invoke('video:process-silence', videoId, config),
    processRepetition: (videoId: string, config: any) =>
      ipcRenderer.invoke('video:process-repetition', videoId, config),
    export: (jobId: string) => ipcRenderer.invoke('video:export', jobId),
    segments: (videoId: string) => ipcRenderer.invoke('video:segments', videoId),
  },

  job: {
    list: () => ipcRenderer.invoke('job:list'),
    status: (jobId: string) => ipcRenderer.invoke('job:status', jobId),
    cancel: (jobId: string) => ipcRenderer.invoke('job:cancel', jobId),
    delete: (jobId: string) => ipcRenderer.invoke('job:delete', jobId),
    segments: (jobId: string) => ipcRenderer.invoke('job:segments', jobId),
  },
  segment: {
    verify: (segmentId: string, verified: boolean) => ipcRenderer.invoke('segment:verify', segmentId, verified),
  },
  preferences: {
    get: (key: string) => ipcRenderer.invoke('preferences:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('preferences:set', key, value),
    getAll: () => ipcRenderer.invoke('preferences:getAll'),
    selectOutputDirectory: () => ipcRenderer.invoke('preferences:selectOutputDirectory'),
  },
  output: {
    list: () => ipcRenderer.invoke('output:list'),
    get: (jobId: string) => ipcRenderer.invoke('output:get', jobId),
    delete: (jobId: string) => ipcRenderer.invoke('output:delete', jobId),
  },

  on: (channel: string, callback: (...args: any[]) => void) => {
    if (ALLOWED_CHANNELS.on.includes(channel)) {
      const subscription = (_event: IpcRendererEvent, ...args: any[]) =>
        callback(...args);
      ipcRenderer.on(channel, subscription);
    } else {
      console.warn(`Attempted to subscribe to unauthorized channel: ${channel}`);
    }
  },

  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    if (ALLOWED_CHANNELS.on.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },
} as ElectronAPI);

// Type declaration for window object
declare global {
  interface Window {
    api: ElectronAPI;
  }
}
