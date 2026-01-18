# VideoFlow Studio

> **AI-Powered Video Editing Assistant for macOS**

VideoFlow Studio is a modern Electron-based desktop application that automates repetitive video editing tasks through intelligent silence removal and repetition detection using FFmpeg and advanced processing algorithms.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-28-47848F.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg)

## ✨ Features

### Core Capabilities

- **🔇 Intelligent Silence Removal**
  - Automatically detect and remove silence segments from videos
  - Configurable threshold (dB) and duration parameters
  - Padding controls for natural cuts
  - Real-time visualization on timeline

- **🔄 Repetition Detection**
  - ML-powered detection of repetitive segments
  - Perceptual hashing for frame comparison
  - Context-aware classification (intentional vs. error)
  - Manual verification and correction

- **⚡ Background Job Processing**
  - Redis + BullMQ for robust job orchestration
  - Parallel worker pool (CPU-optimized)
  - Real-time progress tracking
  - Automatic retry on failure

- **🎨 Apple-like UI/UX**
  - Native macOS design language
  - Dark mode support
  - Fluid animations (Framer Motion)
  - Drag-and-drop file import

### Technical Highlights

- **Secure Architecture**: Sandboxed renderer, contextBridge IPC
- **Performance Optimized**: Hardware-accelerated FFmpeg (VideoToolbox)
- **Production Ready**: SQLite persistence, comprehensive error handling
- **Type Safe**: Full TypeScript implementation

## 🚀 Quick Start

### Prerequisites

- **Node.js**: 18.x or higher
- **macOS**: 12.0 (Monterey) or higher
- **FFmpeg**: 6.x (included in binaries/)
- **Redis**: 7.x (optional, can use embedded)

### Installation

```bash
# Clone repository
git clone https://github.com/your-username/videoflow-studio.git
cd videoflow-studio

# Install dependencies
npm install

# Download FFmpeg binaries (macOS)
# Place ffmpeg and ffprobe in binaries/ directory
curl -O https://evermeet.cx/ffmpeg/ffmpeg-6.1.zip
unzip ffmpeg-6.1.zip -d binaries/
curl -O https://evermeet.cx/ffmpeg/ffprobe-6.1.zip
unzip ffprobe-6.1.zip -d binaries/

# Make binaries executable
chmod +x binaries/ffmpeg binaries/ffprobe

# Start Redis (if using external instance)
redis-server --port 6379

# Start development server
npm run dev
```

### Development Mode

```bash
# Start Vite dev server + Electron
npm run dev

# Run in separate terminals for better logging:
npm run dev:vite      # Terminal 1
npm run dev:electron  # Terminal 2
```

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────┐
│           Electron Main Process             │
│  ┌───────────────────────────────────────┐  │
│  │  IPC Handlers | Services | FFmpeg    │  │
│  └───────────────────────────────────────┘  │
│                    ↕                        │
│  ┌───────────────────────────────────────┐  │
│  │    BullMQ Queue | Redis | Workers    │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                     ↕
┌─────────────────────────────────────────────┐
│         Renderer Process (React)            │
│  ┌───────────────────────────────────────┐  │
│  │  UI Components | Zustand | Tailwind  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Technology Stack

**Frontend**
- React 18 + TypeScript
- Zustand (state management)
- Tailwind CSS (styling)
- Framer Motion (animations)
- Video.js (player)

**Backend**
- Electron 28
- Node.js + TypeScript
- BullMQ (job queue)
- Redis (message broker)
- SQLite (persistence)
- FFmpeg (video processing)

**Security**
- Sandboxed renderer process
- contextBridge API exposure
- Content Security Policy
- Input sanitization

## 📁 Project Structure

```
videoflow-studio/
├── src/
│   ├── main/                # Electron main process
│   │   ├── index.ts         # Application entry
│   │   ├── ipc-handlers.ts
│   │   ├── ffmpeg/          # FFmpeg processing
│   │   │   ├── wrapper.ts
│   │   │   ├── silence-detector.ts
│   │   │   └── repetition-detector.ts
│   │   ├── queue/           # BullMQ queue management
│   │   │   ├── queue-manager.ts
│   │   │   └── worker.ts
│   │   ├── database/        # SQLite database
│   │   └── services/        # Business logic
│   │
│   ├── renderer/            # React application
│   │   ├── App.tsx
│   │   ├── components/      # UI components
│   │   ├── stores/          # Zustand stores
│   │   ├── hooks/           # React hooks
│   │   └── services/        # IPC client
│   │
│   ├── preload/             # Preload script
│   │   └── index.ts         # contextBridge API
│   │
│   └── shared/              # Shared types/utils
│
├── binaries/                # FFmpeg binaries
├── resources/               # App icons/assets
├── tests/                   # Test suites
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## 🔧 Configuration

### Environment Variables

Create `.env` file in root:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Development
NODE_ENV=development
VITE_DEV_SERVER_PORT=5173

# Logging
LOG_LEVEL=debug
```

### FFmpeg Settings

Default processing parameters:

```typescript
// Silence Removal
const defaultSilenceConfig = {
  thresholdDb: -40,        // dB threshold
  minDuration: 2,          // seconds
  paddingBefore: 0.5,      // seconds
  paddingAfter: 0.5,       // seconds
};

// Repetition Detection
const defaultRepetitionConfig = {
  similarityThreshold: 0.85,  // 0-1 scale
  minRepetitionLength: 3,     // seconds
  samplingInterval: 5,        // frames
};
```

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 📦 Building & Distribution

### Build for Production

```bash
# Build all components
npm run build

# Package for macOS
npm run build:mac
```

### Code Signing & Notarization

```bash
# Set environment variables
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password
export APPLE_ID=your@email.com
export APPLE_ID_PASSWORD=app-specific-password
export TEAM_ID=YOUR_TEAM_ID

# Build and notarize
npm run build:mac
```

Output: `release/VideoFlow Studio-1.0.0-universal.dmg`

## 🛠️ Development

### Adding New Features

1. **Main Process Features**
   - Add IPC handler in `src/main/index.ts`
   - Implement business logic in services
   - Update TypeScript interfaces

2. **UI Components**
   - Create component in `src/renderer/components/`
   - Add to Zustand store if stateful
   - Style with Tailwind classes

3. **Job Processing**
   - Extend `QueueManager` for new job types
   - Implement processor in `src/main/ffmpeg/`
   - Add progress tracking

### Debugging

```bash
# Enable Electron dev tools
NODE_ENV=development npm run dev

# View Redis queue
redis-cli
> KEYS video-processing:*
> HGETALL video-processing:{job-id}

# Check SQLite database
sqlite3 app.db
> SELECT * FROM jobs ORDER BY created_at DESC LIMIT 10;
```

## 📋 Roadmap

- [x] Core silence removal
- [x] Repetition detection
- [x] Job queue system
- [x] Apple-like UI
- [ ] Batch processing
- [ ] Cloud export (YouTube, Vimeo)
- [ ] Advanced timeline editing
- [ ] Subtitle generation
- [ ] Multi-track audio support
- [ ] Plugin system

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

```bash
# Create feature branch
git checkout -b feature/amazing-feature

# Commit changes
git commit -m "Add amazing feature"

# Push to branch
git push origin feature/amazing-feature

# Open Pull Request
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- FFmpeg team for the incredible video processing library
- Electron community for the framework
- BullMQ for robust job queue system
- Anthropic Claude for architecture assistance

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/videoflow-studio/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/videoflow-studio/discussions)
- **Email**: support@videoflowstudio.com

---

**Built with ❤️ for video editors who value their time**
