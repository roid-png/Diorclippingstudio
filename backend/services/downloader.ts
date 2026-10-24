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

export const YTDLP_ANTIBOT_ARGS = [
  "--extractor-args",
  "youtube:player_client=android,web",
  "--user-agent",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

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
      "--js-runtimes",
      "node",
      ...YTDLP_ANTIBOT_ARGS,
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
 * Downloads ONLY a lightweight audio stream to temporary folder for Gemini Speech-to-Text transcription.
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
    ...YTDLP_ANTIBOT_ARGS,
    "-f",
    "ba[ext=m4a]/ba/b",
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
    console.warn("[Downloader] Gagal unduh audio dengan --download-sections, mencoba full audio:", err?.message);
  }

  // Fallback: try downloading full audio if sections failed
  try {
    const fallbackAudioArgs = [
      "--js-runtimes",
      "node",
      ...YTDLP_ANTIBOT_ARGS,
      "-f",
      "ba/b",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "5",
      "--no-playlist",
    ];
    if (ffmpegExe && ffmpegExe !== "ffmpeg") {
      fallbackAudioArgs.push("--ffmpeg-location", ffmpegExe);
    }
    fallbackAudioArgs.push("-o", outputPath, youtubeUrl);
    await execFileAsync("yt-dlp", fallbackAudioArgs, { timeout: 240000 });
    if (fs.existsSync(outputPath)) {
      return outputPath;
    }
  } catch (fbErr: any) {
    console.warn("[Downloader] Fallback full audio juga gagal:", fbErr?.message);
  }

  // Resolve downloaded audio file
  const resolvedRawPath = fs.existsSync(outputPath)
    ? outputPath
    : (() => {
        const files = fs.readdirSync(audioDir);
        const match = files.find((f) => f.startsWith(fileName) && !f.endsWith(".part"));
        return match ? path.join(audioDir, match) : null;
      })();

  if (resolvedRawPath && fs.existsSync(resolvedRawPath)) {
    const speechMp3Path = path.join(audioDir, `speech_${fileName}.mp3`);
    try {
      await execFileAsync(
        ffmpegExe,
        [
          "-y",
          "-i",
          resolvedRawPath,
          "-vn",
          "-map",
          "0:a:0?",
          "-ar",
          "16000",
          "-ac",
          "1",
          "-b:a",
          "32k",
          "-f",
          "mp3",
          speechMp3Path,
        ],
        { timeout: 90000 }
      );

      if (fs.existsSync(speechMp3Path) && fs.statSync(speechMp3Path).size > 500) {
        if (resolvedRawPath !== speechMp3Path) {
          try {
            fs.unlinkSync(resolvedRawPath);
          } catch {}
        }
        return speechMp3Path;
      }
    } catch (compressErr: any) {
      console.warn("[Downloader] Gagal kompresi 32k pada audio YouTube, memakai file asli:", compressErr?.message);
    }
    return resolvedRawPath;
  }

  throw new HttpError(
    400,
    "AUDIO_DOWNLOAD_FAILED",
    "Gagal mengunduh link YouTube, silakan gunakan opsi Upload Video."
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
 * Downloads full video (720p/1080p) to temp/full_videos/ cached by video ID
 * so multiple clips from the same YouTube URL do not re-download repeatedly.
 */
export async function downloadFullVideo(youtubeUrl: string): Promise<string> {
  const fullDir = getTempDir("temp/full_videos");
  const match = youtubeUrl.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  const videoId = match?.[1] || `video_${Date.now()}`;
  const fullFilePath = path.join(fullDir, `full_${videoId}.mp4`);

  if (fs.existsSync(fullFilePath) && hasVideoStream(fullFilePath)) {
    return fullFilePath;
  }

  const ffmpegExe = getFfmpegPath();
  const args = [
    "--js-runtimes",
    "node",
    ...YTDLP_ANTIBOT_ARGS,
    "-f",
    "bv*[height<=1080][ext=mp4]+ba*[ext=m4a]/b[height<=1080][ext=mp4]/bv*+ba/best",
    "--merge-output-format",
    "mp4",
    "--no-playlist",
  ];
  if (ffmpegExe && ffmpegExe !== "ffmpeg") {
    args.push("--ffmpeg-location", ffmpegExe);
  }
  args.push("-o", fullFilePath, youtubeUrl);

  try {
    await execFileAsync("yt-dlp", args, { timeout: 360000 });
    if (fs.existsSync(fullFilePath) && hasVideoStream(fullFilePath)) {
      return fullFilePath;
    }
  } catch (err: any) {
    console.warn("[Downloader] Download full video fallback gagal:", err?.message);
  }

  throw new HttpError(
    400,
    "YOUTUBE_DOWNLOAD_FAILED",
    "Gagal mengunduh link YouTube, silakan gunakan opsi Upload Video."
  );
}

/**
 * Downloads ONLY the exact time section (*start_time-end_time) selected by AI
 * ensuring BOTH video and audio streams are merged into the target MP4 file.
 * If --download-sections fails, falls back automatically to full video download + local FFmpeg cut.
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

  // 1. Attempt precision section download with anti-bot and flexible format
  const ytdlpArgs = [
    "--js-runtimes",
    "node",
    ...YTDLP_ANTIBOT_ARGS,
    "--download-sections",
    sectionArg,
    "-f",
    "bv*[ext=mp4]+ba*[ext=m4a]/b[ext=mp4]/best",
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

  // 2. Fallback Mekanisme Otomatis: Unduh video utuh 720p/1080p lalu potong rentang detik secara lokal menggunakan FFmpeg
  console.log(`[Downloader] Mengaktifkan mekanisme fallback: unduh video utuh & potong lokal dengan FFmpeg...`);
  try {
    const fullVideoPath = await downloadFullVideo(input.youtubeUrl);
    // Cut locally using frame-accurate FFmpeg re-encoding: ffmpeg -ss {start} -to {end} -i input.mp4 ...
    const safeDur = Math.max(5, Math.round(input.endTimeSec - input.startTimeSec));
    await execFileAsync(
      ffmpegExe,
      [
        "-y",
        "-ss",
        String(input.startTimeSec),
        "-t",
        String(safeDur),
        "-i",
        fullVideoPath,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        input.outputFilePath,
      ],
      { timeout: 120000 }
    );

    if (fs.existsSync(input.outputFilePath) && hasVideoStream(input.outputFilePath)) {
      return input.outputFilePath;
    }
  } catch (fallbackErr: any) {
    console.error("[Downloader] Fallback download & cut FFmpeg juga gagal:", fallbackErr?.message);
  }

  throw new HttpError(
    400,
    "YOUTUBE_DOWNLOAD_FAILED",
    "Gagal mengunduh link YouTube, silakan gunakan opsi Upload Video."
  );
}
