import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getFfmpegPath } from "../utils/ffmpeg-path";

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
