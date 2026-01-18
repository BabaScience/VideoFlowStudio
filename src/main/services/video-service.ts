// src/main/services/video-service.ts
import { DatabaseConnection } from '../database/connection';
import { FFmpegWrapper, VideoMetadata } from '../ffmpeg/wrapper';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { randomUUID } from 'crypto';

export interface VideoFile {
  id: string;
  filename: string;
  filepath: string;
  duration: number;
  size: number;
  format: string;
  resolution?: string;
  fps?: number;
  audioCodec?: string;
  videoCodec?: string;
  createdAt: Date;
  updatedAt: Date;
  thumbnailPath?: string;
}

export class VideoService {
  private get db() {
    return DatabaseConnection.getDatabase();
  }
  private ffmpeg = new FFmpegWrapper();

  async importVideo(filePath: string): Promise<VideoFile> {
    // Check if file exists
    await fs.access(filePath);

    // Get file stats
    const stats = await fs.stat(filePath);
    const filename = path.basename(filePath);

    // Extract metadata using FFmpeg
    const metadata = await this.ffmpeg.getVideoMetadata(filePath);

    // Generate thumbnail
    const userDataPath = path.join(
      process.env.APP_DATA_PATH || path.join(os.homedir(), '.videoflow'),
      'thumbnails'
    );
    await fs.mkdir(userDataPath, { recursive: true });
    const thumbnailPath = path.join(userDataPath, `${randomUUID()}.jpg`);
    
    try {
      await this.ffmpeg.generateThumbnail(filePath, thumbnailPath, 1);
    } catch (error) {
      console.warn('Failed to generate thumbnail:', error);
    }

    // Determine resolution
    const resolution = metadata.video
      ? `${metadata.video.width}x${metadata.video.height}`
      : undefined;

    // Create video record
    const video: VideoFile = {
      id: randomUUID(),
      filename,
      filepath: filePath,
      duration: metadata.duration,
      size: stats.size,
      format: metadata.format.formatName,
      resolution,
      fps: metadata.video?.fps,
      audioCodec: metadata.audio?.codec,
      videoCodec: metadata.video?.codec,
      createdAt: new Date(),
      updatedAt: new Date(),
      thumbnailPath: thumbnailPath,
    };

    // Insert into database
    const stmt = this.db.prepare(`
      INSERT INTO videos (
        id, filename, filepath, duration, size, format,
        resolution, fps, audio_codec, video_codec,
        thumbnail_path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      video.id,
      video.filename,
      video.filepath,
      video.duration,
      video.size,
      video.format,
      video.resolution || null,
      video.fps || null,
      video.audioCodec || null,
      video.videoCodec || null,
      video.thumbnailPath || null,
      video.createdAt.toISOString(),
      video.updatedAt.toISOString()
    );

    return video;
  }

  async getAllVideos(): Promise<VideoFile[]> {
    const stmt = this.db.prepare('SELECT * FROM videos ORDER BY created_at DESC');
    const rows = stmt.all() as any[];

    return rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      filepath: row.filepath,
      duration: row.duration,
      size: row.size,
      format: row.format,
      resolution: row.resolution || undefined,
      fps: row.fps || undefined,
      audioCodec: row.audio_codec || undefined,
      videoCodec: row.video_codec || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      thumbnailPath: row.thumbnail_path || undefined,
    }));
  }

  async getVideoById(id: string): Promise<VideoFile | null> {
    const stmt = this.db.prepare('SELECT * FROM videos WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      filename: row.filename,
      filepath: row.filepath,
      duration: row.duration,
      size: row.size,
      format: row.format,
      resolution: row.resolution || undefined,
      fps: row.fps || undefined,
      audioCodec: row.audio_codec || undefined,
      videoCodec: row.video_codec || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      thumbnailPath: row.thumbnail_path || undefined,
    };
  }

  async getMetadata(videoId: string): Promise<VideoMetadata> {
    const video = await this.getVideoById(videoId);
    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    return await this.ffmpeg.getVideoMetadata(video.filepath);
  }

  async deleteVideo(id: string): Promise<void> {
    const video = await this.getVideoById(id);
    if (!video) {
      throw new Error(`Video not found: ${id}`);
    }

    // Delete thumbnail if exists
    if (video.thumbnailPath) {
      try {
        await fs.unlink(video.thumbnailPath);
      } catch (error) {
        console.warn('Failed to delete thumbnail:', error);
      }
    }

    // Delete from database (cascade will handle related records)
    const stmt = this.db.prepare('DELETE FROM videos WHERE id = ?');
    stmt.run(id);
  }
}
