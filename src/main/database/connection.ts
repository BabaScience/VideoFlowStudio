// src/main/database/connection.ts
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs/promises';

export class DatabaseConnection {
  private static db: Database.Database | null = null;

  static async initialize(): Promise<void> {
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'database');
    
    // Ensure database directory exists
    await fs.mkdir(dbDir, { recursive: true });
    
    const dbPath = path.join(dbDir, 'videoflow.db');
    this.db = new Database(dbPath);
    
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    
    // Run migrations
    this.runMigrations();
    
    console.log('✓ Database initialized');
  }

  private static runMigrations(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Create videos table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        duration REAL NOT NULL,
        size INTEGER NOT NULL,
        format TEXT NOT NULL,
        resolution TEXT,
        fps REAL,
        audio_codec TEXT,
        video_codec TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        thumbnail_path TEXT
      );
    `);

    // Create jobs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        type TEXT NOT NULL,
        config TEXT NOT NULL,
        status TEXT NOT NULL,
        progress REAL DEFAULT 0,
        output_path TEXT,
        error TEXT,
        result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
      );
    `);

    // Add result column if it doesn't exist (migration for existing databases)
    try {
      // Check if column exists by trying to select it
      this.db.prepare('SELECT result FROM jobs LIMIT 1').get();
    } catch (error: any) {
      // Column doesn't exist, add it
      if (error.message.includes('no such column')) {
        try {
          this.db.exec(`ALTER TABLE jobs ADD COLUMN result TEXT;`);
          console.log('✓ Added result column to jobs table');
        } catch (alterError: any) {
          console.warn('Failed to add result column:', alterError.message);
        }
      }
    }

    // Create segments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS segments (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        type TEXT NOT NULL,
        confidence REAL,
        user_verified BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
      );
    `);

    // Create preferences table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_jobs_video_id ON jobs(video_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_segments_video_id ON segments(video_id);
      CREATE INDEX IF NOT EXISTS idx_segments_job_id ON segments(job_id);
    `);
  }

  static getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  static async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('✓ Database closed');
    }
  }
}
