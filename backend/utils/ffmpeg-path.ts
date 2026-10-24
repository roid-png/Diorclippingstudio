import path from "node:path";
import fs from "node:fs";
import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

let cachedFfmpegPath: string | null = null;
let cachedFfprobePath: string | null = null;

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

export function getFfprobePath(): string {
  if (cachedFfprobePath && fs.existsSync(cachedFfprobePath)) {
    return cachedFfprobePath;
  }

  // 1. Try @ffprobe-installer/ffprobe
  try {
    const ffprobeInstaller = require("@ffprobe-installer/ffprobe");
    if (ffprobeInstaller.path && fs.existsSync(ffprobeInstaller.path)) {
      cachedFfprobePath = ffprobeInstaller.path;
      return cachedFfprobePath!;
    }
  } catch {}

  const searchRoots = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
  ];

  for (const root of searchRoots) {
    // 2. Check @ffprobe-installer win32-x64 directly
    const ffprobeDirect = path.join(
      root,
      "node_modules/@ffprobe-installer/win32-x64/ffprobe.exe"
    );
    if (fs.existsSync(ffprobeDirect)) {
      cachedFfprobePath = ffprobeDirect;
      return ffprobeDirect;
    }

    const ffprobePnpm = path.join(
      root,
      "node_modules/.pnpm/@ffprobe-installer+win32-x64@5.2.0/node_modules/@ffprobe-installer/win32-x64/ffprobe.exe"
    );
    if (fs.existsSync(ffprobePnpm)) {
      cachedFfprobePath = ffprobePnpm;
      return ffprobePnpm;
    }
  }

  // 3. Try alongside ffmpeg
  const ffmpegDir = getFfmpegDir();
  if (ffmpegDir) {
    const siblingFfprobe = path.join(ffmpegDir, "ffprobe.exe");
    if (fs.existsSync(siblingFfprobe)) {
      cachedFfprobePath = siblingFfprobe;
      return siblingFfprobe;
    }
  }

  cachedFfprobePath = "ffprobe";
  return "ffprobe";
}

/**
 * Returns exact media duration in seconds dynamically using ffprobe,
 * with fallback to ffmpeg banner parsing.
 */
export async function getVideoDurationSeconds(filePath: string): Promise<number> {
  const ffprobeExe = getFfprobePath();

  // Try ffprobe first
  try {
    const { stdout } = await execFileAsync(
      ffprobeExe,
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { timeout: 15000 }
    );
    const parsed = parseFloat(stdout.trim());
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  } catch (err: any) {
    // ffprobe failed or timed out, fallback to ffmpeg banner
  }

  // Fallback: spawnSync ffmpeg -i
  try {
    const ffmpegExe = getFfmpegPath();
    const res = spawnSync(ffmpegExe, ["-i", filePath], { encoding: "utf-8" });
    const output = (res.stdout || "") + (res.stderr || "");
    const match = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (match && match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
      const hours = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      const secs = parseFloat(match[3]);
      return hours * 3600 + mins * 60 + secs;
    }
  } catch {}

  return 0;
}
