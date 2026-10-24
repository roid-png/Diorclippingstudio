import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getFfmpegPath } from "../utils/ffmpeg-path";
import { getTempDir } from "./downloader";
import {
  executeGeminiWithFailover,
  STANDARD_GEMINI_CANDIDATE_MODELS,
} from "./api_key_manager";

const execFileAsync = promisify(execFile);

export interface SpeakerTrackSegment {
  startTimeSec: number;
  endTimeSec: number;
  focusX: number; // 0.00 (far left) to 1.00 (far right)
  speakerLabel?: string;
  reason?: string;
}

export interface CameraKeyframe {
  t: number;      // timestamp in seconds
  x: number;      // target horizontal focus (0.0 to 1.0)
  isCut?: boolean; // if true, instant cut; if false/omitted, smooth gimbal pan (0.45s)
}

export interface SpeakerTrackResult {
  segments: SpeakerTrackSegment[];
  keyframes: CameraKeyframe[];
  cropFilter: string; // Ready-to-use FFmpeg crop filter string
  dominantFocusX: number;
}

export interface TrackActiveSpeakerInput {
  videoPath: string;
  startTimeSec: number;
  durationSec: number;
  transcriptText?: string;
  speakerName?: string;
}

export interface MotionWindowMetric {
  windowStartSec: number;
  windowEndSec: number;
  leftMotion: number;
  rightMotion: number;
  centerMotion: number;
  isCloseUp: boolean;
  recommendedFocusX: number;
  speakerLabel: string;
}

/**
 * Resolves available Gemini API key for speaker tracking vision analysis.
 */
function getSpeakerTrackerApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY_CURATOR ||
    process.env.GEMINI_API_KEY_ART_DIRECTOR ||
    process.env.GEMINI_API_KEY_STYLE_CLONER ||
    process.env.GEMINI_API_KEY ||
    null
  );
}

/**
 * [FASE 1: EKSTRAKSI FRAME CEPAT UNTUK MOTION-ENERGY DIFFERENTIAL]
 * Extracts low-res frames (320x180) at 4 FPS (1 frame every 0.25s) across clip duration.
 */
async function extractMotionSampleFrames(
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
  } catch (err: any) {
    console.warn(`[SpeakerTracker] Ekstraksi frame motion FFmpeg notice: ${err?.message}`);
  }

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
 * [FASE 1: DUAL-ZONE MOTION DIFFERENTIAL MENGGUNAKAN SHARP RAW PIXEL DIFF]
 * Computes pixel changes between 2 consecutive frames spaced ~0.25s apart
 * across 2.0s time windows:
 * - Left Zone (X: 5% - 48%) -> host
 * - Right Zone (X: 52% - 95%) -> guest (focus_x = 0.82)
 * - Center Zone (X: 35% - 65%) -> single-shot close-up check (focus_x = 0.50)
 */
async function computeMotionDifferentialWindows(
  frames: Array<{ timestampSec: number; filePath: string }>,
  clipStartTimeSec: number,
  durationSec: number
): Promise<MotionWindowMetric[]> {
  const windowDuration = 2.0;
  const numWindows = Math.max(1, Math.ceil(durationSec / windowDuration));
  const metrics: MotionWindowMetric[] = [];

  const width = 160;
  const height = 90;

  for (let w = 0; w < numWindows; w++) {
    const winStart = w * windowDuration;
    const winEnd = Math.min(durationSec, (w + 1) * windowDuration);

    // Find frame A at winStart and frame B at winStart + 0.25s
    const targetAbsStart = clipStartTimeSec + winStart;
    const targetAbsB = targetAbsStart + 0.25;

    let frameA = frames.find((f) => Math.abs(f.timestampSec - targetAbsStart) < 0.20);
    let frameB = frames.find((f) => Math.abs(f.timestampSec - targetAbsB) < 0.20);

    if (!frameA && frames.length > 0) frameA = frames[Math.min(frames.length - 1, w * 8)];
    if (!frameB && frames.length > 1) frameB = frames[Math.min(frames.length - 1, w * 8 + 1)];

    if (!frameA || !frameB || !fs.existsSync(frameA.filePath) || !fs.existsSync(frameB.filePath)) {
      metrics.push({
        windowStartSec: winStart,
        windowEndSec: winEnd,
        leftMotion: 0,
        rightMotion: 0,
        centerMotion: 0,
        isCloseUp: false,
        recommendedFocusX: 0.82,
        speakerLabel: "GUEST_RIGHT",
      });
      continue;
    }

    try {
      const bufA = await sharp(frameA.filePath)
        .resize(width, height, { fit: "fill" })
        .greyscale()
        .raw()
        .toBuffer();

      const bufB = await sharp(frameB.filePath)
        .resize(width, height, { fit: "fill" })
        .greyscale()
        .raw()
        .toBuffer();

      let leftDiff = 0;
      let rightDiff = 0;
      let centerDiff = 0;
      let totalOuterActivity = 0;

      // Zones:
      // Left: X in [8, 76] (5% to 48%)
      // Right: X in [84, 152] (52% to 95%)
      // Center: X in [56, 104] (35% to 65%)
      for (let y = 0; y < height; y++) {
        const offset = y * width;
        for (let x = 0; x < width; x++) {
          const diff = Math.abs(bufA[offset + x]! - bufB[offset + x]!);
          if (diff > 12) {
            // Significant motion pixel
            if (x >= 8 && x <= 76) {
              leftDiff += diff;
            } else if (x >= 84 && x <= 152) {
              rightDiff += diff;
            }
            if (x >= 56 && x <= 104) {
              centerDiff += diff;
            }
            if (x < 24 || x > 136) {
              totalOuterActivity += diff;
            }
          }
        }
      }

      // Detect Two-Shot vs Single-Person Close-Up:
      // In talkshow wide-shots (2 people seated on sofa/chairs):
      // leftDiff and rightDiff both reflect speaker/listener presence, or totalOuterActivity > 500.
      const isTwoShot = (leftDiff > 250 && rightDiff > 250) || totalOuterActivity > 500;

      // Strict Rule: 0.50 is DILARANG KERAS on Two-Shots!
      // Only trigger isCloseUp if NOT a Two-Shot AND centerDiff heavily dominates with dead outer borders.
      const isCloseUp = !isTwoShot && centerDiff > 1800 && centerDiff > (leftDiff + rightDiff) * 1.5 && totalOuterActivity < 400;

      let recFocus = 0.82;
      let label = "GUEST_RIGHT";

      if (isCloseUp) {
        recFocus = 0.50;
        label = "CLOSE_UP_CENTER";
      } else if (leftDiff > rightDiff * 1.25 && leftDiff > 800) {
        // Clear active speaker on Left (Host)
        recFocus = 0.20;
        label = "HOST_LEFT";
      } else {
        // Right speaker is active or motion dominant (default talkshow guest focus)
        recFocus = 0.82;
        label = "GUEST_RIGHT";
      }

      metrics.push({
        windowStartSec: winStart,
        windowEndSec: winEnd,
        leftMotion: leftDiff,
        rightMotion: rightDiff,
        centerMotion: centerDiff,
        isCloseUp,
        recommendedFocusX: recFocus,
        speakerLabel: label,
      });
    } catch {
      metrics.push({
        windowStartSec: winStart,
        windowEndSec: winEnd,
        leftMotion: 0,
        rightMotion: 0,
        centerMotion: 0,
        isCloseUp: false,
        recommendedFocusX: 0.82,
        speakerLabel: "GUEST_RIGHT",
      });
    }
  }

  return metrics;
}

/**
 * [FASE 1: HYSTERESIS & ANTI-JITTER FILTER]
 * Prevents rapid erratic camera switches when the other speaker merely nods (< 1.5s).
 * Enforces sustained motion before switching active speaker camera focus.
 */
function applyHysteresisFilter(
  metrics: MotionWindowMetric[],
  totalDurationSec: number
): SpeakerTrackSegment[] {
  if (metrics.length === 0) {
    return [
      {
        startTimeSec: 0,
        endTimeSec: totalDurationSec,
        focusX: 0.82,
        speakerLabel: "GUEST_RIGHT",
        reason: "Default talkshow guest focus",
      },
    ];
  }

  // Smooth raw recommendations with hysteresis
  const smoothed: Array<{ tStart: number; tEnd: number; fx: number; label: string }> = [];
  let currentFocus = metrics[0]!.recommendedFocusX;
  let currentLabel = metrics[0]!.speakerLabel;
  let consecutiveCount = 1;

  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i]!;
    const nextFx = m.recommendedFocusX;

    if (nextFx === currentFocus) {
      consecutiveCount++;
    } else {
      // Only switch if the new focus persists for at least 2 consecutive windows (>= 3.0s)
      // or if current focus was a transient close-up
      const nextWindow = metrics[i + 1];
      const isSustained = nextWindow && nextWindow.recommendedFocusX === nextFx;

      if (isSustained || m.isCloseUp) {
        currentFocus = nextFx;
        currentLabel = m.speakerLabel;
        consecutiveCount = 1;
      }
    }

    smoothed.push({
      tStart: m.windowStartSec,
      tEnd: m.windowEndSec,
      fx: currentFocus,
      label: currentLabel,
    });
  }

  // Merge consecutive segments having the same focus_x
  const segments: SpeakerTrackSegment[] = [];
  let curSeg: SpeakerTrackSegment = {
    startTimeSec: smoothed[0]!.tStart,
    endTimeSec: smoothed[0]!.tEnd,
    focusX: smoothed[0]!.fx,
    speakerLabel: smoothed[0]!.label,
  };

  for (let i = 1; i < smoothed.length; i++) {
    const s = smoothed[i]!;
    if (Math.abs(s.fx - curSeg.focusX) < 0.05) {
      curSeg.endTimeSec = s.tEnd;
    } else {
      segments.push({ ...curSeg });
      curSeg = {
        startTimeSec: s.tStart,
        endTimeSec: s.tEnd,
        focusX: s.fx,
        speakerLabel: s.label,
      };
    }
  }
  segments.push(curSeg);

  // Ensure last segment reaches total duration
  if (segments.length > 0) {
    segments[segments.length - 1]!.endTimeSec = totalDurationSec;
  }

  return segments;
}

/**
 * [FASE 1: GEMINI VISION MOTION VERIFICATION]
 * Verifies and refines speaker boundaries using Gemini 2.5 Flash
 * guided by the physical motion differential metrics.
 */
async function detectWithGeminiVision(
  frames: Array<{ timestampSec: number; filePath: string }>,
  motionMetrics: MotionWindowMetric[],
  transcriptText?: string
): Promise<SpeakerTrackSegment[] | null> {
  const apiKey = getSpeakerTrackerApiKey();
  if (!apiKey || frames.length === 0) return null;

  try {
    // Select up to 6 representative frames across the clip
    const step = Math.max(1, Math.floor(frames.length / 6));
    const sampled = frames.filter((_, i) => i % step === 0).slice(0, 6);

    const motionSummary = motionMetrics
      .map(
        (m) =>
          `[${m.windowStartSec.toFixed(1)}s-${m.windowEndSec.toFixed(1)}s: Gerak Kiri=${m.leftMotion}, Gerak Kanan=${m.rightMotion}, CloseUp=${m.isCloseUp} -> Usulan: ${m.speakerLabel} (fx: ${m.recommendedFocusX})]`
      )
      .join("\n");

    const prompt = `Anda adalah Director of Photography dan Active Speaker Tracking Engine untuk video vertical 9:16 (gaya @renxclip).
Tugas Anda: Memverifikasi posisi horizontal kamera (focus_x) agar 100% menyorot orang yang SEDANG BERBICARA, BUKAN orang yang sedang diam melipat tangan atau hanya mendengarkan!

DATA FISIK GERAKAN PIKSEL (DUAL-ZONE MOTION DIFFERENTIAL):
${motionSummary}

TRANSKRIP UCAPAN:
"${(transcriptText || "").slice(0, 1000)}"

ATURAN STRUKTURAL KETAT:
1. Video talkshow 2 orang di sofa (Wide Two-Shot):
   - Pembicara di sisi KANAN layar (narasumber, jas cokelat / kemeja) = WAJIB focus_x: 0.82 (jangan 0.78 agar wajah tidak mepet ke tepi layar!).
   - Pembicara di sisi KIRI layar (host, baju hitam) = WAJIB focus_x: 0.20.
   - DILARANG KERAS memberikan 0.50 pada shot 2 orang di sofa (Two-Shot)! Nilai 0.50 hanya akan menyorot bantal/meja kosong di tengah! Set is_close_up: false.
2. Shot kamera close-up 1 orang tepat di tengah layar (Single-Person Close-Up) = WAJIB focus_x: 0.50, is_close_up: true.
3. Hysteresis: Pertahankan sorotan kamera pada pembicara utama sampai kalimatnya selesai. Jangan potong kamera untuk anggukan singkat (< 1.5 detik).

Output format: JSON array murni:
[
  {
    "start_sec": 0.0,
    "end_sec": 12.0,
    "focus_x": 0.82,
    "is_close_up": false,
    "speaker_label": "GUEST_RIGHT",
    "reason": "Pria berjas cokelat di kanan sedang aktif berbicara"
  }
]`;

    const parts: any[] = [{ text: prompt }];

    for (const f of sampled) {
      if (fs.existsSync(f.filePath)) {
        const buf = fs.readFileSync(f.filePath);
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: buf.toString("base64"),
          },
        });
      }
    }

    const candidateModels = [
      "gemini-3.8-flash",      // Rekomendasi Resmi Google Gemini API
      "gemini-3.5-flash",      // Model Vision Sangat Andal
      "gemini-3.6-flash",      // Alternatif Flash
      "gemini-3.5-flash-lite", // Ringan & Cepat
      "gemini-flash-latest",   // Dynamic Latest Pointer
    ];

    const candidateText = await executeGeminiWithFailover({
      service: "CURATOR",
      candidateModels,
      timeoutMs: 30000,
      action: async (ai, modelName) => {
        const model = ai.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });
        const res = await model.generateContent(parts);
        return res.response.text();
      },
    });

    const parsed = JSON.parse(candidateText);

    if (Array.isArray(parsed) && parsed.length > 0) {
      const segments: SpeakerTrackSegment[] = parsed.map((item: any) => {
        let fx = typeof item.focus_x === "number" ? item.focus_x : 0.82;
        const isSinglePersonCloseUp = item.is_close_up === true || item.speaker_label === "CLOSE_UP_CENTER";

        // Strict prohibition: 0.50 is NEVER allowed unless verified single-person close-up!
        if (!isSinglePersonCloseUp && fx > 0.35 && fx < 0.65) {
          fx = 0.82; // Force to guest right instead of empty center couch
        } else if (fx >= 0.65) {
          fx = 0.82;
        } else if (fx <= 0.35) {
          fx = 0.20;
        } else if (isSinglePersonCloseUp) {
          fx = 0.50;
        } else {
          fx = 0.82;
        }

        return {
          startTimeSec: typeof item.start_sec === "number" ? Math.max(0, item.start_sec) : 0,
          endTimeSec: typeof item.end_sec === "number" ? item.end_sec : 999,
          focusX: fx,
          speakerLabel: item.speaker_label || (fx >= 0.7 ? "GUEST_RIGHT" : fx <= 0.3 ? "HOST_LEFT" : "CLOSE_UP_CENTER"),
          reason: item.reason || "",
        };
      });

      segments.sort((a, b) => a.startTimeSec - b.startTimeSec);
      console.log(`[SpeakerTracker] Gemini Vision motion-guided detection: ${segments.length} segmen.`);
      return segments;
    }
  } catch (err: any) {
    console.warn(`[SpeakerTracker] Gemini Vision warning: ${err?.message}, menggunakan physical motion differential.`);
  }

  return null;
}

/**
 * [FASE 1: GENERATE KEYFRAME ARRAY (camera_keyframes)]
 * Generates structured camera keyframe array for smooth gimbal panning or instant cuts.
 * Adheres strictly to the rule: 0.50 is NEVER used on Two-Shot frames.
 */
export function generateCameraKeyframes(
  segments: SpeakerTrackSegment[],
  totalDurationSec: number
): CameraKeyframe[] {
  if (segments.length === 0) {
    return [{ t: 0, x: 0.82 }];
  }

  const keyframes: CameraKeyframe[] = [];
  keyframes.push({ t: 0, x: segments[0]!.focusX });

  for (let i = 0; i < segments.length - 1; i++) {
    const curSeg = segments[i]!;
    const nextSeg = segments[i + 1]!;
    const tCut = curSeg.endTimeSec;
    const x1 = curSeg.focusX;
    const x2 = nextSeg.focusX;

    if (Math.abs(x2 - x1) >= 0.05) {
      const isCameraCut =
        curSeg.speakerLabel === "CLOSE_UP_CENTER" ||
        nextSeg.speakerLabel === "CLOSE_UP_CENTER";

      if (isCameraCut) {
        keyframes.push({ t: tCut, x: x2, isCut: true });
      } else {
        // Smooth pan begins at tCut (holding x1) and arrives at x2 after 0.45s
        keyframes.push({ t: tCut, x: x1, isCut: false });
        keyframes.push({
          t: Math.min(totalDurationSec, Number((tCut + 0.45).toFixed(2))),
          x: x2,
          isCut: false,
        });
      }
    }
  }

  return keyframes;
}

/**
 * [FASE 1: RUMUS SMOOTH KEYFRAME INTERPOLATION DI FFMPEG (SMOOTHSTEP / LERP)]
 * Interpolates smoothly over 0.45s using Hermite smoothstep cubic curve:
 * p = (t - tStart) / 0.45
 * smoothstep = p * p * (3 - 2 * p)
 * x = x1 + (x2 - x1) * smoothstep
 *
 * For camera cuts (drastic scene switches / close-up), uses instant cut.
 */
export function buildSmoothKeyframeExpression(
  segments: SpeakerTrackSegment[],
  totalDurationSec: number
): string {
  if (segments.length === 0) {
    return "0.82";
  }

  if (segments.length === 1) {
    return segments[0]!.focusX.toFixed(2);
  }

  const panDuration = 0.45;
  let expr = segments[segments.length - 1]!.focusX.toFixed(2);

  for (let i = segments.length - 2; i >= 0; i--) {
    const curSeg = segments[i]!;
    const nextSeg = segments[i + 1]!;
    const tStart = curSeg.endTimeSec;
    const x1 = curSeg.focusX;
    const x2 = nextSeg.focusX;

    const isCameraCut =
      curSeg.speakerLabel === "CLOSE_UP_CENTER" ||
      nextSeg.speakerLabel === "CLOSE_UP_CENTER" ||
      Math.abs(x2 - x1) < 0.05;

    const tStartStr = tStart.toFixed(2);
    const x1Str = x1.toFixed(2);

    if (isCameraCut) {
      expr = `if(lt(t,${tStartStr}),${x1Str},${expr})`;
    } else {
      const tEndStr = (tStart + panDuration).toFixed(2);
      const diffStr = (x2 - x1).toFixed(2);
      const p = `((t-${tStartStr})/${panDuration})`;
      const smoothStep = `${x1Str}+(${diffStr})*${p}*${p}*(3-2*${p})`;

      expr = `if(lt(t,${tStartStr}),${x1Str},if(lt(t,${tEndStr}),${smoothStep},${expr}))`;
    }
  }

  return expr;
}

/**
 * [FASE 1: DYNAMIC FFMPEG CROP FILTER BUILDER WITH SMOOTH GIMBAL PANNING]
 * Builds FFmpeg expression: scale=-2:1920,crop=1080:1920:x='(in_w-out_w)*(smoothstep_expr)':y=0
 */
export function buildFfmpegCropFilter(
  segments: SpeakerTrackSegment[],
  totalDurationSec: number
): string {
  const expr = buildSmoothKeyframeExpression(segments, totalDurationSec);
  return `scale=-2:1920,crop=1080:1920:x='(in_w-out_w)*(${expr})':y=0`;
}

/**
 * [FASE 1: PRIMARY ENTRY POINT - TRUE ACTIVE SPEAKER TRACKING]
 * Runs Dual-Zone Motion Differential (sharp Raw Pixel Diff) + Anti-Jitter Hysteresis + Gemini Verification.
 */
export async function trackActiveSpeaker(
  input: TrackActiveSpeakerInput
): Promise<SpeakerTrackResult> {
  const tempDir = getTempDir(`temp/speaker_track_${Date.now()}_${Math.floor(Math.random() * 1000)}`);

  try {
    // 1. Extract 4 FPS low-res frames for motion differential analysis
    const frames = await extractMotionSampleFrames(
      input.videoPath,
      input.startTimeSec,
      input.durationSec,
      tempDir
    );

    // 2. Compute physical dual-zone motion energy across 2-second windows
    const motionMetrics = await computeMotionDifferentialWindows(
      frames,
      input.startTimeSec,
      input.durationSec
    );

    let segments: SpeakerTrackSegment[] | null = null;

    // 3. Try Gemini Vision with motion guidance
    if (frames.length > 0) {
      segments = await detectWithGeminiVision(frames, motionMetrics, input.transcriptText);
    }

    // 4. Fallback to physical Dual-Zone Motion Differential with Hysteresis
    if (!segments || segments.length === 0) {
      console.log(`[SpeakerTracker] Menggunakan Dual-Zone Motion Differential murni dengan Anti-Jitter Hysteresis...`);
      segments = applyHysteresisFilter(motionMetrics, input.durationSec);
    }

    // Ensure segments cover full duration
    if (!segments || segments.length === 0) {
      segments = [
        {
          startTimeSec: 0,
          endTimeSec: input.durationSec,
          focusX: 0.82,
          speakerLabel: "GUEST_RIGHT",
          reason: "Default active guest focus (pria jas cokelat)",
        },
      ];
    }

    const dominantFocusX = segments[0]?.focusX ?? 0.82;
    const keyframes = generateCameraKeyframes(segments, input.durationSec);
    const cropFilter = buildFfmpegCropFilter(segments, input.durationSec);

    console.log(
      `[SpeakerTracker] Active Speaker Tracking 100% selesai: ${segments.length} segmen pembicara, ${keyframes.length} keyframe gimbal panning, dominant focus_x: ${dominantFocusX}.`
    );

    return {
      segments,
      keyframes,
      cropFilter,
      dominantFocusX,
    };
  } finally {
    // Cleanup temporary extracted frames
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  }
}
