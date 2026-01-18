// src/main/index.ts
import { app, BrowserWindow, ipcMain, dialog, protocol, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { VideoService } from './services/video-service';
import { JobService } from './services/job-service';
import { SegmentService } from './services/segment-service';
import { OutputService } from './services/output-service';
import { QueueManager } from './queue/queue-manager';
import { DatabaseConnection } from './database/connection';

// __dirname is available in CommonJS (Electron main process compiles to CommonJS)
// Declare it for TypeScript, but don't assign - it's provided by Node.js at runtime
declare const __dirname: string;

class VideoFlowStudioApp {
  private mainWindow: BrowserWindow | null = null;
  private queueManager!: QueueManager;
  private videoService!: VideoService;
  private jobService!: JobService;

  constructor() {
    // Register protocol handler - must be called before app.whenReady()
    this.registerLocalFileProtocol();
    this.initializeApp();
  }

  private registerLocalFileProtocol(): void {
    // Register protocol handler
    const registerProtocol = () => {
      protocol.registerFileProtocol('local', (request, callback) => {
        const url = request.url;
        // Remove protocol prefix: local://
        const filePath = decodeURIComponent(url.replace('local://', ''));
        
        // Security: Validate path to prevent directory traversal
        if (!filePath || filePath.includes('..')) {
          callback({ error: -324 }); // ERR_FILE_NOT_FOUND
          return;
        }

        // Normalize path
        const normalizedPath = path.normalize(filePath);

        // Check if file exists
        try {
          if (fs.existsSync(normalizedPath)) {
            callback({ path: normalizedPath });
          } else {
            console.warn(`File not found: ${normalizedPath}`);
            callback({ error: -324 }); // ERR_FILE_NOT_FOUND
          }
        } catch (error) {
          console.error(`Error accessing file ${normalizedPath}:`, error);
          callback({ error: -324 });
        }
      });
      console.log('✓ Local file protocol registered');
    };

    // Register immediately if app is ready, otherwise wait for ready event
    if (app.isReady()) {
      registerProtocol();
    } else {
      app.once('ready', registerProtocol);
    }
  }

  private async initializeApp(): Promise<void> {
    await app.whenReady();
    
    // Initialize database
    await DatabaseConnection.initialize();
    
    // Initialize services
    this.queueManager = new QueueManager();
    await this.queueManager.initialize();
    
    // Forward queue events to renderer
    this.setupQueueEventForwarding();
    
    this.videoService = new VideoService();
    this.jobService = new JobService(this.queueManager);
    
    // Setup IPC handlers
    // Setup IPC handlers (async)
    this.setupIPCHandlers().catch(console.error);
    
    // Create main window
    this.createMainWindow();
    
    // App lifecycle handlers
    this.setupAppLifecycle();
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 700,
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#1C1C1E',
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        preload: path.join(__dirname, '../preload/index.js'),
        allowRunningInsecureContent: false,
      },
    });

    // Load the application
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Security: Prevent navigation
    this.mainWindow.webContents.on('will-navigate', (event) => {
      event.preventDefault();
    });

    // Security: Disable new window creation
    this.mainWindow.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });

    // Content Security Policy
    this.setupContentSecurityPolicy();
  }

  private setupContentSecurityPolicy(): void {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' local: data:; " +
            "media-src 'self' local: data:; " +
            "font-src 'self' data:; " +
            "connect-src 'self';"
          ],
        },
      });
    });
  }

  private async setupIPCHandlers(): Promise<void> {
    // Video Import
    ipcMain.handle('video:import', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'Videos',
            extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
          },
        ],
      });

      if (result.canceled) return null;

      try {
        const videos = await Promise.all(
          result.filePaths.map((filePath) =>
            this.videoService.importVideo(filePath)
          )
        );
        return videos;
      } catch (error) {
        console.error('Video import failed:', error);
        throw error;
      }
    });

    // Get Video Metadata
    ipcMain.handle('video:metadata', async (_, videoId: string) => {
      return await this.videoService.getMetadata(videoId);
    });

    // Process Video - Silence Removal
    ipcMain.handle(
      'video:process-silence',
      async (_, videoId: string, config: any) => {
        const job = await this.jobService.createSilenceRemovalJob(
          videoId,
          config
        );
        return job;
      }
    );

    // Process Video - Repetition Detection
    ipcMain.handle(
      'video:process-repetition',
      async (_, videoId: string, config: any) => {
        const job = await this.jobService.createRepetitionDetectionJob(
          videoId,
          config
        );
        return job;
      }
    );

    // Get Job Status
    ipcMain.handle('job:status', async (_, jobId: string) => {
      return await this.jobService.getJobStatus(jobId);
    });

    // Get All Jobs
    ipcMain.handle('job:list', async () => {
      return await this.jobService.getAllJobs();
    });

    // Cancel Job
    ipcMain.handle('job:cancel', async (_, jobId: string) => {
      return await this.jobService.cancelJob(jobId);
    });

    // Delete Job
    ipcMain.handle('job:delete', async (_, jobId: string) => {
      return await this.jobService.deleteJob(jobId);
    });

    // Get Job Segments
    ipcMain.handle('job:segments', async (_, jobId: string) => {
      return await this.jobService.getJobSegments(jobId);
    });

    // Get Video Segments
    ipcMain.handle('video:segments', async (_, videoId: string) => {
      return await this.jobService.getVideoSegments(videoId);
    });

    // Update Segment Verification
    ipcMain.handle('segment:verify', async (_, segmentId: string, verified: boolean) => {
      const segmentService = new SegmentService();
      return await segmentService.updateSegmentVerification(segmentId, verified);
    });

    // Preferences
    const { PreferencesService } = require('./services/preferences-service');
    const preferencesService = new PreferencesService();
    ipcMain.handle('preferences:get', async (_, key: string) => {
      return await preferencesService.getPreference(key);
    });
    ipcMain.handle('preferences:set', async (_, key: string, value: string) => {
      return await preferencesService.setPreference(key, value);
    });
    ipcMain.handle('preferences:getAll', async () => {
      return await preferencesService.getAllPreferences();
    });

    // Output Videos
    const outputService = new OutputService();
    ipcMain.handle('output:list', async () => {
      return await outputService.getProcessedVideos();
    });
    ipcMain.handle('output:get', async (_, jobId: string) => {
      return await outputService.getProcessedVideoById(jobId);
    });
    ipcMain.handle('output:delete', async (_, jobId: string) => {
      return await outputService.deleteProcessedVideo(jobId);
    });

    // Select Output Directory
    ipcMain.handle('preferences:selectOutputDirectory', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Default Output Directory',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0];
    });

    // Get All Videos
    ipcMain.handle('video:list', async () => {
      return await this.videoService.getAllVideos();
    });

    // Delete Video
    ipcMain.handle('video:delete', async (_, videoId: string) => {
      return await this.videoService.deleteVideo(videoId);
    });

    // Export Processed Video
    ipcMain.handle('video:export', async (_, jobId: string) => {
      const result = await dialog.showSaveDialog({
        defaultPath: 'processed-video.mp4',
        filters: [{ name: 'Videos', extensions: ['mp4'] }],
      });

      if (result.canceled) return null;

      return await this.jobService.exportResult(jobId, result.filePath);
    });
  }

  private setupQueueEventForwarding(): void {
    // Forward queue manager events to renderer process
    this.queueManager.on('job:progress', (data: { jobId: string; progress: number }) => {
      this.sendToRenderer('job:progress', data);
    });

    this.queueManager.on('job:started', async (data: { jobId: string }) => {
      // Update job status in database to 'active'
      try {
        await this.jobService.updateJobStatus(data.jobId, 'active');
      } catch (error) {
        console.error(`Failed to update job status to active:`, error);
      }
      this.sendToRenderer('job:started', data);
    });

    this.queueManager.on('job:completed', async (data: { jobId: string; result: any }) => {
      // Store segments in database after job completion
      try {
        const job = await this.jobService.getJobStatus(data.jobId);
        if (job && data.result?.metadata) {
          await this.jobService.saveJobSegments(data.jobId, data.result);
        }
      } catch (error) {
        console.error(`Failed to save segments for job ${data.jobId}:`, error);
      }
      this.sendToRenderer('job:completed', data);
    });

    this.queueManager.on('job:failed', (data: { jobId: string; error: string }) => {
      this.sendToRenderer('job:failed', data);
    });

    this.queueManager.on('job:cancelled', (data: { jobId: string }) => {
      this.sendToRenderer('job:cancelled', data);
    });
  }

  private setupAppLifecycle(): void {
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });

    app.on('before-quit', async () => {
      await this.queueManager.shutdown();
      await DatabaseConnection.close();
    });
  }

  public sendToRenderer(channel: string, data: any): void {
    this.mainWindow?.webContents.send(channel, data);
  }
}

// Start the application
new VideoFlowStudioApp();

export default VideoFlowStudioApp;
