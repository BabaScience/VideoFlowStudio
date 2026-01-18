// src/main/services/ai-service.ts
import { WhisperService, TranscriptionResult, VoiceActivitySegment } from '../ai/whisper-service';
import { OpenAIService, ContentAnalysis } from '../ai/openai-service';
import { FFmpegWrapper } from '../ffmpeg/wrapper';
import path from 'path';
import fs from 'fs/promises';
import { DatabaseConnection } from '../database/connection';
import { randomUUID } from 'crypto';

export interface Segment {
  start: number;
  end: number;
  type: 'keep' | 'remove' | 'silence' | 'repetition' | 'filler';
  confidence?: number;
  reason?: string;
}

export interface MergedSegment {
  start: number;
  end: number;
  type: 'keep' | 'remove';
  sources: string[]; // ['ffmpeg', 'whisper', 'gpt']
  confidence: number;
  reason?: string;
}

export interface AIAnalysisOptions {
  useWhisper?: boolean;
  useGPT?: boolean;
  detectFillerWords?: boolean;
  detectRepetitions?: boolean;
  suggestCuts?: boolean;
}

export interface AIAnalysisResult {
  transcription?: TranscriptionResult;
  voiceActivity?: VoiceActivitySegment[];
  contentAnalysis?: ContentAnalysis;
  mergedSegments?: MergedSegment[];
  jobId?: string;
  videoId?: string;
}

export class AIService {
  private whisperService: WhisperService;
  private openaiService: OpenAIService;
  private ffmpegWrapper: FFmpegWrapper;

  constructor() {
    this.whisperService = new WhisperService();
    this.openaiService = new OpenAIService();
    this.ffmpegWrapper = new FFmpegWrapper();
  }

  /**
   * Checks if AI features are available
   * Whisper uses local CLI (no API key needed), GPT uses OpenAI API
   */
  isAvailable(): boolean {
    // Whisper is available if CLI is configured, GPT needs API key
    return this.whisperService.isConfigured() && this.openaiService.isConfigured();
  }

  /**
   * Sets OpenAI API key for GPT service (Whisper uses local CLI)
   */
  async setApiKey(apiKey: string): Promise<void> {
    // Only set API key for OpenAI service (GPT)
    await this.openaiService.setApiKey(apiKey);
  }

  /**
   * Analyzes video using AI services
   */
  async analyzeVideo(
    videoPath: string,
    options: AIAnalysisOptions = {},
    jobId?: string,
    videoId?: string
  ): Promise<AIAnalysisResult> {
    const result: AIAnalysisResult = {};

    // Extract audio if using Whisper
    let audioPath: string | null = null;
    if (options.useWhisper || options.useGPT) {
      audioPath = await this.extractAudio(videoPath);
    }

    try {
      // Run Whisper transcription
      if (options.useWhisper && audioPath) {
        result.transcription = await this.whisperService.transcribe(audioPath, {
          responseFormat: 'verbose_json',
          timestampGranularities: ['word'],
        });

        result.voiceActivity = this.whisperService.detectVoiceActivity(
          result.transcription,
          0.5 // min silence duration
        );
      }

      // Run GPT analysis
      if (options.useGPT && result.transcription) {
        const analysisOptions: any = {};
        if (options.detectFillerWords) {
          analysisOptions.detectFillerWords = true;
        }
        if (options.detectRepetitions) {
          analysisOptions.detectRepetitions = true;
        }
        if (options.suggestCuts) {
          analysisOptions.suggestCuts = true;
        }

        result.contentAnalysis = await this.openaiService.analyzeTranscript(
          result.transcription.text,
          result.transcription.wordTimestamps
        );
      }

      // Merge AI results with FFmpeg detection if needed
      if (result.voiceActivity && result.contentAnalysis) {
        result.mergedSegments = this.mergeDetections(
          this.voiceActivityToSegments(result.voiceActivity),
          this.contentAnalysisToSegments(result.contentAnalysis)
        );
      }

      // Save to database
      if (jobId && videoId) {
        await this.saveAnalysisResult(result, jobId, videoId);
      }

      return result;
    } finally {
      // Cleanup extracted audio
      if (audioPath) {
        try {
          await fs.unlink(audioPath);
        } catch (error) {
          console.warn('Failed to cleanup audio file:', error);
        }
      }
    }
  }

  /**
   * Merges FFmpeg detection segments with AI detection segments
   */
  mergeDetections(
    ffmpegSegments: Segment[],
    aiSegments: Segment[]
  ): MergedSegment[] {
    // Combine all segments and sort by start time
    const allSegments = [...ffmpegSegments, ...aiSegments].sort(
      (a, b) => a.start - b.start
    );

    const merged: MergedSegment[] = [];
    let currentStart = 0;
    let currentSources: Set<string> = new Set();
    let currentConfidence = 0;
    let currentReasons: string[] = [];

    for (const segment of allSegments) {
      if (segment.start > currentStart) {
        // Add gap segment if needed
        if (currentStart < segment.start) {
          merged.push({
            start: currentStart,
            end: segment.start,
            type: 'keep',
            sources: Array.from(currentSources),
            confidence: currentConfidence,
            reason: currentReasons.join('; '),
          });
        }
      }

      // Merge overlapping segments
      if (segment.type === 'remove' || segment.type === 'silence' || segment.type === 'repetition' || segment.type === 'filler') {
        const source = segment.type === 'silence' ? 'ffmpeg' : 'ai';
        currentSources.add(source);
        currentConfidence = Math.max(
          currentConfidence,
          segment.confidence || 0.5
        );
        if (segment.reason) {
          currentReasons.push(segment.reason);
        }
      }

      currentStart = Math.max(currentStart, segment.end);
    }

    // Add final segment
    if (merged.length === 0 || merged[merged.length - 1].end < currentStart) {
      merged.push({
        start: currentStart,
        end: currentStart + 1, // Placeholder, should use video duration
        type: 'keep',
        sources: Array.from(currentSources),
        confidence: currentConfidence,
        reason: currentReasons.join('; '),
      });
    }

    return merged;
  }

  /**
   * Converts voice activity segments to standard segments
   */
  private voiceActivityToSegments(voiceActivity: VoiceActivitySegment[]): Segment[] {
    return voiceActivity.map((va) => ({
      start: va.start,
      end: va.end,
      type: va.hasSpeech ? ('keep' as const) : ('silence' as const),
      confidence: 0.9,
      reason: va.hasSpeech ? 'Speech detected' : 'Silence detected',
    }));
  }

  /**
   * Converts content analysis to segments
   */
  private contentAnalysisToSegments(analysis: ContentAnalysis): Segment[] {
    const segments: Segment[] = [];

    // Add filler word segments
    for (const filler of analysis.fillerWords || []) {
      segments.push({
        start: filler.start,
        end: filler.end,
        type: 'filler',
        confidence: 0.8,
        reason: `Filler word: ${filler.word}`,
      });
    }

    // Add repetition segments (keep first, mark repetitions for removal)
    for (const rep of analysis.repetitions || []) {
      for (const repetition of rep.repetitions) {
        segments.push({
          start: repetition.start,
          end: repetition.end,
          type: 'repetition',
          confidence: rep.similarityScore,
          reason: `Repetition: ${rep.text}`,
        });
      }
    }

    return segments;
  }

  /**
   * Extracts audio from video for transcription
   * Converts to WAV format for Whisper API compatibility
   */
  private async extractAudio(videoPath: string): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join('/tmp', 'videoflow-ai-'));
    const audioPath = path.join(tempDir, 'audio.wav');

    // Extract audio and convert to WAV format for Whisper
    // Whisper API works best with WAV, MP3, M4A, or WebM
    await this.ffmpegWrapper.extractAudioStream(videoPath, audioPath, 'wav');

    return audioPath;
  }

  /**
   * Saves analysis result to database
   */
  private async saveAnalysisResult(
    result: AIAnalysisResult,
    jobId: string,
    videoId: string
  ): Promise<void> {
    try {
      const db = DatabaseConnection.getDatabase();
      const analysisId = randomUUID();

      const stmt = db.prepare(`
        INSERT INTO ai_analysis (
          id, job_id, video_id, transcription, word_timestamps,
          filler_words, verbal_repetitions, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      stmt.run(
        analysisId,
        jobId,
        videoId,
        result.transcription?.text || null,
        result.transcription?.wordTimestamps
          ? JSON.stringify(result.transcription.wordTimestamps)
          : null,
        result.contentAnalysis?.fillerWords
          ? JSON.stringify(result.contentAnalysis.fillerWords)
          : null,
        result.contentAnalysis?.repetitions
          ? JSON.stringify(result.contentAnalysis.repetitions)
          : null
      );
    } catch (error) {
      console.error('Failed to save AI analysis:', error);
      // Don't throw - analysis can still be used even if save fails
    }
  }

  /**
   * Gets analysis result from database
   */
  async getAnalysisResult(jobId: string): Promise<AIAnalysisResult | null> {
    try {
      const db = DatabaseConnection.getDatabase();
      const stmt = db.prepare(
        'SELECT * FROM ai_analysis WHERE job_id = ? ORDER BY created_at DESC LIMIT 1'
      );
      const row = stmt.get(jobId) as any;

      if (!row) {
        return null;
      }

      return {
        transcription: row.transcription
          ? {
              text: row.transcription,
              wordTimestamps: row.word_timestamps
                ? JSON.parse(row.word_timestamps)
                : [],
              duration: 0,
            }
          : undefined,
        contentAnalysis: {
          fillerWords: row.filler_words
            ? JSON.parse(row.filler_words)
            : [],
          repetitions: row.verbal_repetitions
            ? JSON.parse(row.verbal_repetitions)
            : [],
          cutSuggestions: [],
        },
      };
    } catch (error) {
      console.error('Failed to get AI analysis:', error);
      return null;
    }
  }
}
