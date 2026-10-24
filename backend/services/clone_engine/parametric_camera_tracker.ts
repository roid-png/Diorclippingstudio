import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { getFfmpegPath } from "../../utils/ffmpeg-path";
import { getTempDir } from "../downloader";
import type { UniversalParametricBlueprint } from "./universal_style_analyzer";
import type { UniversalStyleBlueprint } from "./universal_blueprint_schema";

const execFileAsync = promisify(execFile);

export interface ParametricKeyframe {
  t: number;       // timestamp dalam detik
  x: number;       // target focus_x (0.00 s/d 1.00)
  isCut?: boolean; // true = camera cut instan; false = pan halus 0.45s
}

export interface ParametricCameraResult {
  keyframes: ParametricKeyframe[];
  dominantFocusX: number;
  ffmpegCropFilter: string;
  ffmpegCompositeFilter: string; // Filter kompleks lengkap termasuk background jika ada
}

export interface TrackParametricCameraInput {
  videoPath: string;
  startTimeSec: number;
  durationSec: number;
  blueprint: UniversalParametricBlueprint | UniversalStyleBlueprint | any;
  transcriptText?: string;
}

/**
 * Ekstraksi 4 FPS low-res frames untuk motion differential
 */
async function extractSampleFrames(
  videoPath: string,
  startTimeSec: number,
  durationSec: number,
  outDir: string
): Promise<Array<{ timestampSec: number; filePath: string }>> {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const ffmpegExe = getFfmpegPath();
  const pattern = path.join(outDir, "mot_%04d.jpg");

  try {
    await execFileAsync(
      ffmpegExe,
      [
        "-y",
        "-ss", String(Math.max(0, startTimeSec)),
        "-t", String(Math.max(1, durationSec)),
        "-i", videoPath,
        "-vf", "fps=4,scale=320:180:force_original_aspect_ratio=decrease",
        "-q:v", "4",
        pattern,
      ],
      { timeout: 30000 }
    );
  } catch {}

  const frames: Array<{ timestampSec: number; filePath: string }> = [];
  const files = fs.readdirSync(outDir).filter((f) => f.startsWith("mot_") && f.endsWith(".jpg"));
  files.sort();

  for (let idx = 0; idx < files.length; idx++) {
    const filePath = path.join(outDir, files[idx]!);
    const timestampSec = startTimeSec + idx * 0.25;
    frames.push({ timestampSec, filePath });
  }

  return frames;
}

/**
 * Analisis diferensial energi gerakan piksel setiap 1.5 - 2.0 detik
 */
async function computeMotionDifferential(
  frames: Array<{ timestampSec: number; filePath: string }>,
  clipStartTimeSec: number,
  durationSec: number
): Promise<Array<{ tStart: number; tEnd: number; focusX: number; isCloseUp: boolean }>> {
  const windowSec = 1.75;
  const numWindows = Math.max(1, Math.ceil(durationSec / windowSec));
  const results: Array<{ tStart: number; tEnd: number; focusX: number; isCloseUp: boolean }> = [];

  const width = 160;
  const height = 90;

  for (let w = 0; w < numWindows; w++) {
    const winStart = w * windowSec;
    const winEnd = Math.min(durationSec, (w + 1) * windowSec);

    const targetA = clipStartTimeSec + winStart;
    const targetB = targetA + 0.25;

    let frameA = frames.find((f) => Math.abs(f.timestampSec - targetA) < 0.20);
    let frameB = frames.find((f) => Math.abs(f.timestampSec - targetB) < 0.20);

    if (!frameA && frames.length > 0) frameA = frames[Math.min(frames.length - 1, w * 7)];
    if (!frameB && frames.length > 1) frameB = frames[Math.min(frames.length - 1, w * 7 + 1)];

    if (!frameA || !frameB || !fs.existsSync(frameA.filePath) || !fs.existsSync(frameB.filePath)) {
      results.push({ tStart: winStart, tEnd: winEnd, focusX: 0.82, isCloseUp: false });
      continue;
    }

    try {
      const bufA = await sharp(frameA.filePath).resize(width, height, { fit: "fill" }).greyscale().raw().toBuffer();
      const bufB = await sharp(frameB.filePath).resize(width, height, { fit: "fill" }).greyscale().raw().toBuffer();

      let leftDiff = 0;
      let rightDiff = 0;
      let centerDiff = 0;
      let totalOuter = 0;

      for (let y = 0; y < height; y++) {
        const offset = y * width;
        for (let x = 0; x < width; x++) {
          const diff = Math.abs(bufA[offset + x]! - bufB[offset + x]!);
          if (diff > 12) {
            if (x >= 8 && x <= 76) leftDiff += diff;
            else if (x >= 84 && x <= 152) rightDiff += diff;
            if (x >= 56 && x <= 104) centerDiff += diff;
            if (x < 24 || x > 136) totalOuter += diff;
          }
        }
      }

      // Deteksi Two-Shot vs Close-Up
      const isTwoShot = (leftDiff > 250 && rightDiff > 250) || totalOuter > 500;
      const isCloseUp = !isTwoShot && centerDiff > 1800 && centerDiff > (leftDiff + rightDiff) * 1.5 && totalOuter < 400;

      let recFocus = 0.82;
      if (isCloseUp) {
        recFocus = 0.50; // Hanya untuk verified close up!
      } else if (leftDiff > rightDiff * 1.25 && leftDiff > 800) {
        recFocus = 0.20; // Host kiri
      } else {
        recFocus = 0.82; // Tamu kanan (default)
      }

      results.push({ tStart: winStart, tEnd: winEnd, focusX: recFocus, isCloseUp });
    } catch {
      results.push({ tStart: winStart, tEnd: winEnd, focusX: 0.82, isCloseUp: false });
    }
  }

  return results;
}

/**
 * Filter anti-jitter & hysteresis: kunci kamera minimal 2.5 detik (minimum_hold_duration)
 * untuk mencegah kamera bergoyang akibat gerakan kecil atau anggukan kepala.
 */
function applyAntiJitterHysteresis(
  rawList: Array<{ tStart: number; tEnd: number; focusX: number; isCloseUp: boolean }>,
  totalDurationSec: number,
  minHoldDurationSec = 2.5
): Array<{ tStart: number; tEnd: number; focusX: number; isCut: boolean }> {
  if (rawList.length === 0) {
    return [{ tStart: 0, tEnd: totalDurationSec, focusX: 0.82, isCut: false }];
  }

  const smoothed: Array<{ tStart: number; tEnd: number; focusX: number; isCut: boolean }> = [];
  let curFocus = rawList[0]!.focusX;
  let lastSwitchTime = 0;

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i]!;
    const timeSinceSwitch = item.tStart - lastSwitchTime;

    if (item.focusX !== curFocus) {
      const nextItem = rawList[i + 1];
      const isSustained = nextItem && nextItem.focusX === item.focusX;

      // Hanya izinkan berganti jika sudah melewati minimum hold duration ATAU camera cut asli
      if (item.isCloseUp || (isSustained && timeSinceSwitch >= minHoldDurationSec)) {
        curFocus = item.focusX;
        lastSwitchTime = item.tStart;
      }
    }
    smoothed.push({
      tStart: item.tStart,
      tEnd: item.tEnd,
      focusX: curFocus,
      isCut: item.isCloseUp,
    });
  }

  // Merge consecutive
  const merged: Array<{ tStart: number; tEnd: number; focusX: number; isCut: boolean }> = [];
  let cur = { ...smoothed[0]! };

  for (let i = 1; i < smoothed.length; i++) {
    const s = smoothed[i]!;
    if (Math.abs(s.focusX - cur.focusX) < 0.05) {
      cur.tEnd = s.tEnd;
    } else {
      merged.push({ ...cur });
      cur = { ...s };
    }
  }
  merged.push(cur);
  if (merged.length > 0) {
    merged[merged.length - 1]!.tEnd = totalDurationSec;
  }

  return merged;
}

/**
 * Membangun rumus smoothstep Hermite cubic untuk pergerakan pan gimbal FFmpeg
 */
export function buildParametricSmoothstepCrop(
  segments: Array<{ tStart: number; tEnd: number; focusX: number; isCut: boolean }>,
  _totalDurationSec: number
): string {
  if (segments.length === 0) {
    return `scale=-2:1920,crop=1080:1920:x='(in_w-out_w)*0.82':y=0`;
  }
  if (segments.length === 1) {
    const fx = segments[0]!.focusX.toFixed(2);
    return `scale=-2:1920,crop=1080:1920:x='(in_w-out_w)*${fx}':y=0`;
  }

  const panDuration = 0.45;
  let expr = segments[segments.length - 1]!.focusX.toFixed(2);

  for (let i = segments.length - 2; i >= 0; i--) {
    const curSeg = segments[i]!;
    const nextSeg = segments[i + 1]!;
    const tStart = curSeg.tEnd;
    const x1 = curSeg.focusX;
    const x2 = nextSeg.focusX;

    const isCut = curSeg.isCut || nextSeg.isCut || Math.abs(x2 - x1) < 0.05;
    const tStartStr = tStart.toFixed(2);
    const x1Str = x1.toFixed(2);

    if (isCut) {
      expr = `if(lt(t,${tStartStr}),${x1Str},${expr})`;
    } else {
      const tEndStr = (tStart + panDuration).toFixed(2);
      const diffStr = (x2 - x1).toFixed(2);
      const p = `((t-${tStartStr})/${panDuration})`;
      const smoothStep = `${x1Str}+(${diffStr})*${p}*${p}*(3-2*${p})`;
      expr = `if(lt(t,${tStartStr}),${x1Str},if(lt(t,${tEndStr}),${smoothStep},${expr}))`;
    }
  }

  return `scale=-2:1920,crop=1080:1920:x='(in_w-out_w)*(${expr})':y=0`;
}

// ====================================================================
// [FASE 3: PRIMARY ENTRY POINT - TRACK PARAMETRIC CAMERA]
// ====================================================================

export async function trackParametricCamera(
  input: TrackParametricCameraInput
): Promise<ParametricCameraResult> {
  const framing = input.blueprint.canvas_framing || {
    video_scale_mode:
      input.blueprint.canvas_and_framing?.framing_mode === "FULL_9_16_SPEAKER_TRACK"
        ? "FULL_BLEED_9_16"
        : "CENTER_FIT_WITH_BG",
    camera_tracking:
      input.blueprint.camera_choreography?.tracking_engine === "STATIC_LOCKED"
        ? "STATIC_CENTER"
        : "ACTIVE_SPEAKER_SMOOTH",
    edge_feather_px: input.blueprint.canvas_and_framing?.backdrop_composition?.edge_feather_mask?.top_feather_px || 0,
    background_fill: input.blueprint.canvas_and_framing?.backdrop_composition?.type === "PURE_SOLID_COLOR" ? "SOLID_COLOR" : "NONE",
    background_hex: input.blueprint.canvas_and_framing?.backdrop_composition?.solid_hex || "#000000",
    bottom_vignette_strength: input.blueprint.canvas_and_framing?.backdrop_composition?.bottom_ambient_vignette?.opacity || 0.65,
  };
  const minHold = input.blueprint.camera_choreography?.switching_rules?.minimum_hold_duration_sec ?? 2.5;
  const tempDir = getTempDir(`temp/parametric_cam_${Date.now()}`);

  try {
    const keyframes: ParametricKeyframe[] = [];
    let dominantFocusX = 0.82;
    let ffmpegCropFilter = `scale=-2:1920,crop=1080:1920:x='(in_w-out_w)*0.82':y=0`;

    if (framing.camera_tracking === "STATIC_CENTER") {
      dominantFocusX = 0.50;
      ffmpegCropFilter = `scale=-2:1920,crop=1080:1920:x='(in_w-out_w)*0.50':y=0`;
      keyframes.push({ t: 0, x: 0.50 });
    } else {
      // 1. Ekstrak frame motion
      const frames = await extractSampleFrames(
        input.videoPath,
        input.startTimeSec,
        input.durationSec,
        tempDir
      );

      // 2. Analisis diferensial
      const rawMotion = await computeMotionDifferential(
        frames,
        input.startTimeSec,
        input.durationSec
      );

      // 3. Terapkan Anti-Jitter dengan Minimum Hold Duration
      const segments = applyAntiJitterHysteresis(rawMotion, input.durationSec, minHold);
      dominantFocusX = segments[0]?.focusX ?? 0.82;

      // 4. Bangun keyframes
      keyframes.push({ t: 0, x: segments[0]!.focusX });
      for (let i = 0; i < segments.length - 1; i++) {
        const cur = segments[i]!;
        const next = segments[i + 1]!;
        if (Math.abs(next.focusX - cur.focusX) >= 0.05) {
          if (cur.isCut) {
            keyframes.push({ t: cur.tEnd, x: next.focusX, isCut: true });
          } else {
            keyframes.push({ t: cur.tEnd, x: cur.focusX, isCut: false });
            keyframes.push({
              t: Math.min(input.durationSec, Number((cur.tEnd + 0.45).toFixed(2))),
              x: next.focusX,
              isCut: false,
            });
          }
        }
      }

      // 5. Bangun crop filter
      ffmpegCropFilter = buildParametricSmoothstepCrop(segments, input.durationSec);
    }

    // Bangun komposit filter sesuai scale mode dan background
    let ffmpegCompositeFilter = "";
    if (framing.video_scale_mode === "FULL_BLEED_9_16") {
      const slowZoom =
        framing.camera_tracking === "SLOW_ZOOM_IN" || framing.camera_tracking === "ACTIVE_SPEAKER_SMOOTH"
          ? ",zoompan=z='min(1.000+0.000037*on,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30"
          : "";
      ffmpegCompositeFilter = `${ffmpegCropFilter}${slowZoom}`;
    } else {
      // CENTER_FIT_WITH_BG / SPLIT_TOP_BOTTOM
      const targetH = Math.round(1920 * (framing.video_height_ratio || 0.55));
      const targetY = Math.round(1920 * (framing.video_y_position_ratio || 0.5) - targetH / 2);

      if (framing.background_fill === "BLURRED_VIDEO") {
        ffmpegCompositeFilter = `split=2[v_orig1][v_orig2];[v_orig1]scale=180:320,boxblur=12:2,scale=1080:1920:flags=fast_bilinear[bg];[v_orig2]scale=1080:${targetH}:force_original_aspect_ratio=decrease,pad=1080:${targetH}:(1080-iw)/2:(${targetH}-ih)/2:color=${framing.background_hex}[fg];[bg][fg]overlay=x=0:y=${targetY}`;
      } else {
        // SOLID_COLOR / NONE
        ffmpegCompositeFilter = `scale=1080:${targetH}:force_original_aspect_ratio=decrease,pad=1080:1920:(1080-iw)/2:${targetY}:color=${framing.background_hex}`;
      }
    }

    console.log(
      `[ParametricCamera] Camera Tracking selesai: ${keyframes.length} keyframe, dominant focus_x: ${dominantFocusX}`
    );

    return {
      keyframes,
      dominantFocusX,
      ffmpegCropFilter,
      ffmpegCompositeFilter,
    };
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

