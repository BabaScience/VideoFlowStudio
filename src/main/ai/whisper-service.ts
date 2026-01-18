// src/main/ai/whisper-service.ts
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { DatabaseConnection } from '../database/connection';

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration: number;
  wordTimestamps: WordTimestamp[];
}

export interface VoiceActivitySegment {
  start: number;
  end: number;
  hasSpeech: boolean;
}

export interface WhisperOptions {
  language?: string;
  temperature?: number;
  responseFormat?: 'json' | 'text' | 'verbose_json';
  timestampGranularities?: ('word' | 'segment')[];
}

export class WhisperService {
  private whisperPath: string | null = null;

  constructor() {
    this.loadWhisperPath();
    // Also try auto-detection if not found in DB
    if (!this.whisperPath) {
      this.findWhisperPath().catch(console.error);
    }
  }

  /**
   * Finds the whisper CLI executable path
   * Checks common locations: which whisper, python -m whisper, etc.
   */
  private async findWhisperPath(): Promise<void> {
    try {
      // Try common whisper CLI commands
      const possibleCommands = [
        'whisper',
        'whisper-cli',
        'python3 -m whisper',
        'python -m whisper',
      ];

      for (const cmd of possibleCommands) {
        const parts = cmd.split(' ');
        const executable = parts[0];
        
        try {
          // Check if command exists using 'which' or 'where'
          const whichProcess = spawn(process.platform === 'win32' ? 'where' : 'which', [executable], {
            stdio: ['ignore', 'pipe', 'ignore'],
          });

          await new Promise<void>((resolve, reject) => {
            let output = '';
            whichProcess.stdout.on('data', (data) => {
              output += data.toString();
            });
            whichProcess.on('close', (code) => {
              if (code === 0 && output.trim()) {
                this.whisperPath = cmd;
                resolve();
              } else {
                reject(new Error('Command not found'));
              }
            });
            whichProcess.on('error', reject);
          });

          // Test if it works
          if (await this.testWhisperInstallation()) {
            console.log(`Found whisper CLI: ${cmd}`);
            return;
          }
        } catch {
          continue;
        }
      }

      console.warn('Whisper CLI not found. Please install it: pip install openai-whisper');
    } catch (error) {
      console.error('Failed to find whisper CLI:', error);
    }
  }

  /**
   * Tests if whisper installation works
   */
  private async testWhisperInstallation(): Promise<boolean> {
    if (!this.whisperPath) return false;

    return new Promise((resolve) => {
      const parts = this.whisperPath!.split(' ');
      const executable = parts[0];
      const args = parts.slice(1).concat(['--help']);

      const testProcess = spawn(executable, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      testProcess.on('close', (code) => {
        resolve(code === 0);
      });

      testProcess.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        testProcess.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Sets the whisper CLI path manually (if auto-detection fails)
   */
  async setWhisperPath(whisperPath: string): Promise<void> {
    this.whisperPath = whisperPath;
    if (!(await this.testWhisperInstallation())) {
      throw new Error(`Whisper CLI not found or not working at: ${whisperPath}`);
    }

    // Save to database
    try {
      const db = DatabaseConnection.getDatabase();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO ai_settings (key, value, encrypted, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run('whisper_cli_path', whisperPath, 0);
    } catch (error) {
      console.error('Failed to save whisper path:', error);
    }
  }

  /**
   * Loads whisper path from database
   */
  private loadWhisperPath(): void {
    try {
      const db = DatabaseConnection.getDatabase();
      const stmt = db.prepare('SELECT value FROM ai_settings WHERE key = ?');
      const row = stmt.get('whisper_cli_path') as { value: string } | undefined;
      if (row?.value) {
        this.whisperPath = row.value;
      }
    } catch (error) {
      console.error('Failed to load whisper path:', error);
    }
  }

  /**
   * Checks if whisper CLI is configured
   */
  isConfigured(): boolean {
    return this.whisperPath !== null;
  }

  /**
   * Transcribes audio file using local Whisper CLI
   */
  async transcribe(
    audioPath: string,
    options: WhisperOptions = {}
  ): Promise<TranscriptionResult> {
    if (!this.whisperPath) {
      // Try loading from database
      this.loadWhisperPath();
      if (!this.whisperPath) {
        throw new Error('Whisper CLI not found. Please install it: pip install openai-whisper');
      }
    }

    // Check if file exists
    try {
      await fs.access(audioPath);
    } catch {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    // Create temporary output directory for whisper results
    const tempDir = path.join(path.dirname(audioPath), '.whisper_temp');
    await fs.mkdir(tempDir, { recursive: true });
    const outputPath = path.join(tempDir, path.basename(audioPath, path.extname(audioPath)) + '.json');

    try {
      // Build whisper command arguments
      const parts = this.whisperPath.split(' ');
      const executable = parts[0];
      const baseArgs = parts.slice(1);

      const whisperArgs = [
        ...baseArgs,
        audioPath,
        '--output_dir', tempDir,
        '--output_format', 'json',
        '--verbose', 'false',
      ];

      // Add optional parameters
      if (options.language) {
        whisperArgs.push('--language', options.language);
      }

      if (options.temperature !== undefined) {
        whisperArgs.push('--temperature', options.temperature.toString());
      }

      // Execute whisper CLI
      await this.executeWhisper(executable, whisperArgs, 600000); // 10 minute timeout

      // Parse JSON output
      let transcriptionData: any;
      try {
        const jsonContent = await fs.readFile(outputPath, 'utf-8');
        transcriptionData = JSON.parse(jsonContent);
      } catch (error) {
        throw new Error(`Failed to parse whisper output: ${error}`);
      }

      // Extract word timestamps
      const wordTimestamps: WordTimestamp[] = [];
      if (transcriptionData.segments && Array.isArray(transcriptionData.segments)) {
        for (const segment of transcriptionData.segments) {
          if (segment.words && Array.isArray(segment.words)) {
            for (const word of segment.words) {
              wordTimestamps.push({
                word: word.word?.trim() || '',
                start: word.start || 0,
                end: word.end || 0,
                confidence: word.probability,
              });
            }
          }
        }
      }

      // Calculate total duration
      const duration = transcriptionData.duration || 
        (wordTimestamps.length > 0 
          ? wordTimestamps[wordTimestamps.length - 1].end 
          : 0);

      return {
        text: transcriptionData.text || '',
        language: transcriptionData.language,
        duration,
        wordTimestamps,
      };
    } finally {
      // Cleanup temporary files
      try {
        await fs.unlink(outputPath).catch(() => {});
        // Remove temp dir if empty
        const files = await fs.readdir(tempDir).catch(() => []);
        if (files.length === 0) {
          await fs.rmdir(tempDir).catch(() => {});
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Executes whisper CLI command
   */
  private executeWhisper(
    executable: string,
    args: string[],
    timeoutMs: number = 600000
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Executing Whisper: ${executable} ${args.join(' ')}`);

      const whisperProcess = spawn(executable, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout | null = null;

      timeoutId = setTimeout(() => {
        if (!whisperProcess.killed) {
          console.warn(`Whisper timed out after ${timeoutMs}ms`);
          whisperProcess.kill('SIGTERM');
          setTimeout(() => {
            if (!whisperProcess.killed) {
              whisperProcess.kill('SIGKILL');
            }
          }, 5000);
        }
        reject(new Error(`Whisper timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      whisperProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      whisperProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // Whisper outputs progress to stderr
        console.log(`Whisper: ${data.toString().trim()}`);
      });

      whisperProcess.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);

        if (code === 0) {
          resolve();
        } else {
          const errorMsg = stderr.substring(0, 2000) || stdout.substring(0, 2000);
          reject(new Error(`Whisper failed (code ${code}): ${errorMsg}`));
        }
      });

      whisperProcess.on('error', (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(new Error(`Whisper process error: ${err.message}`));
      });
    });
  }

  /**
   * Extracts word-level timestamps from transcription result
   */
  extractWordTimestamps(transcription: TranscriptionResult): WordTimestamp[] {
    return transcription.wordTimestamps || [];
  }

  /**
   * Detects voice activity segments from transcription
   * Uses word timestamps to identify speech vs silence
   */
  detectVoiceActivity(
    transcription: TranscriptionResult,
    minSilenceDuration: number = 0.5
  ): VoiceActivitySegment[] {
    const segments: VoiceActivitySegment[] = [];
    const wordTimestamps = transcription.wordTimestamps;

    if (wordTimestamps.length === 0) {
      return segments;
    }

    let currentStart = wordTimestamps[0].start;
    let currentEnd = wordTimestamps[0].end;
    let hasSpeech = true;

    for (let i = 1; i < wordTimestamps.length; i++) {
      const prevWord = wordTimestamps[i - 1];
      const currentWord = wordTimestamps[i];

      const gap = currentWord.start - prevWord.end;

      if (gap >= minSilenceDuration) {
        // Gap detected - end current segment and start silence segment
        if (hasSpeech) {
          segments.push({
            start: currentStart,
            end: currentEnd,
            hasSpeech: true,
          });
        }

        // Add silence segment
        segments.push({
          start: prevWord.end,
          end: currentWord.start,
          hasSpeech: false,
        });

        currentStart = currentWord.start;
        currentEnd = currentWord.end;
        hasSpeech = true;
      } else {
        // Continue current segment
        currentEnd = currentWord.end;
      }
    }

    // Add final segment
    if (hasSpeech) {
      segments.push({
        start: currentStart,
        end: currentEnd,
        hasSpeech: true,
      });
    }

    return segments;
  }

}
