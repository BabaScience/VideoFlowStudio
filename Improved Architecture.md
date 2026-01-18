VideoFlow Studio Enhancement: Whisper Integration & Frozen Frame Resolution
I'll provide a comprehensive analysis and solution for both challenges. Let me start by examining the architecture and then propose enhancements.
1. Diagnostic Analysis of the Frozen Frame Problem
The frozen frame phenomenon you're experiencing is a keyframe synchronization issue inherent to stream-copy operations in FFmpeg. Let me elucidate the root cause:
mermaidgraph TB
    subgraph "Video Stream Structure (GOP - Group of Pictures)"
        I1[I-Frame<br/>Keyframe] --> P1[P-Frame]
        P1 --> P2[P-Frame]
        P2 --> B1[B-Frame]
        B1 --> P3[P-Frame]
        P3 --> P4[P-Frame]
        P4 --> I2[I-Frame<br/>Keyframe]
    end
    
    subgraph "Problem: Stream Copy Cut"
        CUT[Cut Point<br/>at P-Frame] -.->|"Missing I-Frame<br/>Reference"| FROZEN[Frozen Frame<br/>Until Next I-Frame]
    end
    
    subgraph "Solution: Re-encode"
        REENCODE[Re-encode at<br/>Cut Point] -->|"Creates New<br/>I-Frame"| CLEAN[Clean Playback]
    end
    
    style I1 fill:#4CAF50,color:white
    style I2 fill:#4CAF50,color:white
    style CUT fill:#f44336,color:white
    style FROZEN fill:#f44336,color:white
    style REENCODE fill:#2196F3,color:white
    style CLEAN fill:#4CAF50,color:white
2. Enhanced Architecture with Whisper Integration
mermaidgraph TB
    subgraph "Enhanced VideoFlow Studio Architecture"
        direction TB
        
        subgraph "Input Layer"
            VIDEO[Video Input]
            AUDIO[Audio Extraction]
        end
        
        subgraph "AI Analysis Layer"
            WHISPER[OpenAI Whisper<br/>Speech Recognition]
            SILENCE[FFmpeg Silence<br/>Detection]
            VISUAL[Visual Repetition<br/>Detection]
        end
        
        subgraph "Intelligent Processing"
            FUSION[Multi-Modal<br/>Fusion Engine]
            SMART_CUT[Smart Cut<br/>Optimizer]
            KEYFRAME[Keyframe-Aware<br/>Processor]
        end
        
        subgraph "Output Layer"
            REENCODE_ENGINE[Re-encode Engine<br/>Frame-Accurate]
            SUBTITLES[Subtitle<br/>Generation]
            PROCESSED[Processed Video]
        end
    end
    
    VIDEO --> AUDIO
    VIDEO --> VISUAL
    AUDIO --> WHISPER
    AUDIO --> SILENCE
    
    WHISPER --> FUSION
    SILENCE --> FUSION
    VISUAL --> FUSION
    
    FUSION --> SMART_CUT
    SMART_CUT --> KEYFRAME
    KEYFRAME --> REENCODE_ENGINE
    
    WHISPER --> SUBTITLES
    REENCODE_ENGINE --> PROCESSED
    SUBTITLES --> PROCESSED
    
    style WHISPER fill:#10a37f,color:white
    style FUSION fill:#5E5CE6,color:white
    style KEYFRAME fill:#FF9500,color:white
    style REENCODE_ENGINE fill:#007AFF,color:white
3. Implementation Plan
Let me create the enhanced implementation:Failed to viewElectron.dSynthesized Whisper integration, FFmpeg optimization, and frozen frame solutions.I already have access to all the documents provided in the conversation. Let me analyze them and create the implementation files. I have all the code from the documents, so I can proceed with creating the enhanced implementation.
Let me create a comprehensive solution that addresses:

The frozen frame problem with better FFmpeg handling
OpenAI Whisper integration for intelligent speech analysis
Enhanced architecture documentation
I have all the code from the documents provided. Let me create the comprehensive enhancement solution:12 stepsCreating the AI Settings UI panel componentAISettingsPanel.tsxAnalyzed Whisper integration opportunities and diagnosed frozen frame causes in FFmpeg processing.18sThe user is asking two things:

How to integrate OpenAI API and Whisper to enhance the VideoFlow Studio project
How to fix the frozen frame issue during video processing

Let me analyze the current codebase and provide comprehensive answers.
Part 1: OpenAI/Whisper Integration Opportunities
Looking at the project, there are several ways to leverage OpenAI API and Whisper:

Whisper for Speech-to-Text:

Transcribe audio to detect spoken content
Use transcription for more intelligent silence detection (detect pauses in speech vs ambient silence)
Enable subtitle generation feature mentioned in roadmap
Detect "um", "uh", filler words for removal


OpenAI GPT for Content Analysis:

Analyze transcription to detect repetitive speech patterns
Identify context (intentional repetition vs errors)
Smart chapter/segment detection
Content summarization


Specific Use Cases:

Voice Activity Detection (VAD) using Whisper timestamps
Filler word removal ("um", "uh", "like", etc.)
Speaker diarization combined with repetition detection
Intelligent cut points based on sentence boundaries



Part 2: Frozen Frame Issue
Looking at the code, I can see they're using FFmpeg with various approaches:

extractSegment uses stream copy (-c copy)
extractSegmentWithReencode re-encodes segments
concatenateVideosWithReencode uses filter_complex
processWithSinglePass uses trim/atrim filters

The frozen frame issue typically occurs because:

Keyframe alignment: When using -c copy, FFmpeg can only cut at keyframes. If the cut point isn't at a keyframe, it may copy from the previous keyframe, causing frozen frames.
Timestamp issues: The -ss position before -i seeks to the nearest keyframe, which may not be exactly where you want.
Segment concatenation issues: When concatenating segments, timestamp discontinuities can cause playback issues.

To fix this, I should re-encode segments for frame-accurate cuts rather than relying on stream copy, use -force_key_frames to ensure keyframes align with cut points, or apply -avoid_negative_ts make to handle timestamp normalization during concatenation.
Looking at the existing code, the detectors already have a safeMode option that triggers re-encoding and a useSinglePass flag for filter_complex operations. The frozen frame problem likely stems from using -c copy in non-safe mode, which can't guarantee precise frame boundaries. I could also explore alternative libraries like MLT Framework, GStreamer, or MoviePy for more robust segment handling, though these add complexity. For Node.js specifically, fluent-ffmpeg might provide better built-in segment management than raw ffmpeg commands.VideoFlow Studio Enhancement: OpenAI/Whisper Integration & Frozen Frame Fix
I'll provide a comprehensive analysis and solution for both issues, with detailed Mermaid diagrams and sophisticated implementation strategies.
🔍 Analysis of Current Issues
Frozen Frame Root Cause Analysis
mermaidflowchart TD
    subgraph "Current Problem: Frozen Frames"
        A[Video Input] --> B{Cut Point}
        B -->|Not at Keyframe| C[FFmpeg -c copy]
        C --> D[Seeks to Previous Keyframe]
        D --> E[Copies Extra Frames]
        E --> F[❌ Frozen Frame at Start]
        
        B -->|At Keyframe| G[Clean Cut]
        G --> H[✓ No Frozen Frame]
    end
    
    subgraph "Concatenation Issue"
        I[Segment 1] --> J[Different PTS/DTS]
        K[Segment 2] --> J
        J --> L[Timestamp Discontinuity]
        L --> M[❌ Playback Glitch]
    end
    
    style F fill:#ff6b6b,color:#fff
    style M fill:#ff6b6b,color:#fff
    style H fill:#51cf66,color:#fff
🏗️ Enhanced Architecture with AI Integration
mermaidgraph TB
    subgraph "Enhanced VideoFlow Studio Architecture"
        subgraph "Input Layer"
            VI[Video Input]
            AI[Audio Input Stream]
        end
        
        subgraph "AI Processing Layer"
            subgraph "Whisper Engine"
                WH[Whisper API/Local]
                VAD[Voice Activity Detection]
                TR[Transcription Engine]
                WTS[Word-Level Timestamps]
            end
            
            subgraph "OpenAI Analysis"
                GPT[GPT-4 Analysis]
                FW[Filler Word Detection]
                SD[Sentence Detection]
                CTX[Context Analysis]
            end
        end
        
        subgraph "Enhanced Detection Layer"
            SIL[Silence Detection<br/>FFmpeg + VAD]
            REP[Repetition Detection<br/>Hash + Transcript]
            FIL[Filler Removal<br/>Whisper Timestamps]
            INT[Intelligent Cuts<br/>Sentence Boundaries]
        end
        
        subgraph "Premium FFmpeg Pipeline"
            KF[Keyframe Analysis]
            FAS[Frame-Accurate Seeking]
            HWA[Hardware Acceleration]
            QP[Quality Preservation]
        end
        
        subgraph "Output Layer"
            OUT[Processed Video]
            SUB[Generated Subtitles]
            SUM[Content Summary]
        end
    end
    
    VI --> AI
    AI --> WH
    WH --> VAD
    WH --> TR
    TR --> WTS
    
    WTS --> GPT
    GPT --> FW
    GPT --> SD
    GPT --> CTX
    
    VAD --> SIL
    WTS --> REP
    FW --> FIL
    SD --> INT
    
    SIL --> KF
    REP --> KF
    FIL --> KF
    INT --> KF
    
    KF --> FAS
    FAS --> HWA
    HWA --> QP
    
    QP --> OUT
    TR --> SUB
    CTX --> SUM
📊 Whisper Integration Flow
mermaidsequenceDiagram
    participant UI as React UI
    participant MP as Main Process
    participant WS as Whisper Service
    participant OAI as OpenAI API
    participant FFM as FFmpeg Engine
    participant FS as File System
    
    UI->>MP: Process Video Request
    MP->>FFM: Extract Audio Stream
    FFM->>FS: Save audio.wav
    FS-->>MP: Audio Path
    
    alt Local Whisper
        MP->>WS: Transcribe (whisper.cpp)
        WS->>WS: Load Model
        WS->>WS: Process Audio
        WS-->>MP: Transcription + Timestamps
    else OpenAI Whisper API
        MP->>OAI: POST /audio/transcriptions
        Note over OAI: word_timestamps=true<br/>response_format=verbose_json
        OAI-->>MP: Transcription + Word Timestamps
    end
    
    MP->>OAI: Analyze Transcript (GPT-4)
    Note over OAI: Detect filler words<br/>Identify repetitions<br/>Find sentence boundaries
    OAI-->>MP: Analysis Results
    
    MP->>MP: Merge AI + FFmpeg Detection
    MP->>FFM: Process with Optimized Cuts
    FFM->>FFM: Frame-Accurate Encoding
    FFM-->>MP: Processed Video
    
    MP-->>UI: Complete with Metadata
Let me now create the implementation files:2 stepsCreate project directory structure for enhancementsbashmkdir -p /home/claude/videoflow-enhancement/src/main/{ai,ffmpeg,services} /home/claude/videoflow-enhancement/src/renderer/components/settings /home/claude/videoflow-enhancement/docsOutputexit code 0Architected comprehensive solution integrating Whisper API and optimizing video processing.Now let me create the comprehensive implementation files. I'll start with the Whisper integration service, then the enhanced FFmpeg wrapper with frozen frame fixes, and finally the documentation.Now let me create the comprehensive implementation:10 stepsView the architecture documentationShow working fileArchitected AI integration solutions and diagnosed video freezing root causes.11sThe user is asking two things:

How to integrate OpenAI API and Whisper to enhance the VideoFlow Studio project
A bug fix for frozen frames during video processing

Let me analyze the current architecture and provide solutions for both.
Part 1: OpenAI/Whisper Integration Opportunities
Looking at the project, here are ways to level up with OpenAI API and Whisper:

Transcription-Based Silence Detection: Use Whisper to transcribe audio and detect actual speech pauses vs background noise more accurately
Content-Aware Editing: Use transcription to understand what's being said and make smarter cuts
Auto-Chapter Generation: Generate chapters based on topic changes in transcription
Smart Repetition Detection: Use transcription to detect when someone says the same thing twice (verbal repetitions, not just visual)
Subtitle Generation: Auto-generate subtitles
Content Summarization: Use GPT to summarize video content
Smart Editing Suggestions: AI-powered suggestions for cuts

Part 2: Frozen Frame Issue
Looking at the code, I can see the issue. In the FFmpeg processing:

extractSegment uses -c copy which can cause issues at non-keyframe boundaries
The concatenation process might not be handling timestamps correctly
The avoid_negative_ts setting might not be sufficient

The frozen frames typically happen because:

Cutting at non-keyframe positions with stream copy
Missing B-frames or P-frames at segment boundaries
Timestamp discontinuities during concatenation

Solutions:

Use re-encoding instead of stream copy (already partially implemented with safeMode)
Use the filter_complex approach for single-pass processing
Ensure keyframe alignment when cutting
Use proper timestamp handling

Let me create a comprehensive solution with:

A new service for Whisper/OpenAI integration
An improved FFmpeg wrapper that resolves the frozen frame issue by forcing keyframe alignment and using proper re-encoding when needed
Architecture diagrams showing how the transcription pipeline feeds into content analysis and editing decisions
VideoFlow Studio Enhancement: OpenAI/Whisper Integration & Frozen Frame Fix
Excellent questions, Bamba! Let me provide a comprehensive analysis and solution for both challenges.
1. Root Cause Analysis: Frozen Frames Issue
The frozen frame problem in your current implementation stems from keyframe misalignment during segment extraction with stream copy (-c copy). When FFmpeg cuts at non-keyframe positions, it can result in:

Missing reference frames (B-frames/P-frames depend on I-frames)
Timestamp discontinuities during concatenation
Decoder confusion leading to frozen visual output while audio continues

Let me create a detailed solution with enhanced FFmpeg handling and Whisper integration.2 stepsReading PDF skill for documentation creationThought processNow I have enough context. Let me create a comprehensive solution that addresses both:

The frozen frame problem
OpenAI/Whisper integration for enhanced features

I'll create:

An enhanced FFmpeg wrapper that fixes the frozen frame issue
A Whisper analyzer service for AI-powered speech analysis
An architecture document with Mermaid diagrams
Integration code for both silence detection and repetition detection with AI

Let me start building this out.Now let me create a comprehensive solution with enhanced FFmpeg processing and Whisper integration.


// src/main/ffmpeg/enhanced-wrapper.ts
/**
 * EnhancedFFmpegWrapper - Frame-Accurate Video Processing
 * 
 * This module addresses the frozen frame problem by implementing:
 * 1. Keyframe-aware segment extraction
 * 2. GOP (Group of Pictures) analysis
 * 3. Smart re-encoding at cut points
 * 4. Hardware acceleration (VideoToolbox on macOS)
 * 5. Quality-preserving concatenation
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { app } from 'electron';
import fs from 'fs/promises';
import { EventEmitter } from 'events';

export interface VideoMetadata {
  duration: number;
  format: {
    formatName: string;
    formatLongName: string;
    size: number;
    bitRate: number;
  };
  video?: {
    codec: string;
    width: number;
    height: number;
    fps: number;
    bitRate: number;
    pixelFormat: string;
    profile?: string;
    level?: number;
  };
  audio?: {
    codec: string;
    sampleRate: number;
    channels: number;
    bitRate: number;
  };
  keyframes?: KeyframeInfo[];
}

export interface KeyframeInfo {
  timestamp: number;
  frameNumber: number;
  size: number;
}

export interface GOPInfo {
  startTime: number;
  endTime: number;
  keyframeTimestamp: number;
  frameCount: number;
  duration: number;
}

export interface SegmentCut {
  start: number;
  end: number;
  requiresReencode: boolean;
  nearestKeyframeBefore?: number;
  nearestKeyframeAfter?: number;
}

export interface ProcessingQuality {
  preset: 'ultrafast' | 'veryfast' | 'fast' | 'medium' | 'slow' | 'veryslow';
  crf: number; // 0-51 for H.264/H.265 (lower = better quality)
  useHardwareAccel: boolean;
  preserveOriginalQuality: boolean;
}

const DEFAULT_QUALITY: ProcessingQuality = {
  preset: 'fast',
  crf: 18, // Visually lossless
  useHardwareAccel: true,
  preserveOriginalQuality: true,
};

export class EnhancedFFmpegWrapper extends EventEmitter {
  private ffmpegPath: string;
  private ffprobePath: string;
  private activeProcesses: Map<string, ChildProcess> = new Map();

  constructor() {
    super();
    this.initializePaths();
  }

  private initializePaths(): void {
    let binariesDir: string;
    
    if (app.isPackaged) {
      binariesDir = path.join(process.resourcesPath, 'binaries');
    } else {
      binariesDir = path.join(app.getAppPath(), 'binaries');
    }

    this.ffmpegPath = path.join(binariesDir, 'ffmpeg');
    this.ffprobePath = path.join(binariesDir, 'ffprobe');
  }

  getBinaryPath(): string {
    return this.ffmpegPath;
  }

  /**
   * Analyzes keyframes in a video file
   * Critical for understanding GOP structure and avoiding frozen frames
   */
  async analyzeKeyframes(videoPath: string): Promise<KeyframeInfo[]> {
    return new Promise((resolve, reject) => {
      const keyframes: KeyframeInfo[] = [];

      const args = [
        '-select_streams', 'v:0',
        '-skip_frame', 'nokey', // Only show keyframes
        '-show_frames',
        '-show_entries', 'frame=pts_time,pkt_size,coded_picture_number',
        '-of', 'csv=print_section=0',
        videoPath
      ];

      const ffprobe = spawn(this.ffprobePath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          // Parse keyframe data
          const lines = stdout.trim().split('\n');
          let frameNumber = 0;
          
          for (const line of lines) {
            const parts = line.split(',');
            if (parts.length >= 2) {
              const timestamp = parseFloat(parts[0]);
              const size = parseInt(parts[1]) || 0;
              
              if (!isNaN(timestamp)) {
                keyframes.push({
                  timestamp,
                  frameNumber: frameNumber++,
                  size,
                });
              }
            }
          }
          
          resolve(keyframes);
        } else {
          // If keyframe analysis fails, return empty array (will use fallback)
          console.warn(`Keyframe analysis failed: ${stderr}`);
          resolve([]);
        }
      });

      ffprobe.on('error', (err) => {
        reject(new Error(`FFprobe error: ${err.message}`));
      });
    });
  }

  /**
   * Analyzes GOP (Group of Pictures) structure
   */
  async analyzeGOPStructure(videoPath: string): Promise<GOPInfo[]> {
    const keyframes = await this.analyzeKeyframes(videoPath);
    const metadata = await this.getVideoMetadata(videoPath);
    const gops: GOPInfo[] = [];

    for (let i = 0; i < keyframes.length; i++) {
      const currentKeyframe = keyframes[i];
      const nextKeyframe = keyframes[i + 1];
      
      const endTime = nextKeyframe?.timestamp || metadata.duration;
      
      gops.push({
        startTime: currentKeyframe.timestamp,
        endTime: endTime,
        keyframeTimestamp: currentKeyframe.timestamp,
        frameCount: nextKeyframe 
          ? nextKeyframe.frameNumber - currentKeyframe.frameNumber
          : Math.ceil((endTime - currentKeyframe.timestamp) * (metadata.video?.fps || 30)),
        duration: endTime - currentKeyframe.timestamp,
      });
    }

    return gops;
  }

  /**
   * Finds the nearest keyframe to a given timestamp
   */
  findNearestKeyframe(
    timestamp: number, 
    keyframes: KeyframeInfo[], 
    direction: 'before' | 'after' | 'nearest'
  ): KeyframeInfo | null {
    if (keyframes.length === 0) return null;

    if (direction === 'before') {
      // Find largest keyframe timestamp <= target
      let result: KeyframeInfo | null = null;
      for (const kf of keyframes) {
        if (kf.timestamp <= timestamp) {
          result = kf;
        } else {
          break;
        }
      }
      return result;
    }

    if (direction === 'after') {
      // Find smallest keyframe timestamp >= target
      for (const kf of keyframes) {
        if (kf.timestamp >= timestamp) {
          return kf;
        }
      }
      return keyframes[keyframes.length - 1];
    }

    // Nearest
    let nearest = keyframes[0];
    let minDiff = Math.abs(keyframes[0].timestamp - timestamp);
    
    for (const kf of keyframes) {
      const diff = Math.abs(kf.timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = kf;
      }
    }
    
    return nearest;
  }

  /**
   * Optimizes cut points to align with keyframes where possible
   */
  async optimizeCutPoints(
    videoPath: string,
    segments: Array<{ start: number; end: number }>,
    tolerance: number = 0.5 // Max adjustment in seconds
  ): Promise<SegmentCut[]> {
    const keyframes = await this.analyzeKeyframes(videoPath);
    const optimizedCuts: SegmentCut[] = [];

    for (const segment of segments) {
      const startKeyframe = this.findNearestKeyframe(segment.start, keyframes, 'nearest');
      const endKeyframe = this.findNearestKeyframe(segment.end, keyframes, 'nearest');

      let optimizedStart = segment.start;
      let optimizedEnd = segment.end;
      let requiresReencode = false;

      // Check if we can align start to a keyframe
      if (startKeyframe && Math.abs(startKeyframe.timestamp - segment.start) <= tolerance) {
        optimizedStart = startKeyframe.timestamp;
      } else {
        requiresReencode = true; // Cut doesn't align with keyframe
      }

      // Check if we can align end to a keyframe
      if (endKeyframe && Math.abs(endKeyframe.timestamp - segment.end) <= tolerance) {
        optimizedEnd = endKeyframe.timestamp;
      }

      optimizedCuts.push({
        start: optimizedStart,
        end: optimizedEnd,
        requiresReencode,
        nearestKeyframeBefore: this.findNearestKeyframe(segment.start, keyframes, 'before')?.timestamp,
        nearestKeyframeAfter: this.findNearestKeyframe(segment.end, keyframes, 'after')?.timestamp,
      });
    }

    return optimizedCuts;
  }

  /**
   * Extracts a segment with smart re-encoding to prevent frozen frames
   * This is the KEY function that fixes the frozen frame problem
   */
  async extractSegmentSmart(
    inputPath: string,
    startTime: number,
    endTime: number,
    outputPath: string,
    metadata: VideoMetadata,
    quality: ProcessingQuality = DEFAULT_QUALITY
  ): Promise<void> {
    const duration = endTime - startTime;
    
    // Determine encoder based on hardware availability and source codec
    const encoder = await this.selectOptimalEncoder(metadata, quality);
    
    // Build encoding arguments based on quality settings
    const encodingArgs = this.buildEncodingArgs(encoder, metadata, quality);

    // Use filter_complex with trim for frame-accurate cutting
    // This approach:
    // 1. Seeks to position BEFORE the start (for proper decoding)
    // 2. Uses trim filter for precise frame-level cutting
    // 3. Resets timestamps properly
    // 4. Re-encodes to create clean keyframes
    
    const seekTime = Math.max(0, startTime - 5); // Seek 5 seconds before for proper GOP decoding
    
    const args = [
      // Input seeking (fast seek to near the start point)
      '-ss', this.formatTimePrecise(seekTime),
      '-i', inputPath,
      
      // Filter complex for precise trimming
      '-filter_complex', 
      `[0:v]trim=start=${this.formatTimePrecise(startTime - seekTime)}:end=${this.formatTimePrecise(endTime - seekTime)},setpts=PTS-STARTPTS[v];` +
      (metadata.audio 
        ? `[0:a]atrim=start=${this.formatTimePrecise(startTime - seekTime)}:end=${this.formatTimePrecise(endTime - seekTime)},asetpts=PTS-STARTPTS[a]`
        : ''),
      
      // Map outputs
      '-map', '[v]',
      ...(metadata.audio ? ['-map', '[a]'] : []),
      
      // Video encoding
      ...encodingArgs.video,
      
      // Audio encoding
      ...(metadata.audio ? encodingArgs.audio : []),
      
      // Output options
      '-fflags', '+genpts',
      '-movflags', '+faststart',
      '-avoid_negative_ts', 'make_zero',
      
      // Output file
      '-y', outputPath
    ];

    await this.executeFFmpeg(args, 600000); // 10 minute timeout for long segments
  }

  /**
   * Selects the optimal encoder based on hardware and quality requirements
   */
  private async selectOptimalEncoder(
    metadata: VideoMetadata, 
    quality: ProcessingQuality
  ): Promise<{
    video: string;
    audio: string;
    hardware: boolean;
  }> {
    // Check for hardware acceleration availability
    const hasVideoToolbox = await this.checkHardwareAccel('videotoolbox');
    
    let videoEncoder = 'libx264'; // Default fallback
    let useHardware = false;

    if (quality.useHardwareAccel && hasVideoToolbox) {
      // Use VideoToolbox on macOS for hardware acceleration
      if (metadata.video?.codec === 'hevc' || metadata.video?.codec === 'h265') {
        videoEncoder = 'hevc_videotoolbox';
      } else {
        videoEncoder = 'h264_videotoolbox';
      }
      useHardware = true;
    } else {
      // Software encoding - match source codec when possible
      if (metadata.video?.codec === 'hevc' || metadata.video?.codec === 'h265') {
        videoEncoder = 'libx265';
      } else if (metadata.video?.codec === 'vp9') {
        videoEncoder = 'libvpx-vp9';
      } else {
        videoEncoder = 'libx264';
      }
    }

    return {
      video: videoEncoder,
      audio: 'aac',
      hardware: useHardware,
    };
  }

  /**
   * Checks if a hardware acceleration method is available
   */
  private async checkHardwareAccel(method: string): Promise<boolean> {
    return new Promise((resolve) => {
      const args = ['-hwaccels'];
      const ffmpeg = spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';

      ffmpeg.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffmpeg.on('close', () => {
        resolve(stdout.toLowerCase().includes(method));
      });

      ffmpeg.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!ffmpeg.killed) {
          ffmpeg.kill();
          resolve(false);
        }
      }, 5000);
    });
  }

  /**
   * Builds encoding arguments based on encoder and quality settings
   */
  private buildEncodingArgs(
    encoder: { video: string; audio: string; hardware: boolean },
    metadata: VideoMetadata,
    quality: ProcessingQuality
  ): { video: string[]; audio: string[] } {
    const videoArgs: string[] = ['-c:v', encoder.video];
    const audioArgs: string[] = ['-c:a', encoder.audio];

    // Video quality settings
    if (encoder.hardware) {
      // Hardware encoder settings (VideoToolbox)
      if (quality.preserveOriginalQuality && metadata.video?.bitRate) {
        videoArgs.push('-b:v', metadata.video.bitRate.toString());
      } else {
        // Use quality-based encoding
        videoArgs.push('-q:v', Math.round(quality.crf * 0.8).toString());
      }
      videoArgs.push('-profile:v', 'high');
    } else {
      // Software encoder settings
      videoArgs.push('-crf', quality.crf.toString());
      videoArgs.push('-preset', quality.preset);
      
      if (encoder.video === 'libx264') {
        videoArgs.push('-profile:v', 'high');
        videoArgs.push('-level:v', '4.1');
      }
    }

    // Audio quality
    const audioBitrate = metadata.audio?.bitRate || 192000;
    audioArgs.push('-b:a', Math.round(audioBitrate / 1000).toString() + 'k');
    audioArgs.push('-ar', (metadata.audio?.sampleRate || 48000).toString());

    return { video: videoArgs, audio: audioArgs };
  }

  /**
   * Concatenates segments using filter_complex for seamless joins
   * This prevents the frozen frame issue at segment boundaries
   */
  async concatenateSegmentsSmart(
    segmentPaths: string[],
    outputPath: string,
    metadata: VideoMetadata,
    quality: ProcessingQuality = DEFAULT_QUALITY
  ): Promise<void> {
    if (segmentPaths.length === 0) {
      throw new Error('No segments to concatenate');
    }

    if (segmentPaths.length === 1) {
      // Single segment - just copy it
      await fs.copyFile(segmentPaths[0], outputPath);
      return;
    }

    const encoder = await this.selectOptimalEncoder(metadata, quality);
    const encodingArgs = this.buildEncodingArgs(encoder, metadata, quality);
    const hasAudio = metadata.audio !== undefined;

    // Build input arguments
    const inputArgs: string[] = [];
    for (const segmentPath of segmentPaths) {
      inputArgs.push('-i', segmentPath);
    }

    // Build filter_complex for seamless concatenation
    const filterParts: string[] = [];
    const videoLabels: string[] = [];
    const audioLabels: string[] = [];

    for (let i = 0; i < segmentPaths.length; i++) {
      // Reset PTS for each segment to ensure smooth concatenation
      filterParts.push(`[${i}:v:0]setpts=PTS-STARTPTS[v${i}]`);
      videoLabels.push(`[v${i}]`);
      
      if (hasAudio) {
        filterParts.push(`[${i}:a:0]asetpts=PTS-STARTPTS[a${i}]`);
        audioLabels.push(`[a${i}]`);
      }
    }

    // Concatenate all segments
    const concatFilter = hasAudio
      ? `${videoLabels.join('')}${audioLabels.join('')}concat=n=${segmentPaths.length}:v=1:a=1[outv][outa]`
      : `${videoLabels.join('')}concat=n=${segmentPaths.length}:v=1:a=0[outv]`;

    filterParts.push(concatFilter);

    const args = [
      ...inputArgs,
      '-filter_complex', filterParts.join(';'),
      '-map', '[outv]',
      ...(hasAudio ? ['-map', '[outa]'] : []),
      ...encodingArgs.video,
      ...(hasAudio ? encodingArgs.audio : []),
      '-fflags', '+genpts',
      '-movflags', '+faststart',
      '-y', outputPath
    ];

    await this.executeFFmpeg(args, 1800000); // 30 minute timeout for long videos
  }

  /**
   * Single-pass processing: trim + concat in one FFmpeg command
   * Most efficient approach that completely eliminates frozen frames
   */
  async processWithSinglePassSmart(
    videoPath: string,
    keepSegments: Array<{ start: number; end: number }>,
    outputPath: string,
    metadata: VideoMetadata,
    quality: ProcessingQuality = DEFAULT_QUALITY
  ): Promise<void> {
    if (keepSegments.length === 0) {
      throw new Error('No segments to process');
    }

    // Validate and clean segments
    const validSegments = keepSegments.filter(seg => {
      const duration = seg.end - seg.start;
      return duration > 0.01 && seg.start >= 0 && seg.end <= metadata.duration;
    });

    if (validSegments.length === 0) {
      throw new Error('No valid segments after validation');
    }

    const encoder = await this.selectOptimalEncoder(metadata, quality);
    const encodingArgs = this.buildEncodingArgs(encoder, metadata, quality);
    const hasAudio = metadata.audio !== undefined;

    // Build filter_complex that trims and concatenates in single pass
    const filterParts: string[] = [];
    const concatInputs: string[] = [];

    for (let i = 0; i < validSegments.length; i++) {
      const seg = validSegments[i];
      
      // Trim video with precise timestamps
      filterParts.push(
        `[0:v:0]trim=start=${this.formatTimePrecise(seg.start)}:end=${this.formatTimePrecise(seg.end)},setpts=PTS-STARTPTS[v${i}]`
      );
      
      if (hasAudio) {
        filterParts.push(
          `[0:a:0]atrim=start=${this.formatTimePrecise(seg.start)}:end=${this.formatTimePrecise(seg.end)},asetpts=PTS-STARTPTS[a${i}]`
        );
        concatInputs.push(`[v${i}][a${i}]`);
      } else {
        concatInputs.push(`[v${i}]`);
      }
    }

    // Concatenate all trimmed segments
    const concatFilter = hasAudio
      ? `${concatInputs.join('')}concat=n=${validSegments.length}:v=1:a=1[outv][outa]`
      : `${concatInputs.join('')}concat=n=${validSegments.length}:v=1:a=0[outv]`;

    filterParts.push(concatFilter);

    const args = [
      '-i', videoPath,
      '-filter_complex', filterParts.join(';'),
      '-map', '[outv]',
      ...(hasAudio ? ['-map', '[outa]'] : []),
      ...encodingArgs.video,
      ...(hasAudio ? encodingArgs.audio : []),
      '-fflags', '+genpts',
      '-movflags', '+faststart',
      '-y', outputPath
    ];

    await this.executeFFmpeg(args, 1800000);
  }

  /**
   * Formats time with high precision (microseconds)
   */
  private formatTimePrecise(seconds: number): string {
    return seconds.toFixed(6);
  }

  /**
   * Gets comprehensive video metadata
   */
  async getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath,
      ];

      const ffprobe = spawn(this.ffprobePath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const data = JSON.parse(stdout);
            const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
            const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');

            const metadata: VideoMetadata = {
              duration: parseFloat(data.format.duration),
              format: {
                formatName: data.format.format_name,
                formatLongName: data.format.format_long_name,
                size: parseInt(data.format.size),
                bitRate: parseInt(data.format.bit_rate),
              },
            };

            if (videoStream) {
              metadata.video = {
                codec: videoStream.codec_name,
                width: videoStream.width,
                height: videoStream.height,
                fps: this.parseFps(videoStream.r_frame_rate),
                bitRate: parseInt(videoStream.bit_rate || '0'),
                pixelFormat: videoStream.pix_fmt,
                profile: videoStream.profile,
                level: videoStream.level,
              };
            }

            if (audioStream) {
              metadata.audio = {
                codec: audioStream.codec_name,
                sampleRate: parseInt(audioStream.sample_rate),
                channels: audioStream.channels,
                bitRate: parseInt(audioStream.bit_rate || '0'),
              };
            }

            resolve(metadata);
          } catch (error) {
            reject(new Error(`Failed to parse metadata: ${(error as Error).message}`));
          }
        } else {
          reject(new Error(`FFprobe failed: ${stderr}`));
        }
      });

      ffprobe.on('error', (err) => {
        reject(new Error(`FFprobe error: ${err.message}`));
      });
    });
  }

  private parseFps(fpsString: string): number {
    const parts = fpsString.split('/');
    if (parts.length === 2) {
      return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(fpsString);
  }

  /**
   * Executes FFmpeg command with timeout and error handling
   */
  private executeFFmpeg(args: string[], timeoutMs: number = 300000): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Executing FFmpeg: ${this.ffmpegPath} ${args.join(' ').substring(0, 200)}...`);
      
      const ffmpeg = spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      let timeoutId: NodeJS.Timeout | null = null;

      timeoutId = setTimeout(() => {
        if (!ffmpeg.killed) {
          console.warn(`FFmpeg timed out after ${timeoutMs}ms`);
          ffmpeg.kill('SIGTERM');
          setTimeout(() => {
            if (!ffmpeg.killed) {
              ffmpeg.kill('SIGKILL');
            }
          }, 5000);
        }
        reject(new Error(`FFmpeg timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
        // Emit progress events based on FFmpeg output
        this.parseAndEmitProgress(data.toString());
      });

      ffmpeg.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);
        
        if (code === 0) {
          resolve();
        } else {
          const errorMsg = stderr.substring(0, 2000);
          reject(new Error(`FFmpeg failed (code ${code}): ${errorMsg}`));
        }
      });

      ffmpeg.on('error', (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(new Error(`FFmpeg process error: ${err.message}`));
      });
    });
  }

  /**
   * Parses FFmpeg output and emits progress events
   */
  private parseAndEmitProgress(output: string): void {
    // Parse time progress from FFmpeg output
    const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}.\d+)/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const seconds = parseFloat(timeMatch[3]);
      const currentTime = hours * 3600 + minutes * 60 + seconds;
      
      this.emit('progress', { currentTime });
    }

    // Parse frame count
    const frameMatch = output.match(/frame=\s*(\d+)/);
    if (frameMatch) {
      this.emit('frame', { frame: parseInt(frameMatch[1]) });
    }
  }

  /**
   * Cancels an active FFmpeg process
   */
  cancelProcess(processId: string): boolean {
    const process = this.activeProcesses.get(processId);
    if (process && !process.killed) {
      process.kill('SIGTERM');
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 2000);
      this.activeProcesses.delete(processId);
      return true;
    }
    return false;
  }
}

export default EnhancedFFmpegWrapper;