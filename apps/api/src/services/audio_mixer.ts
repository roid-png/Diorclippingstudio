import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Groq from "groq-sdk";
import { getFfmpegPath, getFfprobePath } from "../utils/ffmpeg-path";
import { getGroqBacksoundKey } from "./api_key_manager";
import { tokenTracker } from "./token_tracker";

const execFileAsync = promisify(execFile);

export interface AudioDuckingConfig {
  bgmTrackId?: string; // Preset track: 'lofi_chill' | 'cinematic_pulse' | 'modern_beat' | 'upbeat_vibe'
  bgmFilePath?: string; // Path to custom BGM audio file
  bgmBaseVolume?: number; // Default: 0.15 (15% base volume)
  duckingDepthDb?: number; // Default: -20 dB
  hookDelaySec?: number; // Default: 4.5 seconds (starts after hook teaser)
  attackMs?: number; // Default: 150 ms
  releaseMs?: number; // Default: 400 ms
  enableLoudnorm?: boolean; // Default: true (EBU R128 standard)
}

export interface DuckingFilterResult {
  filterParts: string[];
  outputLabel: string;
}

/**
 * Resolves or creates a lightweight default ambient BGM track if none exists.
 */
export function resolveBgmTrackPath(trackIdOrPath?: string): string | null {
  if (!trackIdOrPath && trackIdOrPath !== "default") {
    return null;
  }

  if (trackIdOrPath && fs.existsSync(trackIdOrPath)) {
    return trackIdOrPath;
  }

  const bgmDirs = [
    path.resolve(process.cwd(), "backend/assets/bgm"),
    path.resolve(process.cwd(), "apps/api/backend/assets/bgm"),
    path.resolve(process.cwd(), "assets/bgm"),
  ];

  for (const dir of bgmDirs) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }
  }

  const targetDir = bgmDirs[0];
  const safeId = (trackIdOrPath || "lofi_chill").replace(/[^a-zA-Z0-9_-]/g, "_");
  const candidatePath = path.join(targetDir, `${safeId}.wav`);

  if (fs.existsSync(candidatePath)) {
    return candidatePath;
  }

  try {
    const ffmpegExe = getFfmpegPath();
    const synthFilter = "aevalsrc='0.03*sin(2*PI*130.81*t)+0.025*sin(2*PI*164.81*t)+0.02*sin(2*PI*196.0*t)+0.018*sin(2*PI*246.94*t)+0.015*sin(2*PI*293.66*t)':s=44100:d=30,lowpass=f=2200,volume=0.25";
    execFile(ffmpegExe, ["-y", "-f", "lavfi", "-i", synthFilter, "-c:a", "pcm_s16le", candidatePath], () => {});
    return candidatePath;
  } catch {
    return null;
  }
}

/**
 * Probes the exact duration in seconds of an audio file using native ffprobe.
 */
export async function getAudioDurationSec(audioPath: string): Promise<number> {
  if (!fs.existsSync(audioPath)) return 0;
  try {
    const ffprobeExe = getFfprobePath();
    const { stdout } = await execFileAsync(ffprobeExe, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      audioPath,
    ]);
    const dur = parseFloat(stdout.trim());
    return isNaN(dur) ? 0 : dur;
  } catch {
    return 0;
  }
}

/**
 * [GROQ AI BACKSOUND MOMENT MATCHER]
 * Analyzes video clip transcript & mood to determine the optimal start_offset_sec in the BGM.
 * Powered by Groq API Key: GROQ_API_KEY_BACKSOUND
 */
export async function matchOptimalBgmOffsetWithGroq(options: {
  bgmPath: string;
  clipDurationSec: number;
  clipTitle?: string;
  clipTranscript?: string;
  clipMood?: string;
}): Promise<{ startOffsetSec: number; durationSec: number; reason: string }> {
  const totalBgmDuration = await getAudioDurationSec(options.bgmPath);
  const targetDuration = options.clipDurationSec || 45;

  if (totalBgmDuration <= targetDuration + 6) {
    return {
      startOffsetSec: 0,
      durationSec: targetDuration,
      reason: "Durasi lagu latar pas dengan durasi klip, diputar dari awal.",
    };
  }

  const maxSafeOffset = Math.max(0, Math.floor(totalBgmDuration - targetDuration));

  try {
    const apiKey = getGroqBacksoundKey();
    if (!apiKey) {
      return { startOffsetSec: 0, durationSec: targetDuration, reason: "Default offset" };
    }

    const groq = new Groq({ apiKey, timeout: 5000 });
    const prompt = `Anda adalah Sound Designer & Audio Editor video vertikal profesional.
Tugas Anda: Menentukan detik mulai (start_offset_sec) dari lagu background music (BGM) agar ritme & energi musik selaras dengan isi video.

Info Klip Video:
- Judul Klip: "${options.clipTitle || "Momen Viral"}"
- Transkrip Vokal: "${(options.clipTranscript || "").slice(0, 300)}"
- Mood / Emosi: "${options.clipMood || "Inspiratif & Dinamis"}"
- Target Durasi Klip: ${targetDuration} detik
- Total Durasi Lagu BGM: ${Math.round(totalBgmDuration)} detik
- Batas Maksimal Offset: ${maxSafeOffset} detik

Pedoman Struktur Musik Populer:
- Detik 0 s/d 25: Intro pembuka melodi santai
- Detik 25 s/d 65: Build up & beat drop pertama (energi tinggi, cocok untuk klip motivasi/klimaks)
- Detik 65 s/d 130: Chorus / melodi puncak

Tentukan start_offset_sec (angka bulat antara 0 dan ${maxSafeOffset}) dan alasan singkat.
Kembalikan JSON murni:
{
  "start_offset_sec": 30,
  "reason": "Alasan pencocokan"
}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const usedTokens = completion.usage?.total_tokens || 180;
    tokenTracker.recordUsage(apiKey, "GROQ_BACKSOUND", usedTokens, "groq");

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    let startOffset = Number(parsed.start_offset_sec);
    if (isNaN(startOffset) || startOffset < 0 || startOffset > maxSafeOffset) {
      startOffset = Math.min(28, maxSafeOffset);
    }

    return {
      startOffsetSec: Math.round(startOffset),
      durationSec: targetDuration,
      reason: parsed.reason || "Pilihan Groq AI Backsound Matcher",
    };
  } catch (err: any) {
    console.warn(`[AudioMixer] Groq AI Matcher fallback: ${err?.message}`);
    return {
      startOffsetSec: 0,
      durationSec: targetDuration,
      reason: "Fallback aman: awal lagu latar (0s).",
    };
  }
}

/**
 * Slices a custom BGM file to exact clip duration (30s, 45s, 60s) with soft fade-in & fade-out.
 */
export async function sliceBgmForClip(options: {
  inputBgmPath: string;
  outputBgmPath: string;
  startOffsetSec: number;
  durationSec: number;
}): Promise<string> {
  const ffmpegExe = getFfmpegPath();
  const dir = path.dirname(options.outputBgmPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const fadeOutStart = Math.max(1, options.durationSec - 1.2);

  const args = [
    "-y",
    "-ss", String(options.startOffsetSec),
    "-t", String(options.durationSec),
    "-i", options.inputBgmPath,
    "-af", `aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=1.2`,
    "-c:a", "pcm_s16le",
    options.outputBgmPath,
  ];

  await execFileAsync(ffmpegExe, args, { timeout: 30000 });
  return options.outputBgmPath;
}

/**
 * Builds FFmpeg filter complex instructions for sidechain compression auto-ducking.
 */
export function buildAudioDuckingFilterComplex(
  vocalLabel: string,
  bgmInputIndex: number,
  config: AudioDuckingConfig = {},
  outputLabel = "a_final"
): DuckingFilterResult {
  const bgmBaseVol = typeof config.bgmBaseVolume === "number" ? config.bgmBaseVolume : 0.15;
  const hookDelay = typeof config.hookDelaySec === "number" ? config.hookDelaySec : 4.5;
  const hookDelayMs = Math.round(hookDelay * 1000);
  const attack = typeof config.attackMs === "number" ? config.attackMs : 150;
  const release = typeof config.releaseMs === "number" ? config.releaseMs : 400;
  const enableLoudnorm = config.enableLoudnorm !== false;

  const threshold = 0.035;
  const ratio = 10;

  const filterParts: string[] = [
    `[${bgmInputIndex}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=${bgmBaseVol},adelay=${hookDelayMs}|${hookDelayMs},afade=t=in:ss=${hookDelay}:d=0.5,aloop=loop=-1:size=2e+09[bgm_delayed]`,
    `${vocalLabel}asplit=2[vocal_main][vocal_trigger]`,
    `[bgm_delayed][vocal_trigger]sidechaincompress=threshold=${threshold}:ratio=${ratio}:attack=${attack}:release=${release}[bgm_ducked]`,
    `[vocal_main][bgm_ducked]amix=inputs=2:duration=first:dropout_transition=2[a_mixed]`,
  ];

  if (enableLoudnorm) {
    filterParts.push(`[a_mixed]loudnorm=I=-16:TP=-1.5:LRA=11[${outputLabel}]`);
  } else {
    filterParts.push(`[a_mixed]anull[${outputLabel}]`);
  }

  return {
    filterParts,
    outputLabel,
  };
}

/**
 * Mixes dialogue audio with BGM standalone into a destination file.
 */
export async function mixAudioWithDuckingStandalone(
  vocalAudioPath: string,
  bgmAudioPath: string,
  outputPath: string,
  config: AudioDuckingConfig = {}
): Promise<string> {
  const ffmpegExe = getFfmpegPath();
  const ducking = buildAudioDuckingFilterComplex("[0:a]", 1, config, "a_out");

  const args = [
    "-y",
    "-i", vocalAudioPath,
    "-i", bgmAudioPath,
    "-filter_complex", ducking.filterParts.join(";"),
    "-map", `[${ducking.outputLabel}]`,
    "-c:a", "aac",
    "-b:a", "192k",
    outputPath,
  ];

  await execFileAsync(ffmpegExe, args, { timeout: 60000 });
  return outputPath;
}
