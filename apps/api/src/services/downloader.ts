import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { getFfmpegPath } from "../utils/ffmpeg-path";
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

  try {
    const { stdout } = await execFileAsync("yt-dlp", [
      "--dump-json",
      "--no-playlist",
      "--skip-download",
      trimmed,
    ], { timeout: 30000 });

    const data = JSON.parse(stdout);
    return {
      id: data.id || "youtube-video",
      title: data.title || "Video Sumber YouTube",
      duration: Math.round(Number(data.duration) || 600),
      thumbnail:
        data.thumbnail ||
        (data.thumbnails && data.thumbnails[0]?.url) ||
        `https://img.youtube.com/vi/${data.id}/hqdefault.jpg`,
      channel: data.uploader || data.channel || "YouTube Creator",
      url: trimmed,
    };
  } catch (err: any) {
    console.warn("[Downloader] Gagal dump-json yt-dlp, fallback ke metadata sintetis:", err?.message);
    // Parse video ID from URL if possible
    let videoId = "video-source";
    const match = trimmed.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    if (match?.[1]) {
      videoId = match[1];
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

  const ffmpegLocation = path.dirname(getFfmpegPath());

  try {
    await execFileAsync("yt-dlp", [
      "-f",
      "ba[ext=m4a]/ba/b",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "5", // lightweight format for speech recognition
      "--no-playlist",
      "--ffmpeg-location",
      ffmpegLocation,
      "-o",
      outputPath,
      youtubeUrl,
    ], { timeout: 90000 });

    if (fs.existsSync(outputPath)) {
      return outputPath;
    }
  } catch (err: any) {
    console.error("[Downloader] Gagal mengunduh audio dengan yt-dlp:", err?.message);
  }

  // If specific .mp3 is missing, check if yt-dlp created an m4a/opus/mp3 file with prefix
  const files = fs.readdirSync(audioDir);
  const match = files.find((f) => f.startsWith(fileName));
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
 * Downloads ONLY the exact time section (*start_time-end_time) selected by AI
 * to save bandwidth and RAM.
 */
export async function downloadPrecisionSection(input: {
  youtubeUrl: string;
  startTimeSec: number;
  endTimeSec: number;
  outputFilePath: string;
}): Promise<string> {
  const ffmpegLocation = path.dirname(getFfmpegPath());
  const sectionArg = `*${Math.floor(input.startTimeSec)}-${Math.ceil(input.endTimeSec)}`;

  const tempClipDir = path.dirname(input.outputFilePath);
  if (!fs.existsSync(tempClipDir)) {
    fs.mkdirSync(tempClipDir, { recursive: true });
  }

  try {
    await execFileAsync("yt-dlp", [
      "--download-sections",
      sectionArg,
      "-f",
      "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
      "--force-keyframes-at-cuts",
      "--ffmpeg-location",
      ffmpegLocation,
      "-o",
      input.outputFilePath,
      input.youtubeUrl,
    ], { timeout: 120000 });

    if (fs.existsSync(input.outputFilePath)) {
      return input.outputFilePath;
    }
  } catch (err: any) {
    console.warn(`[Downloader] Precision section download gagal untuk ${sectionArg}:`, err?.message);
  }

  if (fs.existsSync(input.outputFilePath)) {
    return input.outputFilePath;
  }

  throw new HttpError(
    500,
    "SECTION_DOWNLOAD_FAILED",
    `Gagal mengunduh segmen video pada detik ${input.startTimeSec}s - ${input.endTimeSec}s.`
  );
}

