# FFmpeg Binaries

This directory should contain FFmpeg and FFprobe binaries for macOS.

## Installation

### Option 1: Using Homebrew (Recommended)

```bash
brew install ffmpeg
```

Then create symlinks:
```bash
ln -s $(which ffmpeg) binaries/ffmpeg
ln -s $(which ffprobe) binaries/ffprobe
```

### Option 2: Download Static Builds

Download FFmpeg static builds for macOS from:
- https://evermeet.cx/ffmpeg/ (for Intel Macs)
- https://osxexperts.net/ (for Apple Silicon Macs)

Place `ffmpeg` and `ffprobe` executables in this directory and make them executable:

```bash
chmod +x binaries/ffmpeg
chmod +x binaries/ffprobe
```

### Option 3: Build from Source

See FFmpeg documentation: https://ffmpeg.org/download.html

## Verification

After adding binaries, verify they work:

```bash
./binaries/ffmpeg -version
./binaries/ffprobe -version
```

## Note

The binaries must be:
- Executable (`chmod +x`)
- Compatible with your Mac architecture (Intel x64 or Apple Silicon arm64)
- Statically compiled (recommended) or have all dependencies available
