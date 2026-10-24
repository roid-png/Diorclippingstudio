import fs from "node:fs";
import path from "node:path";
import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { jsonrepair } from "jsonrepair";
import { HttpError } from "../lib/http-error";
import { getFfmpegPath } from "../utils/ffmpeg-path";
import { buildWordTimings } from "./subtitle-transcription.service";
import { transcribeWithGroqFailover } from "./groq_transcriber";
import {
  getTranscriptionKeys,
  getGeminiClient,
  getGeminiFileManager,
  isQuotaOrRateLimitError,
} from "./api_key_manager";

const execFileAsync = promisify(execFile);

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WordTimestamp[];
}

export interface WordLevelTranscription {
  text: string;
  duration: number;
  words: WordTimestamp[];
  segments: TranscriptionSegment[];
}

function readKeyFromFile(keyName: string): string {
  const possiblePaths = [
    path.resolve(process.cwd(), "../../backend/.env"),
    path.resolve(process.cwd(), "../backend/.env"),
    path.resolve(process.cwd(), "backend/.env"),
    path.resolve(process.cwd(), "../../.env.local"),
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), ".env"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const text = fs.readFileSync(p, "utf-8");
        const match = text.match(new RegExp(`${keyName}\\s*=\\s*["']?([^"'\\r\\n]+)["']?`));
        if (match?.[1]?.trim()) {
          return match[1].trim();
        }
      } catch {}
    }
  }
  return "";
}

/**
 * Returns Gemini API Key for Transcription (Account 1 - Audio/File API).
 */
export function getGeminiTranscriptionApiKey(): string {
  let key = process.env.GEMINI_API_KEY_TRANSCRIPTION?.trim() || "";
  if (!key || key.length < 15) {
    key = readKeyFromFile("GEMINI_API_KEY_TRANSCRIPTION");
  }
  if (!key || key.length < 15) {
    key = process.env.GEMINI_API_KEY?.trim() || "";
  }
  return key;
}

/**
 * Returns Gemini API Key for Curation & Vision (Account 2 - Viral Analysis & Cloner).
 */
export function getGeminiCurationApiKey(): string {
  let key = process.env.GEMINI_API_KEY_CURATION?.trim() || "";
  if (!key || key.length < 15) {
    key = readKeyFromFile("GEMINI_API_KEY_CURATION");
  }
  if (!key || key.length < 15) {
    key = process.env.GEMINI_API_KEY?.trim() || "";
  }
  return key;
}

/**
 * Reads audio duration in seconds using FFmpeg.
 */
export function getAudioDurationSeconds(audioPath: string): number {
  try {
    const ffmpegExe = getFfmpegPath();
    const res = spawnSync(ffmpegExe, ["-i", audioPath], { encoding: "utf-8" });
    const output = (res.stdout || "") + (res.stderr || "");
    const match = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (match && match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
      const hours = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      const secs = parseFloat(match[3]);
      return hours * 3600 + mins * 60 + secs;
    }
  } catch (e) {
    console.warn("[Transcriber] Gagal membaca durasi audio via ffmpeg:", e);
  }
  return 0;
}

/**
 * Optimizes audio before upload using FFmpeg low profile (mono 16kHz, 32kbps).
/**
 * [FASE 2: EKSTRAKSI 1 SINGLE FULL-LENGTH AUDIO TERKOMPRESI]
 * Formula: ffmpeg -y -i "{input_video}" -vn -map 0:a:0? -ar 16000 -ac 1 -b:a 24k -f mp3 full_master_audio.mp3
 * Extracts lightweight mono 16kHz 24kbps speech audio from the entire video (no duration cap).
 * 60 minutes = ~10.5 MB; 120 minutes = ~21 MB.
 */
export async function extractFullMasterAudio(
  inputMediaFilePath: string,
  outputAudioPath: string,
  timeoutMs?: number
): Promise<string> {
  const ffmpegExe = getFfmpegPath();
  const dir = path.dirname(outputAudioPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Generous 30-minute timeout & 50MB maxBuffer to prevent overflows on long videos
  const execOptions = {
    timeout: timeoutMs || 1800000,
    maxBuffer: 50 * 1024 * 1024,
  };

  try {
    await execFileAsync(
      ffmpegExe,
      [
        "-threads",
        "0",
        "-nostats",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputMediaFilePath,
        "-vn",
        "-map",
        "0:a:0?",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "32k",
        "-f",
        "mp3",
        outputAudioPath,
      ],
      execOptions
    );
  } catch (err: any) {
    // Fallback without explicit stream mapping
    try {
      await execFileAsync(
        ffmpegExe,
        [
          "-threads",
          "0",
          "-nostats",
          "-loglevel",
          "error",
          "-y",
          "-i",
          inputMediaFilePath,
          "-vn",
          "-ar",
          "16000",
          "-ac",
          "1",
          "-c:a",
          "libmp3lame",
          "-b:a",
          "32k",
          "-f",
          "mp3",
          outputAudioPath,
        ],
        execOptions
      );
    } catch (fbErr: any) {
      throw new HttpError(
        500,
        "FULL_AUDIO_EXTRACTION_FAILED",
        `Gagal mengekstrak audio master utuh: ${fbErr?.message || err?.message}`
      );
    }
  }

  if (!fs.existsSync(outputAudioPath) || fs.statSync(outputAudioPath).size === 0) {
    throw new HttpError(
      500,
      "FULL_AUDIO_EMPTY",
      "Hasil ekstraksi audio kosong atau tidak ditemukan."
    );
  }

  return outputAudioPath;
}

/**
 * Optimizes audio before upload using FFmpeg low profile (mono 16kHz, 24-32kbps).
 */
export async function extractOptimizedAudio(
  inputMediaFilePath: string,
  outputAudioPath: string,
  maxDurationSec?: number
): Promise<string> {
  if (!maxDurationSec) {
    return await extractFullMasterAudio(inputMediaFilePath, outputAudioPath);
  }

  const ffmpegExe = getFfmpegPath();
  const execOptions = {
    timeout: 600000,
    maxBuffer: 50 * 1024 * 1024,
  };

  try {
    await execFileAsync(
      ffmpegExe,
      [
        "-threads",
        "0",
        "-nostats",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputMediaFilePath,
        "-vn",
        "-map",
        "0:a:0?",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "32k",
        "-t",
        String(maxDurationSec),
        "-f",
        "mp3",
        outputAudioPath,
      ],
      execOptions
    );
  } catch (err: any) {
    // Fallback without explicit map if -map 0:a:0? fails
    try {
      await execFileAsync(
        ffmpegExe,
        [
          "-threads",
          "0",
          "-nostats",
          "-loglevel",
          "error",
          "-y",
          "-i",
          inputMediaFilePath,
          "-vn",
          "-ar",
          "16000",
          "-ac",
          "1",
          "-c:a",
          "libmp3lame",
          "-b:a",
          "32k",
          "-t",
          String(maxDurationSec),
          "-f",
          "mp3",
          outputAudioPath,
        ],
        execOptions
      );
    } catch (fbErr: any) {
      throw new HttpError(
        500,
        "AUDIO_EXTRACTION_FAILED",
        `Gagal mengekstrak audio: ${fbErr?.message || err?.message}`
      );
    }
  }

  if (!fs.existsSync(outputAudioPath) || fs.statSync(outputAudioPath).size === 0) {
    throw new HttpError(
      400,
      "AUDIO_EMPTY",
      "File audio kosong atau tidak memiliki track audio yang valid."
    );
  }

  const stat = fs.statSync(outputAudioPath);
  console.log(
    `[Transcriber] Audio dioptimasi (16kHz mono): ${Math.round(stat.size / 1024)} KB (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`
  );
  return outputAudioPath;
}

/**
 * Safely parses JSON returned by Gemini, with automatic jsonrepair and regex recovery
 * if output tokens were truncated mid-sentence. Gracefully handles silent or music chunks.
 */
function safeParseGeminiTranscriptJson(rawText: string): any {
  let clean = (rawText || "").trim();

  // 0. Handle no speech / silent chunk gracefully
  const lower = clean.toLowerCase();
  if (
    !clean ||
    lower.includes("no speech") ||
    lower.includes("no dialogue") ||
    lower.includes("no spoken") ||
    lower.includes("silent") ||
    lower.includes("tidak ada percakapan") ||
    lower.includes("tidak ada suara")
  ) {
    console.log("[Transcriber] Tidak ada percakapan terdeteksi pada chunk ini (hening/musik).");
    return { segments: [], words: [] };
  }

  // 1. Extract JSON block if surrounded by markdown or explanatory text
  const codeBlockMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    clean = codeBlockMatch[1].trim();
  } else {
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }
  }

  // 2. Direct standard parse
  try {
    const parsed = JSON.parse(clean);
    return parsed;
  } catch (firstErr: any) {
    console.warn(
      `[Transcriber] Parsing JSON langsung gagal (${firstErr.message}), mencoba perbaikan otomatis dengan jsonrepair...`
    );
  }

  // 3. Auto-repair with jsonrepair (repairs unterminated strings, unclosed braces/brackets)
  try {
    const repaired = jsonrepair(clean);
    const parsed = JSON.parse(repaired);
    console.log("[Transcriber] Berhasil memulihkan struktur JSON menggunakan jsonrepair!");
    return parsed;
  } catch (repairErr: any) {
    console.warn("[Transcriber] jsonrepair gagal:", repairErr?.message);
  }

  // 4. Flexible Regex fallback: match any JSON object with start, end, and text in ANY property order
  const segmentRegex =
    /\{[^{}]*?"(?:start|startTime)"\s*:\s*([0-9.]+)[^{}]*?"(?:end|endTime)"\s*:\s*([0-9.]+)[^{}]*?"text"\s*:\s*"([^"]*)"[^{}]*?\}/gi;
  const recoveredSegments: any[] = [];
  let match;
  while ((match = segmentRegex.exec(rawText)) !== null) {
    recoveredSegments.push({
      start: parseFloat(match[1] || "0"),
      end: parseFloat(match[2] || "0"),
      text: match[3] || "",
    });
  }

  if (recoveredSegments.length > 0) {
    console.log(`[Transcriber] Berhasil memulihkan ${recoveredSegments.length} segmen melalui regex fallback!`);
    return { segments: recoveredSegments };
  }

  // 5. Fallback if only raw text or truncated text was output
  const textMatches = Array.from(rawText.matchAll(/"text"\s*:\s*"([^"]+)"/g));
  if (textMatches.length > 0) {
    const combined = textMatches.map((m) => m[1]).join(" ");
    console.log(`[Transcriber] Berhasil mengekstrak ${textMatches.length} potongan teks dari output Gemini.`);
    return {
      text: combined,
      segments: [
        {
          start: 0,
          end: 30,
          text: combined.slice(0, 500),
        },
      ],
    };
  }

  // 6. Graceful empty return instead of throwing 500 to keep multi-chunk processing intact
  console.warn("[Transcriber] Peringatan: Tidak ada percakapan terformat yang dapat diekstrak, mengembalikan segmen kosong.");
  return { segments: [], words: [] };
}

/**
 * Transcribes a single audio file/chunk via Google Gemini File API.
 */
async function transcribeSingleChunkGemini(
  audioFilePath: string,
  fileManager: GoogleAIFileManager,
  aiTranscribe: GoogleGenerativeAI,
  offsetSec = 0
): Promise<WordLevelTranscription> {
  const stat = fs.statSync(audioFilePath);
  let uploadResult: any = null;
  let lastUploadErr: any = null;

  try {
    // Retry loop up to 3 times to prevent transient fetch failed network drops
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        uploadResult = await fileManager.uploadFile(audioFilePath, {
          mimeType: "audio/mp3",
          displayName: `audio_${path.basename(audioFilePath, path.extname(audioFilePath))}`,
        });
        if (uploadResult?.file?.name) {
          break;
        }
      } catch (uploadErr: any) {
        lastUploadErr = uploadErr;
        console.warn(
          `[Transcriber] Gagal upload audio ke Google File API (percobaan ${attempt}/3):`,
          uploadErr?.message || uploadErr
        );
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    if (!uploadResult?.file?.name) {
      throw new HttpError(
        500,
        "GOOGLE_FILE_UPLOAD_FAILED",
        `Gagal mengunggah audio ke Google File API: ${lastUploadErr?.message || "fetch failed"}`
      );
    }

    console.log(
      `[Transcriber] Audio terunggah (${Math.round(stat.size / 1024)} KB): ${uploadResult.file.name}, memeriksa status file...`
    );

    // Polling status file sampai siap (ACTIVE)
    let file = await fileManager.getFile(uploadResult.file.name);
    let pollCount = 0;
    while (file.state === FileState.PROCESSING && pollCount < 30) {
      console.log(`[Transcriber] Menunggu status audio ACTIVE di Google (${pollCount + 1}/30)...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      file = await fileManager.getFile(uploadResult.file.name);
      pollCount++;
    }

    if (file.state !== FileState.ACTIVE) {
      throw new HttpError(
        500,
        "GOOGLE_FILE_NOT_ACTIVE",
        `Status file audio di Google File API bukan ACTIVE (status saat ini: ${file.state}).`
      );
    }

    console.log(`[Transcriber] Status file Google: ACTIVE. Mentranskripsi dengan model multimodal Gemini...`);

    const prompt = `
You are a speech-to-text engine.
Transcribe the spoken Indonesian or English audio into phrase or sentence segments with precise timestamps.

Output ONLY a pure JSON object in this exact schema:
{
  "duration": 45.0,
  "segments": [
    {
      "start": 0.0,
      "end": 3.2,
      "text": "Kalimat pertama yang diucapkan"
    },
    {
      "start": 3.4,
      "end": 6.8,
      "text": "Kalimat kedua berikutnya"
    }
  ]
}

Instructions:
1. Provide accurate start and end timestamps in seconds (float numbers) for each spoken phrase/sentence.
2. Ensure timestamps are strictly sequential and accurately reflect the spoken audio.
3. Transcribe speech naturally in the spoken language.
4. If no speech is detected, return an empty array for segments.
5. Return ONLY valid JSON, no markdown.
`;

    const candidateModels = [
      "gemini-3.8-flash",      // Rekomendasi Resmi Google Gemini API
      "gemini-3.5-flash",      // Stabil & Akurat
      "gemini-3.6-flash",      // Alternatif Flash
      "gemini-3.5-flash-lite", // Ringan & Cepat
      "gemini-flash-latest",   // Dynamic Latest Pointer
    ];
    let response: any = null;
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        console.log(`[Transcriber] Mentranskripsi dengan model ${modelName}...`);
        const currentModel = aiTranscribe.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
            maxOutputTokens: 16384,
          },
        });

        // Retry loop for 503 / transient spikes
        for (let retry = 0; retry < 3; retry++) {
          try {
            response = await currentModel.generateContent([
              {
                fileData: {
                  mimeType: file.mimeType,
                  fileUri: file.uri,
                },
              },
              { text: prompt },
            ]);
            if (response) break;
          } catch (callErr: any) {
            const errStr = String(callErr?.message || "");
            const isQuotaExceeded =
              errStr.includes("Quota exceeded") ||
              errStr.includes("RESOURCE_EXHAUSTED") ||
              errStr.includes("quota");
            if (isQuotaExceeded) {
              console.warn(
                `[Transcriber] Model ${modelName} kuota harian habis, langsung beralih ke model berikutnya...`
              );
              throw callErr;
            }

            const isTransient = errStr.includes("503") || errStr.includes("429");
            if (isTransient && retry < 2) {
              console.warn(
                `[Transcriber] Server model ${modelName} sedang padat (503/429), mencoba ulang dalam 1.5 detik...`
              );
              await new Promise((r) => setTimeout(r, 1500));
            } else {
              throw callErr;
            }
          }
        }

        if (response) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(
          `[Transcriber] Model ${modelName} gagal (${err?.message?.slice(0, 120)}), mencoba model berikutnya...`
        );
      }
    }

    if (!response) {
      console.warn(
        `[Transcriber] Semua model Gemini kendala (${lastError?.message?.slice(0, 80)}). Mengaktifkan failover akustik Groq Whisper-large-v3...`
      );
      try {
        const groqResult = await transcribeWithGroqFailover(audioFilePath);
        return {
          text: groqResult.text,
          duration: groqResult.duration,
          words: groqResult.words.map((w) => ({
            word: w.word,
            start: w.start + offsetSec,
            end: w.end + offsetSec,
          })),
          segments: (groqResult.segments || []).map((s) => ({
            id: s.id,
            start: s.start + offsetSec,
            end: s.end + offsetSec,
            text: s.text,
          })),
        };
      } catch (groqErr: any) {
        throw new HttpError(
          500,
          "TRANSCRIPTION_MODEL_FAILED",
          `Gagal mentranskripsi dengan Gemini dan Groq: ${lastError?.message || groqErr?.message}`
        );
      }
    }

    let rawText = "";
    try {
      rawText = response.response.text();
    } catch (txtErr: any) {
      console.warn(`[Transcriber] Gagal mengambil teks dari respon Gemini:`, txtErr?.message);
    }

    let parsed = safeParseGeminiTranscriptJson(rawText);

    // If Gemini returned 0 segments for this audio chunk, try Groq Whisper failover
    if (!parsed || !Array.isArray(parsed.segments) || parsed.segments.length === 0) {
      console.log(`[Transcriber] Gemini mengembalikan 0 segmen, mengaktifkan failover Groq Whisper...`);
      try {
        const groqResult = await transcribeWithGroqFailover(audioFilePath);
        if (groqResult.words && groqResult.words.length > 0) {
          return {
            text: groqResult.text,
            duration: groqResult.duration,
            words: groqResult.words.map((w) => ({
              word: w.word,
              start: w.start + offsetSec,
              end: w.end + offsetSec,
            })),
            segments: (groqResult.segments || []).map((s) => ({
              id: s.id,
              start: s.start + offsetSec,
              end: s.end + offsetSec,
              text: s.text,
            })),
          };
        }
      } catch (groqErr) {
        console.warn(`[Transcriber] Groq failover kendala:`, (groqErr as any)?.message);
      }
    }

    const rawSegments: any[] = Array.isArray(parsed.segments) ? parsed.segments : [];

    const segments: TranscriptionSegment[] = rawSegments.map((s: any, idx: number) => ({
      id: Number(s.id) || idx,
      start: Math.max(0, (Number(s.start) || 0) + offsetSec),
      end: Math.max(0, (Number(s.end) || 0) + offsetSec),
      text: String(s.text || "").trim(),
    }));

    // Generate word-level timestamps from segments using buildWordTimings
    const words: WordTimestamp[] = [];
    if (Array.isArray(parsed.words) && parsed.words.length > 0) {
      for (const w of parsed.words) {
        words.push({
          word: String(w.word || "").trim(),
          start: Math.max(0, (Number(w.start) || 0) + offsetSec),
          end: Math.max(0, (Number(w.end) || (Number(w.start) || 0) + 0.25) + offsetSec),
        });
      }
    } else {
      for (const seg of segments) {
        const tokens = buildWordTimings(seg.text, seg.start, seg.end);
        for (const t of tokens) {
          words.push({
            word: t.word,
            start: t.startTime,
            end: t.endTime,
          });
        }
      }
    }

    const chunkDuration = Number(parsed.duration) || (words.length > 0 ? words[words.length - 1]!.end - offsetSec : 30);
    const text = segments.map((s) => s.text).join(" ");

    return {
      text,
      duration: chunkDuration,
      words,
      segments,
    };
  } finally {
    if (uploadResult?.file?.name) {
      try {
        await fileManager.deleteFile(uploadResult.file.name);
        console.log(`[Transcriber] File sementara (${uploadResult.file.name}) dibersihkan dari Google File API.`);
      } catch (delErr: any) {
        console.warn("[Transcriber] Gagal menghapus file dari Google File API:", delErr?.message);
      }
    }
  }
}

/**
 * Transcribes audio using GoogleAIFileManager and GoogleGenerativeAI with word-level timestamps.
 * - Handles long audio files (> 10 minutes) automatically by chunking to prevent token truncation.
 * - Powered by Account 1 (GEMINI_API_KEY_TRANSCRIPTION).
 */
export async function transcribeAudioWithGemini(
  audioFilePath: string
): Promise<WordLevelTranscription> {
  const keys = getTranscriptionKeys().filter((k) => k.key && k.key.length > 10);
  if (keys.length === 0) {
    throw new HttpError(
      500,
      "GEMINI_API_KEY_TRANSCRIPTION_MISSING",
      "GEMINI_API_KEY_TRANSCRIPTION belum disetel di backend/.env atau .env.local."
    );
  }

  if (!audioFilePath || !fs.existsSync(audioFilePath)) {
    throw new HttpError(
      404,
      "AUDIO_FILE_NOT_FOUND",
      `File audio tidak ditemukan di "${audioFilePath}".`
    );
  }

  const stat = fs.statSync(audioFilePath);
  if (stat.size === 0) {
    throw new HttpError(
      400,
      "AUDIO_FILE_EMPTY",
      "File audio kosong (0 bytes). Pastikan video memiliki audio."
    );
  }

  // FASE 1: JANGAN PERNAH meneruskan file video mentah (.mkv/.mp4/dsb) atau file besar ke Google File API
  const ext = path.extname(audioFilePath).toLowerCase();
  const isRawVideo = [".mp4", ".mov", ".mkv", ".webm", ".avi", ".flv", ".ts", ".m4v"].includes(ext) || ext !== ".mp3";
  let workingAudioPath = audioFilePath;
  let tempLocalExtractedMp3: string | null = null;

  if (isRawVideo || stat.size > 20 * 1024 * 1024) {
    const tempAudioDir = path.resolve(process.cwd(), "temp/audio");
    if (!fs.existsSync(tempAudioDir)) {
      fs.mkdirSync(tempAudioDir, { recursive: true });
    }
    tempLocalExtractedMp3 = path.join(
      tempAudioDir,
      `opt_audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`
    );
    console.log(
      `[Transcriber] File masukan adalah video/mentah (${ext}, ${(stat.size / (1024 * 1024)).toFixed(1)} MB). Menjalankan ekstraksi audio lokal (16kHz mono 32k) dengan FFmpeg terlebih dahulu...`
    );
    await extractOptimizedAudio(audioFilePath, tempLocalExtractedMp3);
    workingAudioPath = tempLocalExtractedMp3;
  }

  try {
    const totalDuration = getAudioDurationSeconds(workingAudioPath);
    let lastError: any = null;

    for (const keyInfo of keys) {
      try {
        console.log(`[Transcriber] Mencoba transkripsi dengan kunci ${keyInfo.label}...`);
        const fileManager = getGeminiFileManager(keyInfo.key);
        const aiTranscribe = getGeminiClient(keyInfo.key);

        const CHUNK_DURATION = 600; // 10 menit per chunk
        if (totalDuration > CHUNK_DURATION) {
          console.log(
            `[Transcriber] Audio panjang terdeteksi (${Math.round(totalDuration)}s / ${(totalDuration / 60).toFixed(1)} menit). Memproses dengan windowing 10 menit...`
          );

          // Untuk efisiensi clipping, proses hingga 30 menit audio (3 chunk x 600s)
          const maxChunksToProcess = Math.min(3, Math.ceil(totalDuration / CHUNK_DURATION));
          const ffmpegExe = getFfmpegPath();
          const chunkDir = path.join(path.dirname(workingAudioPath), `chunks_${Date.now()}`);
          if (!fs.existsSync(chunkDir)) {
            fs.mkdirSync(chunkDir, { recursive: true });
          }

          const chunkFiles: { path: string; offsetSec: number }[] = [];
          try {
            for (let i = 0; i < maxChunksToProcess; i++) {
              const offsetSec = i * CHUNK_DURATION;
              if (totalDuration > 0 && offsetSec >= totalDuration) break;
              const chunkPath = path.join(chunkDir, `part_${i}.mp3`);

              await execFileAsync(
                ffmpegExe,
                [
                  "-threads",
                  "0",
                  "-nostats",
                  "-loglevel",
                  "error",
                  "-y",
                  "-ss",
                  String(offsetSec),
                  "-t",
                  String(CHUNK_DURATION),
                  "-i",
                  workingAudioPath,
                  "-vn",
                  "-ar",
                  "16000",
                  "-ac",
                  "1",
                  "-c:a",
                  "libmp3lame",
                  "-b:a",
                  "32k",
                  "-f",
                  "mp3",
                  chunkPath,
                ],
                { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }
              );

              if (fs.existsSync(chunkPath) && fs.statSync(chunkPath).size > 1000) {
                chunkFiles.push({ path: chunkPath, offsetSec });
              }
            }

            console.log(`[Transcriber] Terbagi menjadi ${chunkFiles.length} chunk 10-menit. Mentranskripsi...`);

            let combinedText = "";
            const allWords: WordTimestamp[] = [];
            const allSegments: TranscriptionSegment[] = [];
            let maxEnd = 0;

            for (let i = 0; i < chunkFiles.length; i++) {
              const item = chunkFiles[i]!;
              console.log(`[Transcriber] Mentranskripsi chunk ${i + 1}/${chunkFiles.length} (offset ${item.offsetSec}s)...`);
              const chunkRes = await transcribeSingleChunkGemini(item.path, fileManager, aiTranscribe, item.offsetSec);

              combinedText += (combinedText ? " " : "") + chunkRes.text;
              allWords.push(...chunkRes.words);
              allSegments.push(...chunkRes.segments);
              if (chunkRes.words.length > 0) {
                maxEnd = Math.max(maxEnd, chunkRes.words[chunkRes.words.length - 1]!.end);
              }
            }

            console.log(
              `[Transcriber] Selesai transkripsi chunk! Total ${allWords.length} kata, ${allSegments.length} segmen (durasi: ${maxEnd || totalDuration}s).`
            );

            return {
              text: combinedText,
              duration: maxEnd > 0 ? maxEnd : totalDuration,
              words: allWords,
              segments: allSegments,
            };
          } finally {
            try {
              for (const item of chunkFiles) {
                if (fs.existsSync(item.path)) fs.unlinkSync(item.path);
              }
              if (fs.existsSync(chunkDir)) fs.rmSync(chunkDir, { recursive: true, force: true });
            } catch {}
          }
        }

        // Untuk audio normal (<= 10 menit), transkripsi langsung dalam satu panggilan
        return await transcribeSingleChunkGemini(workingAudioPath, fileManager, aiTranscribe, 0);
      } catch (keyErr: any) {
        lastError = keyErr;
        if (isQuotaOrRateLimitError(keyErr)) {
          console.warn(
            `[Transcriber] Kunci ${keyInfo.label} mencapai batas limit/kuota: ${keyErr?.message?.slice(0, 100)}. Beralih ke kunci berikutnya...`
          );
          continue;
        }
        console.warn(`[Transcriber] Kunci ${keyInfo.label} kendala: ${keyErr?.message?.slice(0, 100)}`);
      }
    }

    // Jika semua kunci Gemini habis, fallback langsung ke Groq Whisper
    console.warn(`[Transcriber] Semua kunci Gemini habis atau kendala. Mengaktifkan failover Groq whisper-large-v3...`);
    const groqRes = await transcribeWithGroqFailover(workingAudioPath);
    return {
      text: groqRes.text,
      duration: groqRes.duration,
      words: groqRes.words.map((w) => ({
        word: w.word,
        start: w.start,
        end: w.end,
      })),
      segments: (groqRes.segments || []).map((s) => ({
        id: s.id,
        start: s.start,
        end: s.end,
        text: s.text,
      })),
    };
  } finally {
    if (tempLocalExtractedMp3 && fs.existsSync(tempLocalExtractedMp3)) {
      try {
        fs.unlinkSync(tempLocalExtractedMp3);
        console.log(`[Transcriber] File audio sementara lokal dibersihkan: ${tempLocalExtractedMp3}`);
      } catch {}
    }
  }
}
