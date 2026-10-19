import path from "node:path";
import fs from "node:fs";

let cachedFfmpegPath: string | null = null;

export function getFfmpegPath(): string {
  if (cachedFfmpegPath && fs.existsSync(cachedFfmpegPath)) {
    return cachedFfmpegPath;
  }

  // 1. Try @ffmpeg-installer/ffmpeg
  try {
    const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
    if (ffmpegInstaller.path && fs.existsSync(ffmpegInstaller.path)) {
      cachedFfmpegPath = ffmpegInstaller.path;
      return cachedFfmpegPath!;
    }
  } catch {}

  // 2. Check local node_modules
  const candidate = path.resolve(
    process.cwd(),
    "node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe"
  );
  if (fs.existsSync(candidate)) {
    cachedFfmpegPath = candidate;
    return candidate;
  }

  // 3. Fallback to system "ffmpeg"
  cachedFfmpegPath = "ffmpeg";
  return "ffmpeg";
}

