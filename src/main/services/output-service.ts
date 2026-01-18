// src/main/services/output-service.ts
import { DatabaseConnection } from '../database/connection';

export interface ProcessedVideo {
  id: string; // job id
  jobId: string;
  originalVideoId: string;
  originalFilename: string;
  outputPath: string;
  type: 'silence' | 'repetition';
  completedAt: Date;
  timeSaved?: number;
  segmentsRemoved?: number;
  processedDuration?: number;
  originalDuration?: number;
}

export class OutputService {
  private get db() {
    return DatabaseConnection.getDatabase();
  }

  async getProcessedVideos(): Promise<ProcessedVideo[]> {
    const stmt = this.db.prepare(`
      SELECT 
        j.id as job_id,
        j.video_id as original_video_id,
        j.type,
        j.output_path,
        j.completed_at,
        j.result,
        v.filename as original_filename
      FROM jobs j
      JOIN videos v ON j.video_id = v.id
      WHERE j.status = 'completed' 
        AND j.output_path IS NOT NULL
      ORDER BY j.completed_at DESC
    `);

    const rows = stmt.all() as Array<{
      job_id: string;
      original_video_id: string;
      type: string;
      output_path: string;
      completed_at: string;
      result: string | null;
      original_filename: string;
    }>;

    return rows.map((row) => {
      let resultData: any = null;
      if (row.result) {
        try {
          resultData = JSON.parse(row.result);
        } catch (e) {
          console.warn(`Failed to parse result for job ${row.job_id}:`, e);
        }
      }

      return {
        id: row.job_id,
        jobId: row.job_id,
        originalVideoId: row.original_video_id,
        originalFilename: row.original_filename,
        outputPath: row.output_path,
        type: row.type === 'SILENCE_REMOVAL' ? 'silence' : 'repetition',
        completedAt: new Date(row.completed_at),
        timeSaved: resultData?.timeSaved,
        segmentsRemoved: resultData?.segmentsRemoved,
        processedDuration: resultData?.processedDuration,
        originalDuration: resultData?.originalDuration,
      };
    });
  }

  async getProcessedVideoById(jobId: string): Promise<ProcessedVideo | null> {
    const stmt = this.db.prepare(`
      SELECT 
        j.id as job_id,
        j.video_id as original_video_id,
        j.type,
        j.output_path,
        j.completed_at,
        j.result,
        v.filename as original_filename
      FROM jobs j
      JOIN videos v ON j.video_id = v.id
      WHERE j.id = ? 
        AND j.status = 'completed'
        AND j.output_path IS NOT NULL
    `);

    const row = stmt.get(jobId) as any;
    if (!row) {
      return null;
    }

    let resultData: any = null;
    if (row.result) {
      try {
        resultData = JSON.parse(row.result);
      } catch (e) {
        console.warn(`Failed to parse result for job ${row.job_id}:`, e);
      }
    }

    return {
      id: row.job_id,
      jobId: row.job_id,
      originalVideoId: row.original_video_id,
      originalFilename: row.original_filename,
      outputPath: row.output_path,
      type: row.type === 'SILENCE_REMOVAL' ? 'silence' : 'repetition',
      completedAt: new Date(row.completed_at),
      timeSaved: resultData?.timeSaved,
      segmentsRemoved: resultData?.segmentsRemoved,
      processedDuration: resultData?.processedDuration,
      originalDuration: resultData?.originalDuration,
    };
  }
}
