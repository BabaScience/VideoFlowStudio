# Video Editing Assistant - System Architecture

## High-Level System Architecture

```mermaid
graph TB
    subgraph "Electron Main Process"
        MP[Main Process Controller]
        IPC[IPC Communication Layer]
        FFM[FFmpeg Process Manager]
        WM[Window Manager]
        FM[File Manager]
    end
    
    subgraph "Renderer Process - React UI"
        UI[Apple-like UI Components]
        VS[Video Source Manager]
        PP[Processing Pipeline UI]
        PV[Preview Canvas]
        TC[Timeline Controller]
        NM[Notification Manager]
    end
    
    subgraph "Job Orchestration Layer"
        RD[(Redis Instance)]
        BQ[BullMQ Queue Manager]
        JW1[Job Worker 1]
        JW2[Job Worker 2]
        JWN[Job Worker N]
    end
    
    subgraph "Video Processing Engine"
        SA[Silence Analysis Module]
        RD_MOD[Repetition Detection ML]
        SEG[Segmentation Engine]
        FF[FFmpeg Wrapper]
        ME[Metadata Extractor]
    end
    
    subgraph "Storage Layer"
        LS[Local Storage - SQLite]
        FS[File System Cache]
        TMP[Temporary Processing Dir]
    end
    
    UI -->|User Actions| IPC
    IPC -->|Commands| MP
    MP -->|Manage Jobs| BQ
    BQ -->|Enqueue| RD
    RD -->|Dequeue| JW1
    RD -->|Dequeue| JW2
    RD -->|Dequeue| JWN
    
    JW1 -->|Process| SA
    JW2 -->|Process| RD_MOD
    JWN -->|Process| SEG
    
    SA -->|Execute| FF
    RD_MOD -->|Execute| FF
    SEG -->|Execute| FF
    
    FF -->|Read/Write| FS
    ME -->|Extract| FS
    
    MP -->|Store Jobs| LS
    MP -->|Update UI| IPC
    IPC -->|Render Updates| UI
    
    PV -->|Stream Preview| TMP
    TC -->|Timeline Data| LS
```

## Detailed Component Architecture

```mermaid
graph TB
    subgraph "Main Process Architecture"
        direction TB
        
        subgraph "Core Services"
            APP[Application Controller]
            CFG[Configuration Manager]
            LOG[Logging Service]
        end
        
        subgraph "FFmpeg Management"
            FFBIN[FFmpeg Binary Manager]
            FFEXEC[Process Executor]
            FFMON[Progress Monitor]
        end
        
        subgraph "IPC Handlers"
            VIPC[Video Processing IPC]
            JIPC[Job Management IPC]
            FIPC[File Operations IPC]
        end
        
        APP --> CFG
        APP --> LOG
        APP --> FFBIN
        
        VIPC --> FFEXEC
        JIPC --> QMAN[Queue Manager]
        FIPC --> FOPS[File Operations]
        
        FFEXEC --> FFMON
    end
    
    subgraph "Renderer Process - UI Components"
        direction TB
        
        subgraph "Layout Components"
            SHELL[Application Shell]
            SIDE[Sidebar Navigation]
            MAIN[Main Content Area]
            TOOL[Toolbar]
        end
        
        subgraph "Video Management"
            VLIST[Video Library]
            VIMP[Import Manager]
            VDET[Video Details Panel]
        end
        
        subgraph "Processing UI"
            PCONF[Processing Configuration]
            PMON[Progress Monitor UI]
            PRES[Results Preview]
        end
        
        SHELL --> SIDE
        SHELL --> MAIN
        SHELL --> TOOL
        
        MAIN --> VLIST
        MAIN --> PCONF
        MAIN --> PMON
        
        VIMP --> VLIST
        VLIST --> VDET
        PCONF --> PMON
        PMON --> PRES
    end
```

## Job Processing Pipeline

```mermaid
sequenceDiagram
    participant UI as React UI
    participant IPC as IPC Channel
    participant MP as Main Process
    participant BQ as BullMQ Queue
    participant RD as Redis
    participant WK as Worker Process
    participant FF as FFmpeg Engine
    participant FS as File System
    
    UI->>IPC: Submit Video Processing Job
    IPC->>MP: Handle Process Request
    MP->>MP: Validate Input Parameters
    MP->>BQ: Enqueue Job with Metadata
    BQ->>RD: Store Job in Queue
    
    Note over RD,WK: Job Distribution Phase
    
    WK->>RD: Poll for Available Jobs
    RD->>WK: Assign Job to Worker
    WK->>WK: Parse Job Configuration
    
    alt Silence Detection Job
        WK->>FF: Execute Silence Detection
        FF->>FS: Analyze Audio Stream
        FS->>FF: Return Audio Segments
        FF->>WK: Silence Timestamps
    else Repetition Detection Job
        WK->>FF: Extract Frame Hashes
        FF->>FS: Read Video Frames
        FS->>FF: Frame Data
        FF->>WK: Compute Perceptual Hashes
        WK->>WK: ML-based Similarity Analysis
    end
    
    WK->>FF: Execute Video Segmentation
    FF->>FS: Write Processed Segments
    FS->>FF: Confirm Write
    
    WK->>RD: Update Job Progress (25%, 50%, 75%)
    RD->>BQ: Progress Event
    BQ->>MP: Notify Progress
    MP->>IPC: Emit Progress Event
    IPC->>UI: Update Progress UI
    
    WK->>RD: Mark Job Completed
    RD->>BQ: Completion Event
    BQ->>MP: Job Complete Notification
    MP->>IPC: Emit Completion Event
    IPC->>UI: Show Results & Preview
```

## Silence Detection Algorithm Flow

```mermaid
flowchart TD
    START([Video Input]) --> EXTRACT[Extract Audio Stream]
    EXTRACT --> NORM[Normalize Audio Levels]
    NORM --> DETECT[Detect Silence Segments]
    
    DETECT --> PARAM{Check Parameters}
    PARAM -->|Threshold dB| DB[Apply dB Threshold Filter]
    PARAM -->|Min Duration| DUR[Filter by Minimum Duration]
    
    DB --> MERGE[Merge Adjacent Segments]
    DUR --> MERGE
    
    MERGE --> VALIDATE[Validate Segments]
    VALIDATE --> DECISION{Has Valid Cuts?}
    
    DECISION -->|Yes| GENERATE[Generate Cut List]
    DECISION -->|No| WARN[Warn: No Silence Detected]
    
    GENERATE --> SPLIT[Split Video at Timestamps]
    SPLIT --> CONCAT[Concatenate Non-Silent Parts]
    CONCAT --> ENCODE[Re-encode Output]
    ENCODE --> OUTPUT([Processed Video])
    
    WARN --> END([Return Original])
```

## Repetition Detection Algorithm Flow

```mermaid
flowchart TD
    START([Video Input]) --> SAMPLE[Sample Frames at Intervals]
    SAMPLE --> HASH[Compute Perceptual Hashes]
    HASH --> STORE[Store in Hash Table]
    
    STORE --> COMPARE[Compare Adjacent Segments]
    COMPARE --> SIMILARITY{Similarity Score}
    
    SIMILARITY -->|> Threshold| MARK[Mark as Repetitive]
    SIMILARITY -->|< Threshold| KEEP[Mark as Unique]
    
    MARK --> CHECK{Check Context}
    CHECK -->|Natural Loop| KEEP2[Keep Segment]
    CHECK -->|Error/Stutter| REMOVE[Mark for Removal]
    
    KEEP --> COLLECT[Collect All Segments]
    KEEP2 --> COLLECT
    REMOVE --> COLLECT
    
    COLLECT --> FILTER[Filter Repetitions]
    FILTER --> TIMELINE[Generate Edit Timeline]
    TIMELINE --> CUT[Execute Cuts]
    CUT --> OUTPUT([Processed Video])
```

## Data Flow Architecture

```mermaid
graph LR
    subgraph "Input Layer"
        VIDEO[Video Files]
        CONFIG[User Configuration]
    end
    
    subgraph "Processing Layer"
        QUEUE[Job Queue]
        WORKER[Worker Pool]
        FFMPEG[FFmpeg Engine]
    end
    
    subgraph "Storage Layer"
        CACHE[Processing Cache]
        METADATA[Video Metadata DB]
        RESULTS[Processed Results]
    end
    
    subgraph "Output Layer"
        PREVIEW[Preview Stream]
        EXPORT[Exported Video]
        TIMELINE[Edit Timeline]
    end
    
    VIDEO --> QUEUE
    CONFIG --> QUEUE
    QUEUE --> WORKER
    WORKER --> FFMPEG
    
    FFMPEG --> CACHE
    FFMPEG --> METADATA
    
    CACHE --> RESULTS
    RESULTS --> PREVIEW
    RESULTS --> EXPORT
    RESULTS --> TIMELINE
```

## State Management Architecture

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> Importing: User Imports Video
    Importing --> Analyzing: File Validated
    Analyzing --> Configured: Metadata Extracted
    
    Configured --> Processing: User Starts Processing
    Processing --> Queued: Job Enqueued
    Queued --> Executing: Worker Picks Job
    
    Executing --> Progress25: 25% Complete
    Progress25 --> Progress50: 50% Complete
    Progress50 --> Progress75: 75% Complete
    Progress75 --> Finalizing: 95% Complete
    
    Finalizing --> Completed: Processing Success
    Finalizing --> Failed: Processing Error
    
    Completed --> Previewing: User Reviews
    Previewing --> Exporting: User Exports
    Exporting --> [*]: Export Complete
    
    Failed --> Configured: User Retries
    Failed --> [*]: User Cancels
    
    state Executing {
        [*] --> SilenceDetection
        SilenceDetection --> RepetitionDetection
        RepetitionDetection --> Segmentation
        Segmentation --> [*]
    }
```

## Component Interaction Model

```mermaid
graph TB
    subgraph "Frontend Components"
        VC[VideoCard Component]
        PC[ProcessingConfig Component]
        PM[ProgressMonitor Component]
        PV[PreviewPlayer Component]
    end
    
    subgraph "State Management - Zustand"
        VS[Video Store]
        JS[Job Store]
        US[UI Store]
    end
    
    subgraph "IPC Bridge"
        IPCClient[IPC Client Wrapper]
        EventBus[Event Bus]
    end
    
    subgraph "Backend Services"
        JobService[Job Service]
        VideoService[Video Service]
        FileService[File Service]
    end
    
    VC -->|Dispatch Action| VS
    PC -->|Configure Job| JS
    PM -->|Subscribe Updates| EventBus
    PV -->|Request Stream| VS
    
    VS -->|IPC Call| IPCClient
    JS -->|IPC Call| IPCClient
    
    IPCClient -->|video:process| VideoService
    IPCClient -->|job:create| JobService
    
    EventBus <-->|Bidirectional Events| IPCClient
    
    JobService -->|Manage| JobQueue[BullMQ Queue]
    VideoService -->|Execute| FFmpegService[FFmpeg Service]
```

## Security & Sandboxing Architecture

```mermaid
graph TB
    subgraph "Renderer Process - Sandboxed"
        UI[React Application]
        PRELOAD[Preload Script]
    end
    
    subgraph "Main Process - Privileged"
        IPC_HANDLER[IPC Handler with Validation]
        FILE_ACCESS[File System Access Control]
        PROCESS_SPAWN[Process Spawner]
    end
    
    subgraph "External Processes"
        FFMPEG[FFmpeg Binary]
        REDIS[Redis Server]
    end
    
    UI -->|contextBridge API| PRELOAD
    PRELOAD -->|Whitelisted Channels| IPC_HANDLER
    
    IPC_HANDLER -->|Validate & Sanitize| FILE_ACCESS
    IPC_HANDLER -->|Controlled Execution| PROCESS_SPAWN
    
    FILE_ACCESS -->|Read/Write Limits| FS[(File System)]
    PROCESS_SPAWN -->|Spawn & Monitor| FFMPEG
    PROCESS_SPAWN -->|Manage Connection| REDIS
    
    style UI fill:#e1f5ff
    style IPC_HANDLER fill:#fff4e1
    style FFMPEG fill:#ffe1e1
```