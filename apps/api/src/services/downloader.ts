import { execFile, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { getFfmpegDir, getFfmpegPath } from "../utils/ffmpeg-path";
import { HttpError } from "../lib/http-error";

const execFileAsync = promisify(execFile);

export interface YoutubeVideoMetadata {
  id: string;
  title: string;
  duration: number; // in seconds
  thumbnail: string;
  channel?: string;
  url: string;
}

export function getTempDir(subDir = "temp"): string {
  const dir = path.resolve(process.cwd(), subDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getOutputsDir(): string {
  const dir = path.resolve(process.cwd(), "outputs");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Extracts YouTube video metadata (title, duration, thumbnail) without downloading the media.
 */
export async function getYoutubeMetadata(youtubeUrl: string): Promise<YoutubeVideoMetadata> {
  const trimmed = youtubeUrl.trim();
  if (!trimmed.includes("youtube.com") && !trimmed.includes("youtu.be")) {
    throw new HttpError(400, "INVALID_URL", "URL harus merupakan tautan YouTube yang valid.");
  }

  // Parse video ID from URL as initial baseline
  let videoId = "youtube-video";
  const match = trimmed.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  if (match?.[1]) {
    videoId = match[1];
  }

  try {
    const { stdout } = await execFileAsync("yt-dlp", [
      "--print",
      "%(id)s___DIOR___%(duration)s___DIOR___%(uploader)s___DIOR___%(thumbnail)s___DIOR___%(title)s",
      "--no-playlist",
      "--skip-download",
      trimmed,
    ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });

    // Look for the line containing ___DIOR___ (yt-dlp may print warning lines first)
    const lines = stdout.split(/\r?\n/).filter((l) => l.includes("___DIOR___"));
    const dataLine = lines[0] || stdout.trim();
    const parts = dataLine.split("___DIOR___");

    if (parts.length >= 5) {
      const parsedId = parts[0]?.trim() || videoId;
      return {
        id: parsedId,
        duration: Math.round(Number(parts[1]) || 600),
        channel: parts[2]?.trim() || "YouTube Creator",
        thumbnail: parts[3]?.trim() || `https://img.youtube.com/vi/${parsedId}/hqdefault.jpg`,
        title: parts.slice(4).join(" ").trim() || "Video Sumber YouTube",
        url: trimmed,
      };
    }
  } catch (err: any) {
    console.warn("[Downloader] Gagal --print yt-dlp, fallback ke metadata sintetis:", err?.message);
  }

  return {
    id: videoId,
    title: "Video Sumber YouTube (Auto Cut)",
    duration: 600,
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    channel: "YouTube Creator",
    url: trimmed,
  };
}

/**
 * Downloads ONLY a lightweight audio stream to temporary folder for Groq Whisper transcription.
 */
export async function downloadAudioOnly(
  youtubeUrl: string,
  targetFileName?: string
): Promise<string> {
  const audioDir = getTempDir("temp/audio");
  const fileName = targetFileName || `audio_${Date.now()}`;
  const outputPath = path.join(audioDir, `${fileName}.mp3`);

  const ffmpegExe = getFfmpegPath();
  const ytdlpArgs = [
    "--js-runtimes",
    "node",
    "-f",
    "ba[ext=m4a]/ba/b",
    "--download-sections",
    "*00:00-01:30", // Fast download: first 90s (~300 words, optimal for Groq Whisper and quick viral curation)
    "--extract-audio",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "5",
    "--no-playlist",
  ];

  if (ffmpegExe && ffmpegExe !== "ffmpeg") {
    ytdlpArgs.push("--ffmpeg-location", ffmpegExe);
  }

  ytdlpArgs.push("-o", outputPath, youtubeUrl);

  try {
    await execFileAsync("yt-dlp", ytdlpArgs, { timeout: 240000 });

    if (fs.existsSync(outputPath)) {
      return outputPath;
    }
  } catch (err: any) {
    console.error("[Downloader] Gagal mengunduh audio dengan yt-dlp:", err?.message);
  }

  // If specific .mp3 is missing, check if yt-dlp created an m4a/opus/mp3 file with prefix
  const files = fs.readdirSync(audioDir);
  const match = files.find((f) => f.startsWith(fileName) && !f.endsWith(".part"));
  if (match) {
    return path.join(audioDir, match);
  }

  throw new HttpError(
    500,
    "AUDIO_DOWNLOAD_FAILED",
    "Gagal mengekstrak audio dari link YouTube. Pastikan link dapat diakses publik."
  );
}

/**
 * Verifies that the downloaded media file contains an active video stream.
 */
export function hasVideoStream(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    const ffmpegExe = getFfmpegPath();
    const res = spawnSync(ffmpegExe, ["-i", filePath], { encoding: "utf-8" });
    const output = (res.stdout || "") + (res.stderr || "");
    return output.includes("Video:");
  } catch {
    return false;
  }
}

/**
 * Downloads ONLY the exact time section (*start_time-end_time) selected by AI
 * ensuring BOTH video and audio streams are merged into the target MP4 file.
 */
export async function downloadPrecisionSection(input: {
  youtubeUrl: string;
  startTimeSec: number;
  endTimeSec: number;
  outputFilePath: string;
}): Promise<string> {
  const ffmpegExe = getFfmpegPath();
  const sectionArg = `*${Math.floor(input.startTimeSec)}-${Math.ceil(input.endTimeSec)}`;

  const tempClipDir = path.dirname(input.outputFilePath);
  if (!fs.existsSync(tempClipDir)) {
    fs.mkdirSync(tempClipDir, { recursive: true });
  }

  const ytdlpArgs = [
    "--js-runtimes",
    "node",
    "--download-sections",
    sectionArg,
    "-f",
    "bestvideo[format_note!*=Premium]+bestaudio[ext=m4a]/bestvideo[format_note!*=Premium]+bestaudio/bestvideo+bestaudio/best",
    "--merge-output-format",
    "mp4",
    "--force-keyframes-at-cuts",
  ];

  if (ffmpegExe && ffmpegExe !== "ffmpeg") {
    ytdlpArgs.push("--ffmpeg-location", ffmpegExe);
  }

  ytdlpArgs.push("-o", input.outputFilePath, input.youtubeUrl);

  try {
    await execFileAsync("yt-dlp", ytdlpArgs, { timeout: 240000 });

    if (fs.existsSync(input.outputFilePath) && hasVideoStream(input.outputFilePath)) {
      return input.outputFilePath;
    }
  } catch (err: any) {
    console.warn(`[Downloader] Precision section download gagal untuk ${sectionArg}:`, err?.message);
  }

  // If first attempt failed or lacked video, try with any available video codec excluding Premium
  if (!fs.existsSync(input.outputFilePath) || !hasVideoStream(input.outputFilePath)) {
    try {
      const fallbackArgs = [
        "--js-runtimes",
        "node",
        "--download-sections",
        sectionArg,
        "-f",
        "bv*[format_note!*=Premium]+ba/b",
        "--merge-output-format",
        "mp4",
        "--force-keyframes-at-cuts",
      ];
      if (ffmpegExe && ffmpegExe !== "ffmpeg") {
        fallbackArgs.push("--ffmpeg-location", ffmpegExe);
      }
      fallbackArgs.push("-o", input.outputFilePath, input.youtubeUrl);
      await execFileAsync("yt-dlp", fallbackArgs, { timeout: 240000 });
    } catch (retryErr: any) {
      console.warn(`[Downloader] Retry precision download gagal:`, retryErr?.message);
    }
  }

  if (fs.existsSync(input.outputFilePath) && hasVideoStream(input.outputFilePath)) {
    return input.outputFilePath;
  }

  throw new HttpError(
    500,
    "SECTION_DOWNLOAD_FAILED",
    `Gagal mengunduh segmen video pada detik ${input.startTimeSec}s - ${input.endTimeSec}s.`
  );
}
