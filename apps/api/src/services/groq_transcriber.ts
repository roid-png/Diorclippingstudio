import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Groq from "groq-sdk";
import { getFfmpegPath } from "../utils/ffmpeg-path";
import { getTempDir } from "./downloader";
import { HttpError } from "../lib/http-error";
import { executeGroqWithFailover, getGroqKeys } from "./api_key_manager";

const execFileAsync = promisify(execFile);

export interface GroqWord {
  word: string;
  start: number;
  end: number;
}

export interface GroqSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface GroqTranscriptionResult {
  text: string;
  duration: number;
  words: GroqWord[];
  segments?: GroqSegment[];
}

export { getGroqKeys };

/**
 * [FASE 1 & 2: TRANSCRIBE WITH AUTO-FAILOVER]
 * Transcribes an audio file slice using Groq whisper-large-v3 with word-level & segment timestamps.
 * Automatically fails over from GROQ_API_KEY_PRIMARY to GROQ_API_KEY_BACKUP on rate limits (429) or network errors.
 */
export async function transcribeWithGroqFailover(
  audioFilePath: string,
  options?: { language?: string }
): Promise<GroqTranscriptionResult> {
  if (!fs.existsSync(audioFilePath)) {
    throw new HttpError(
      404,
      "AUDIO_FILE_NOT_FOUND",
      `File audio tidak ditemukan: ${audioFilePath}`
    );
  }

  return await executeGroqWithFailover(async (client, keyInfo) => {
    console.log(
      `[GroqTranscriber] Memulai transkripsi akustik word-level via Groq (${keyInfo.label})...`
    );

    const fileStream = fs.createReadStream(audioFilePath);
    const res: any = await client.audio.transcriptions.create({
      file: fileStream,
      model: "whisper-large-v3",
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"],
      language: options?.language || "id",
    });

    const text = res.text || "";
    const rawWords = res.words || [];
    const rawSegments = res.segments || [];

    // Zero-Offset: Timestamps are directly relative to the start of this audio slice (0.00s)
    const words: GroqWord[] = rawWords.map((w: any) => ({
      word: String(w.word || "").trim(),
      start: Math.max(0, parseFloat(Number(w.start || 0).toFixed(2))),
      end: Math.max(0.1, parseFloat(Number(w.end || 0).toFixed(2))),
    }));

    const segments: GroqSegment[] = rawSegments.map((s: any) => ({
      id: Number(s.id || 0),
      start: Math.max(0, parseFloat(Number(s.start || 0).toFixed(2))),
      end: Math.max(0.1, parseFloat(Number(s.end || 0).toFixed(2))),
      text: String(s.text || "").trim(),
    }));

    const duration =
      Number(res.duration) ||
      (words.length > 0 ? words[words.length - 1]!.end : 0);

    console.log(
      `[GroqTranscriber] Berhasil (${keyInfo.label}): ${words.length} kata, ${segments.length} segmen, durasi ${duration.toFixed(2)}s`
    );

    return {
      text,
      duration,
      words,
      segments,
    };
  }, 60000);
}

/**
 * [FASE 2: PRECISION SLICED AUDIO & ZERO-OFFSET SUBTITLE]
 * Step A: Uses FFmpeg with `-ss` BEFORE `-i` (Fast Seeking) to slice audio ONLY for the chosen viral clip range.
 * Formula: `ffmpeg -y -ss {clip.start_time} -to {clip.end_time} -accurate_seek -i "{input_video}" -vn -map 0:a:0 -ar 16000 -ac 1 -b:a 32k -f mp3 "{job_temp_dir}/slice_{clip_id}.mp3"`
 * Step B: Sends `slice_{clip_id}.mp3` (< 500 KB) to Groq whisper-large-v3.
 * Step C: Words already start at 0.00s natively!
 */
export async function extractAudioSliceAndTranscribe(input: {
  videoPath: string;
  startTimeSec: number;
  endTimeSec: number;
  outputDir?: string;
  clipId?: string;
}): Promise<GroqTranscriptionResult> {
  const ffmpegExe = getFfmpegPath();
  const targetDir = input.outputDir || getTempDir("temp/audio_slices");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const clipId =
    input.clipId ||
    `slice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const slicePath = path.join(targetDir, `slice_${clipId}.mp3`);

  console.log(
    `[GroqTranscriber] Mengiris audio mikro (-ss ${input.startTimeSec}s -> ${input.endTimeSec}s) dari ${input.videoPath}...`
  );

  // FFmpeg Fast Seeking with -ss before -i and -accurate_seek
  try {
    await execFileAsync(ffmpegExe, [
      "-y",
      "-ss", String(input.startTimeSec),
      "-to", String(input.endTimeSec),
      "-accurate_seek",
      "-i", input.videoPath,
      "-vn",
      "-map", "0:a:0?",
      "-ar", "16000",
      "-ac", "1",
      "-b:a", "32k",
      "-f", "mp3",
      slicePath,
    ]);
  } catch {
    await execFileAsync(ffmpegExe, [
      "-y",
      "-ss", String(input.startTimeSec),
      "-to", String(input.endTimeSec),
      "-accurate_seek",
      "-i", input.videoPath,
      "-vn",
      "-ar", "16000",
      "-ac", "1",
      "-b:a", "32k",
      "-f", "mp3",
      slicePath,
    ]);
  }

  if (!fs.existsSync(slicePath)) {
    throw new HttpError(
      500,
      "AUDIO_SLICE_EXTRACTION_FAILED",
      "Gagal mengekstrak irisan audio segmen."
    );
  }

  const stat = fs.statSync(slicePath);
  const sizeKb = (stat.size / 1024).toFixed(1);
  console.log(
    `[GroqTranscriber] File irisan dibuat: ${slicePath} (${sizeKb} KB - bebas limit 25MB)`
  );

  try {
    const res = await transcribeWithGroqFailover(slicePath);
    return res;
  } finally {
    try {
      if (fs.existsSync(slicePath)) {
        fs.unlinkSync(slicePath);
        console.log(`[GroqTranscriber] Auto-cleanup file irisan: ${slicePath}`);
      }
    } catch {}
  }
}
