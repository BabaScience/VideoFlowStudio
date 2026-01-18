// src/main/services/segment-service.ts
import { DatabaseConnection } from '../database/connection';
import { randomUUID } from 'crypto';

export interface VideoSegment {
  id: string;
  videoId: string;
  jobId: string;
  startTime: number;
  endTime: number;
  type: 'silence' | 'repetition' | 'keep';
  confidence?: number;
  userVerified: boolean;
  createdAt: Date;
}

export class SegmentService {
  private get db() {
    return DatabaseConnection.getDatabase();
  }

  async saveSegments(
    videoId: string,
    jobId: string,
    segments: Array<{
      startTime: number;
      endTime: number;
      type: 'silence' | 'repetition' | 'keep';
      confidence?: number;
    }>
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO segments (
        id, video_id, job_id, start_time, end_time, type, confidence, user_verified, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((segments) => {
      for (const segment of segments) {
        // Ensure all values are primitives that SQLite can handle
        const confidenceValue = segment.confidence !== undefined && segment.confidence !== null 
          ? Number(segment.confidence) 
          : null;
        
        stmt.run(
          randomUUID(),
          String(videoId),
          String(jobId),
          Number(segment.startTime),
          Number(segment.endTime),
          String(segment.type),
          confidenceValue,
          Number(false), // SQLite uses 0/1 for booleans
          String(new Date().toISOString())
        );
      }
    });

    insertMany(segments);
  }

  async getSegmentsByJobId(jobId: string): Promise<VideoSegment[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM segments WHERE job_id = ? ORDER BY start_time ASC
    `);
    const rows = stmt.all(jobId) as any[];

    return rows.map((row) => ({
      id: row.id,
      videoId: row.video_id,
      jobId: row.job_id,
      startTime: row.start_time,
      endTime: row.end_time,
      type: row.type as 'silence' | 'repetition' | 'keep',
      confidence: row.confidence ?? undefined,
      userVerified: Boolean(row.user_verified),
      createdAt: new Date(row.created_at),
    }));
  }

  async getSegmentsByVideoId(videoId: string): Promise<VideoSegment[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM segments WHERE video_id = ? ORDER BY start_time ASC
    `);
    const rows = stmt.all(videoId) as any[];

    return rows.map((row) => ({
      id: row.id,
      videoId: row.video_id,
      jobId: row.job_id,
      startTime: row.start_time,
      endTime: row.end_time,
      type: row.type as 'silence' | 'repetition' | 'keep',
      confidence: row.confidence ?? undefined,
      userVerified: Boolean(row.user_verified),
      createdAt: new Date(row.created_at),
    }));
  }

  async updateSegmentVerification(
    segmentId: string,
    verified: boolean
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE segments SET user_verified = ? WHERE id = ?
    `);
    stmt.run(verified ? 1 : 0, segmentId);
  }

  async deleteSegmentsByJobId(jobId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM segments WHERE job_id = ?');
    stmt.run(jobId);
  }

  async deleteSegmentsByVideoId(videoId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM segments WHERE video_id = ?');
    stmt.run(videoId);
  }
}
