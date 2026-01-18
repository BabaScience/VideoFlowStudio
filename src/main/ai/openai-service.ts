// src/main/ai/openai-service.ts
import OpenAI from 'openai';
import { safeStorage } from 'electron';
import { DatabaseConnection } from '../database/connection';
import { WordTimestamp } from './whisper-service';

export interface FillerWordSegment {
  word: string;
  start: number;
  end: number;
  type: 'um' | 'uh' | 'like' | 'you_know' | 'so' | 'actually' | 'basically' | 'other';
}

export interface VerbalRepetition {
  text: string;
  firstOccurrence: { start: number; end: number };
  repetitions: Array<{ start: number; end: number }>;
  similarityScore: number;
}

export interface CutSuggestion {
  start: number;
  end: number;
  reason: string;
  confidence: number;
  type: 'sentence_boundary' | 'pause' | 'filler_word' | 'repetition' | 'other';
}

export interface ContentAnalysis {
  fillerWords: FillerWordSegment[];
  repetitions: VerbalRepetition[];
  cutSuggestions: CutSuggestion[];
  summary?: string;
}

export class OpenAIService {
  private openai: OpenAI | null = null;
  private apiKey: string | null = null;

  constructor() {
    this.loadApiKey();
  }

  /**
   * Loads API key from encrypted storage
   */
  private async loadApiKey(): Promise<void> {
    try {
      const db = DatabaseConnection.getDatabase();
      const stmt = db.prepare('SELECT value, encrypted FROM ai_settings WHERE key = ?');
      const row = stmt.get('openai_api_key') as { value: string; encrypted: boolean } | undefined;

      if (row) {
        if (row.encrypted && safeStorage.isEncryptionAvailable()) {
          const buffer = Buffer.from(row.value, 'base64');
          this.apiKey = safeStorage.decryptString(buffer);
        } else {
          this.apiKey = row.value;
        }

        if (this.apiKey) {
          this.openai = new OpenAI({
            apiKey: this.apiKey,
            timeout: 60000, // 1 minute timeout for GPT API calls
            maxRetries: 3,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load OpenAI API key:', error);
    }
  }

  /**
   * Sets the OpenAI API key (encrypted)
   */
  async setApiKey(apiKey: string): Promise<void> {
    try {
      const db = DatabaseConnection.getDatabase();
      let encryptedValue: string;
      let encrypted = false;

      if (safeStorage.isEncryptionAvailable()) {
        encryptedValue = safeStorage.encryptString(apiKey).toString('base64');
        encrypted = true;
      } else {
        encryptedValue = apiKey;
      }

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO ai_settings (key, value, encrypted, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run('openai_api_key', encryptedValue, encrypted ? 1 : 0);

      this.apiKey = apiKey;
      this.openai = new OpenAI({
        apiKey: this.apiKey,
        timeout: 60000, // 1 minute timeout for GPT API calls
        maxRetries: 3,
      });
    } catch (error) {
      console.error('Failed to save API key:', error);
      throw new Error('Failed to save API key');
    }
  }

  /**
   * Checks if API key is configured
   */
  isConfigured(): boolean {
    return this.openai !== null && this.apiKey !== null;
  }

  /**
   * Analyzes transcript for filler words, repetitions, and suggests cut points
   */
  async analyzeTranscript(
    transcript: string,
    timestamps: WordTimestamp[]
  ): Promise<ContentAnalysis> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    // Build prompt for GPT analysis
    const prompt = this.buildAnalysisPrompt(transcript, timestamps);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use mini for cost efficiency, can upgrade to gpt-4o if needed
        messages: [
          {
            role: 'system',
            content: `You are a video editing assistant. Analyze transcripts to identify:
1. Filler words (um, uh, like, you know, so, actually, basically)
2. Verbal repetitions (when the same phrase is said multiple times)
3. Natural cut points (sentence boundaries, pauses)
4. Content summary

Return your analysis as JSON matching this structure:
{
  "fillerWords": [{"word": "...", "start": 0.0, "end": 0.5, "type": "um"}],
  "repetitions": [{"text": "...", "firstOccurrence": {"start": 0, "end": 5}, "repetitions": [{"start": 10, "end": 15}], "similarityScore": 0.95}],
  "cutSuggestions": [{"start": 0, "end": 0, "reason": "...", "confidence": 0.9, "type": "sentence_boundary"}],
  "summary": "..."
}`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from GPT');
      }

      const analysis = JSON.parse(content) as ContentAnalysis;

      // Validate and merge with timestamps
      return this.validateAndMergeTimestamps(analysis, timestamps);
    } catch (error: any) {
      console.error('GPT analysis error:', error);
      throw new Error(`Content analysis failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Detects filler words in transcript
   */
  async detectFillerWords(
    transcript: string,
    timestamps: WordTimestamp[]
  ): Promise<FillerWordSegment[]> {
    const analysis = await this.analyzeTranscript(transcript, timestamps);
    return analysis.fillerWords;
  }

  /**
   * Detects verbal repetitions in transcript
   */
  async detectRepetitions(
    transcript: string,
    timestamps: WordTimestamp[]
  ): Promise<VerbalRepetition[]> {
    const analysis = await this.analyzeTranscript(transcript, timestamps);
    return analysis.repetitions;
  }

  /**
   * Suggests optimal cut points based on transcript analysis
   */
  async suggestCutPoints(
    transcript: string,
    timestamps: WordTimestamp[]
  ): Promise<CutSuggestion[]> {
    const analysis = await this.analyzeTranscript(transcript, timestamps);
    return analysis.cutSuggestions;
  }

  /**
   * Builds analysis prompt with transcript and timestamps
   */
  private buildAnalysisPrompt(transcript: string, timestamps: WordTimestamp[]): string {
    // Create a structured representation of the transcript with timestamps
    const timestampedText = timestamps
      .map((wt) => `[${wt.start.toFixed(2)}s-${wt.end.toFixed(2)}s] ${wt.word}`)
      .join(' ');

    return `Analyze this video transcript:

Transcript: "${transcript}"

Word-level timestamps:
${timestampedText.substring(0, 8000)} ${timestamps.length > 100 ? '... (truncated)' : ''}

Please identify:
1. All filler words with their exact timestamps
2. Any verbal repetitions (same phrase said multiple times)
3. Natural cut points at sentence boundaries or pauses
4. A brief summary of the content

Return your analysis as JSON.`;
  }

  /**
   * Validates GPT response and merges with actual timestamps
   */
  private validateAndMergeTimestamps(
    analysis: ContentAnalysis,
    timestamps: WordTimestamp[]
  ): ContentAnalysis {
    // Create word lookup map
    const wordMap = new Map<string, WordTimestamp[]>();
    for (const ts of timestamps) {
      const normalized = ts.word.toLowerCase().trim();
      if (!wordMap.has(normalized)) {
        wordMap.set(normalized, []);
      }
      wordMap.get(normalized)!.push(ts);
    }

    // Validate and correct filler word timestamps
    const validatedFillerWords: FillerWordSegment[] = [];
    for (const filler of analysis.fillerWords || []) {
      const wordLower = filler.word.toLowerCase().trim();
      const matches = wordMap.get(wordLower) || [];

      if (matches.length > 0) {
        // Use actual timestamp from transcript
        const match = matches[0];
        validatedFillerWords.push({
          ...filler,
          start: match.start,
          end: match.end,
        });
      } else {
        // Try fuzzy match or use provided timestamp
        validatedFillerWords.push(filler);
      }
    }

    // Validate repetitions
    const validatedRepetitions: VerbalRepetition[] = [];
    for (const rep of analysis.repetitions || []) {
      // Find timestamps for repetition text
      const words = rep.text.toLowerCase().split(/\s+/);
      const firstWord = words[0];
      const matches = wordMap.get(firstWord) || [];

      if (matches.length > 0 && rep.firstOccurrence) {
        validatedRepetitions.push({
          ...rep,
          firstOccurrence: {
            start: matches[0].start,
            end: matches[matches.length - 1]?.end || matches[0].end,
          },
        });
      } else {
        validatedRepetitions.push(rep);
      }
    }

    // Validate cut suggestions
    const validatedCutSuggestions: CutSuggestion[] = [];
    for (const cut of analysis.cutSuggestions || []) {
      // Ensure timestamps are valid
      if (cut.start >= 0 && cut.end > cut.start) {
        validatedCutSuggestions.push(cut);
      }
    }

    return {
      fillerWords: validatedFillerWords,
      repetitions: validatedRepetitions,
      cutSuggestions: validatedCutSuggestions,
      summary: analysis.summary,
    };
  }
}
