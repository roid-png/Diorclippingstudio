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

  // 2. Check monorepo root and current working directory
  const searchRoots = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
  ];

  for (const root of searchRoots) {
    const directCandidate = path.join(
      root,
      "node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe"
    );
    if (fs.existsSync(directCandidate)) {
      cachedFfmpegPath = directCandidate;
      return directCandidate;
    }

    // Check pnpm virtual store
    const pnpmCandidate = path.join(
      root,
      "node_modules/.pnpm/@ffmpeg-installer+win32-x64@4.1.0/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe"
    );
    if (fs.existsSync(pnpmCandidate)) {
      cachedFfmpegPath = pnpmCandidate;
      return pnpmCandidate;
    }
  }

  // 3. Fallback to system ffmpeg
  cachedFfmpegPath = "ffmpeg";
  return "ffmpeg";
}

export function getFfmpegDir(): string {
  const exePath = getFfmpegPath();
  if (exePath === "ffmpeg") {
    return "";
  }
  return path.dirname(exePath);
}
