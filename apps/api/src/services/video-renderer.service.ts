import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { getFfmpegPath } from "../utils/ffmpeg-path";
import { getOutputsDir, getTempDir } from "./downloader";
import type { VideoPreset } from "./presets.service";
import { HttpError } from "../lib/http-error";

const execFileAsync = promisify(execFile);

export interface RenderClipParams {
  clipId: string;
  sourceVideoPath?: string;
  assSubtitlePath?: string;
  durationSec: number;
  preset: VideoPreset;
  enableMotionGraphic?: boolean;
}

export interface RenderResult {
  clipId: string;
  outputFilePath: string;
  fileName: string;
  fileSizeMb: number;
  durationSec: number;
  resolution: string;
  publicUrl: string;
}

/**
 * Escapes file path for FFmpeg video filters on Windows.
 */
function escapeFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}

/**
 * Renders a full 9:16 vertical MP4 clip (1080x1920) with FFmpeg:
 * - 9:16 vertical center auto-crop
 * - Preset color grading
 * - Dynamic animated progress bar
 * - Hardcoded .ass subtitles
 * - Ultrafast h264 encoding with CRF 23
 */
export async function renderVerticalClip(params: RenderClipParams): Promise<RenderResult> {
  const ffmpegPath = getFfmpegPath();
  const outputsDir = getOutputsDir();
  const outputFileName = `dior_${params.clipId}.mp4`;
  const outputFilePath = path.join(outputsDir, outputFileName);

  const duration = Math.max(5, Math.round(params.durationSec));
  const hasMotion = params.enableMotionGraphic ?? params.preset.motionGraphic.progressBar;

  // Build filter chain
  const filterParts: string[] = [];

  const hasSource = params.sourceVideoPath && fs.existsSync(params.sourceVideoPath);

  if (hasSource) {
    // 1. Scale & Crop to 1080x1920 center
    filterParts.push("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920");

    // 2. Color grading
    if (params.preset.colorGrading) {
      filterParts.push(params.preset.colorGrading);
    }

    // 3. Animated Progress Bar at bottom
    if (hasMotion) {
      filterParts.push(`drawbox=x=0:y=ih-18:w='iw*(t/${duration})':h=18:color=0x00E5FFFF:t=fill`);
    }

    // 4. Burn-in .ass subtitles if file exists
    if (params.assSubtitlePath && fs.existsSync(params.assSubtitlePath)) {
      const escapedAss = escapeFilterPath(params.assSubtitlePath);
      filterParts.push(`ass='${escapedAss}'`);
    }

    const filterComplex = `[0:v]${filterParts.join(",")}[v_out]`;

    try {
      await execFileAsync(ffmpegPath, [
        "-y",
        "-i",
        params.sourceVideoPath!,
        "-filter_complex",
        filterComplex,
        "-map",
        "[v_out]",
        "-map",
        "0:a?",
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
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-t",
        String(duration),
        outputFilePath,
      ], { timeout: 180000 });
    } catch (err: any) {
      console.error("[Renderer] FFmpeg rendering from source failed:", err?.message);
      throw new HttpError(
        500,
        "RENDER_FAILED",
        `FFmpeg gagal merender klip video vertikal: ${err?.message}`
      );
    }
  } else {
    throw new HttpError(
      400,
      "SOURCE_VIDEO_NOT_FOUND",
      "File video sumber segmen tidak ditemukan. Gagal melanjutkan proses rendering."
    );
  }

  if (!fs.existsSync(outputFilePath)) {
    throw new HttpError(
      500,
      "RENDER_OUTPUT_NOT_FOUND",
      "File hasil render video vertikal tidak ditemukan di direktori output."
    );
  }

  const stat = fs.statSync(outputFilePath);
  const fileSizeMb = Math.round((stat.size / (1024 * 1024)) * 10) / 10;

  return {
    clipId: params.clipId,
    outputFilePath,
    fileName: outputFileName,
    fileSizeMb: Math.max(0.5, fileSizeMb),
    durationSec: duration,
    resolution: "1080x1920 (9:16)",
    publicUrl: `/api/download/${outputFileName}`,
  };
}

