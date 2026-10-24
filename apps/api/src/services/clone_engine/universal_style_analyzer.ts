import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { z } from "zod";
import { Vibrant } from "node-vibrant/node";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getFfmpegPath } from "../../utils/ffmpeg-path";
import { getTempDir } from "../downloader";
import { savePreset, type VideoPreset } from "../presets.service";
import {
  UniversalStyleBlueprintSchema,
  type UniversalStyleBlueprint,
  getDefaultUniversalBlueprint,
} from "./universal_blueprint_schema";
import {
  executeGeminiWithFailover,
  STANDARD_GEMINI_CANDIDATE_MODELS,
} from "../api_key_manager";

const execFileAsync = promisify(execFile);

// ====================================================================
// [FASE 2: UNIVERSAL PARAMETRIC BLUEPRINT SCHEMA - ZOD VALIDATED]
// ====================================================================

export const CanvasFramingSchema = z.object({
  video_scale_mode: z
    .enum(["FULL_BLEED_9_16", "CENTER_FIT_WITH_BG", "SPLIT_TOP_BOTTOM"])
    .default("FULL_BLEED_9_16"),
  video_height_ratio: z.number().default(1.0),
  video_y_position_ratio: z.number().default(0.5),
  background_fill: z.enum(["NONE", "SOLID_COLOR", "BLURRED_VIDEO"]).default("NONE"),
  background_hex: z.string().default("#000000"),
  edge_feather_px: z.number().default(0),
  bottom_vignette_strength: z.number().default(0.65),
  camera_tracking: z
    .enum(["ACTIVE_SPEAKER_SMOOTH", "STATIC_CENTER", "SLOW_ZOOM_IN"])
    .default("ACTIVE_SPEAKER_SMOOTH"),
});

export const TypographyStyleSchema = z.object({
  casing: z.enum(["lowercase", "UPPERCASE", "Capitalize"]).default("UPPERCASE"),
  font_weight: z.enum(["Bold", "ExtraBold", "Black"]).default("ExtraBold"),
  size_px: z.number().default(48),
  color_hex: z.string().default("#FFFFFF"),
  visual_effect: z
    .enum([
      "SHADOW",
      "GLOW",
      "BLUR",
      "BOX",
      "MOTION_BLUR_GLOW",
      "NEON_GLOW",
      "SOLID_BOX",
      "HARD_SHADOW",
    ])
    .default("SHADOW"),
  effect_color_hex: z.string().default("#000000"),
  effect_radius_px: z.number().default(10),
});

export const OpeningHookSchema = z.object({
  has_special_opening_text: z.boolean().default(true),
  active_start_sec: z.number().default(0.0),
  active_end_sec: z.number().default(6.0),
  text_placement_x_ratio: z.number().default(0.5),
  text_placement_y_ratio: z.number().default(0.45),
  text_align: z.enum(["left", "center", "right"]).default("center"),
  sync_type: z.enum(["LIVE_SPOKEN_WORDS", "SUMMARY_HEADLINE"]).default("LIVE_SPOKEN_WORDS"),
  line_1_style: TypographyStyleSchema,
  line_2_style: TypographyStyleSchema,
  backdrop_dim_opacity: z.number().default(0.35),
});

export const UpperGraphicsSchema = z.object({
  has_persistent_top_card: z.boolean().default(false),
  card_style: z.enum(["NONE", "GLASS_FLOATING", "MINIMAL_BADGE"]).default("NONE"),
});

export const SubtitleSystemSchema = z.object({
  mute_during_opening_hook: z.boolean().default(true),
  words_per_screen: z.number().default(1),
  position_x_ratio: z.number().default(0.5),
  position_y_ratio: z.number().default(0.74),
  font_family: z
    .enum([
      "Montserrat ExtraBold",
      "Poppins Black",
      "Plus Jakarta Sans",
      "Anton",
      "Bebas Neue",
    ])
    .default("Montserrat ExtraBold"),
  font_size_px: z.number().default(60),
  casing: z.enum(["UPPERCASE", "lowercase", "Capitalize"]).default("UPPERCASE"),
  base_text_hex: z.string().default("#FFFFFF"),
  highlight_active_word: z.boolean().default(false),
  highlight_hex: z.string().default("#FFFFFF"),
  highlight_mode: z.enum(["NONE", "TEXT_COLOR", "BACKGROUND_PILL"]).default("NONE"),
  stroke_width_px: z.number().default(3.5),
  stroke_hex: z.string().default("#000000"),
  shadow_blur_px: z.number().default(6),
  entry_animation: z.enum(["POP_SCALE", "FADE", "CUT"]).default("POP_SCALE"),
});

export const ColorGradeSchema = z.object({
  brightness: z.number().default(0.0),
  contrast: z.number().default(1.03),
  saturation: z.number().default(1.04),
});

export const UniversalParametricBlueprintSchema = z.object({
  blueprint_id: z.string(),
  detected_style_summary: z.string().default("Universal Cloned Style"),
  canvas_framing: CanvasFramingSchema,
  opening_hook: OpeningHookSchema,
  upper_graphics: UpperGraphicsSchema,
  subtitle_system: SubtitleSystemSchema,
  color_grade: ColorGradeSchema,
  isUniversalClone: z.boolean().default(true),
  createdAt: z.string().optional(),
});

export type UniversalParametricBlueprint = z.infer<typeof UniversalParametricBlueprintSchema>;

// ====================================================================
// [FASE 4: TEMP CLONE BLUEPRINT SESSION MANAGEMENT (NO AUTO-SAVE)]
// ====================================================================

export function getTempCloneFilePath(): string {
  const dir = getTempDir("temp");
  return path.join(dir, "active_clone_session.json");
}

export function saveActiveTempCloneBlueprint(blueprint: any): void {
  const primaryPath = getTempCloneFilePath();
  const secondaryPath = path.join(getTempDir("temp"), "active_temp_clone.json");
  const payload = JSON.stringify(blueprint, null, 2);

  try {
    fs.writeFileSync(primaryPath, payload, "utf-8");
    fs.writeFileSync(secondaryPath, payload, "utf-8");
    const backendTemp = path.resolve(process.cwd(), "backend/temp");
    if (!fs.existsSync(backendTemp)) fs.mkdirSync(backendTemp, { recursive: true });
    fs.writeFileSync(path.join(backendTemp, "active_clone_session.json"), payload, "utf-8");
    fs.writeFileSync(path.join(backendTemp, "active_temp_clone.json"), payload, "utf-8");
  } catch {}
  console.log(`[UniversalClone] Blueprint sesi sementara disimpan di ${primaryPath}`);
}

export function getActiveTempCloneBlueprint(): any | null {
  const candidatePaths = [
    getTempCloneFilePath(),
    path.join(getTempDir("temp"), "active_temp_clone.json"),
    path.resolve(process.cwd(), "backend/temp/active_clone_session.json"),
    path.resolve(process.cwd(), "backend/temp/active_temp_clone.json"),
    "d:/DIOR_CLIPPING/backend/temp/active_clone_session.json",
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw);
        return parsed;
      } catch {}
    }
  }
  return null;
}

export function clearActiveTempCloneBlueprint(): void {
  const candidatePaths = [
    getTempCloneFilePath(),
    path.join(getTempDir("temp"), "active_temp_clone.json"),
    path.resolve(process.cwd(), "backend/temp/active_clone_session.json"),
    path.resolve(process.cwd(), "backend/temp/active_temp_clone.json"),
    "d:/DIOR_CLIPPING/backend/temp/active_clone_session.json",
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {}
    }
  }
  console.log(`[UniversalClone] Blueprint sesi sementara dibersihkan.`);
}

export const saveActiveCloneSession = saveActiveTempCloneBlueprint;
export const getActiveCloneSession = getActiveTempCloneBlueprint;
export const clearActiveCloneSession = clearActiveTempCloneBlueprint;

// ====================================================================
// [FASE 2: MULTI-FRAME EXTRACTION & WATERMARK-SAFE PIXEL ANALYSIS]
// ====================================================================

function getStyleClonerApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY_STYLE_CLONER ||
    process.env.GEMINI_API_KEY_ART_DIRECTOR ||
    process.env.GEMINI_API_KEY ||
    null
  );
}

/**
 * Extracts 4 opening frames (0.5s to 4.5s) and 4 body frames (middle to end).
 */
async function extractReferenceFrames(
  videoPath: string,
  tempDir: string
): Promise<Array<{ timestampSec: number; filePath: string; isOpening: boolean }>> {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const ffmpegExe = getFfmpegPath();

  // Probe video duration
  let duration = 12.0;
  try {
    const { stdout } = await execFileAsync(ffmpegExe, [
      "-i", videoPath,
      "-hide_banner",
    ]).catch((err) => ({ stdout: err?.stderr || "" }));

    const durMatch = stdout.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    if (durMatch) {
      duration =
        parseInt(durMatch[1]!, 10) * 3600 +
        parseInt(durMatch[2]!, 10) * 60 +
        parseFloat(durMatch[3]!);
    }
  } catch {}

  const timestamps: Array<{ sec: number; isOpening: boolean }> = [
    { sec: 0.8, isOpening: true },
    { sec: 2.0, isOpening: true },
    { sec: 4.0, isOpening: true },
    { sec: Math.max(4.5, duration * 0.35), isOpening: false },
    { sec: Math.max(5.5, duration * 0.60), isOpening: false },
    { sec: Math.max(6.5, duration * 0.85), isOpening: false },
  ];

  const extracted: Array<{ timestampSec: number; filePath: string; isOpening: boolean }> = [];

  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i]!;
    const outPath = path.join(tempDir, `ref_frame_${i}_${t.sec.toFixed(1)}s.jpg`);
    try {
      await execFileAsync(
        ffmpegExe,
        [
          "-y",
          "-ss", String(t.sec),
          "-i", videoPath,
          "-vframes", "1",
          "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(1080-iw)/2:(1920-ih)/2",
          "-q:v", "3",
          outPath,
        ],
        { timeout: 15000 }
      );
      if (fs.existsSync(outPath)) {
        extracted.push({ timestampSec: t.sec, filePath: outPath, isOpening: t.isOpening });
      }
    } catch {}
  }

  return extracted;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) * 60;
        break;
      case gNorm:
        h = ((bNorm - rNorm) / d + 2) * 60;
        break;
      case bNorm:
        h = ((rNorm - gNorm) / d + 4) * 60;
        break;
    }
  }
  return { h, s, l };
}

/**
 * [FASE 2: WATERMARK-SAFE PALETTE EXTRACTION (SHARP + NODE-VIBRANT + HSL FILTER)]
 * Crops 15% off top and bottom to eliminate TikTok/Instagram watermark logos,
 * and extracts natural dominant and accent colors using node-vibrant and HSL analysis.
 */
async function extractWatermarkSafePalette(
  framePath: string
): Promise<{ dominantHex: string; accentHex: string }> {
  try {
    const meta = await sharp(framePath).metadata();
    const w = meta.width || 1080;
    const h = meta.height || 1920;

    // Crop middle 70% (discard 15% top and 15% bottom)
    const topMargin = Math.round(h * 0.15);
    const croppedH = Math.round(h * 0.70);

    const croppedPng = await sharp(framePath)
      .extract({ left: 0, top: topMargin, width: w, height: croppedH })
      .resize(160, 240, { fit: "fill" })
      .png()
      .toBuffer();

    let nodeVibrantAccent: string | undefined = undefined;
    try {
      const palette = await Vibrant.from(croppedPng).getPalette();
      if (palette?.Vibrant?.hex) {
        nodeVibrantAccent = palette.Vibrant.hex;
      } else if (palette?.LightVibrant?.hex) {
        nodeVibrantAccent = palette.LightVibrant.hex;
      }
    } catch {}

    const croppedBuf = await sharp(croppedPng).raw().toBuffer();

    // Sample color frequencies
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let maxSaturation = 0;
    let vibrantR = 255;
    let vibrantG = 122;
    let vibrantB = 0;

    const count = croppedBuf.length / 3;
    for (let i = 0; i < croppedBuf.length; i += 3) {
      const r = croppedBuf[i]!;
      const g = croppedBuf[i + 1]!;
      const b = croppedBuf[i + 2]!;

      rSum += r;
      gSum += g;
      bSum += b;

      // Filter out pure black, pure white, and watermarks
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      if (brightness > 40 && brightness < 230) {
        const hsl = rgbToHsl(r, g, b);
        const sat = hsl.s;

        // Ignore watermark blues (Hue 195 - 235 with high saturation)
        const isWatermarkBlue = hsl.h >= 195 && hsl.h <= 235 && sat > 0.45;

        if (!isWatermarkBlue && sat > maxSaturation) {
          maxSaturation = sat;
          vibrantR = r;
          vibrantG = g;
          vibrantB = b;
        }
      }
    }

    const avgR = Math.round(rSum / Math.max(1, count));
    const avgG = Math.round(gSum / Math.max(1, count));
    const avgB = Math.round(bSum / Math.max(1, count));

    const dominantHex = `#${avgR.toString(16).padStart(2, "0")}${avgG.toString(16).padStart(2, "0")}${avgB.toString(16).padStart(2, "0")}`;
    const accentHex = nodeVibrantAccent || `#${vibrantR.toString(16).padStart(2, "0")}${vibrantG.toString(16).padStart(2, "0")}${vibrantB.toString(16).padStart(2, "0")}`;

    return { dominantHex, accentHex };
  } catch {
    return { dominantHex: "#0D0D0D", accentHex: "#FF7A00" };
  }
}

// ====================================================================
// [FASE 2: PRIMARY ENTRY POINT - ANALYZE TO PARAMETRIC BLUEPRINT]
// ====================================================================

export interface AnalyzeReferenceInput {
  videoBuffer?: Buffer;
  videoPath?: string;
  presetName?: string;
}

export async function analyzeReferenceVideoToBlueprint(
  input: AnalyzeReferenceInput
): Promise<UniversalParametricBlueprint> {
  const tempDir = getTempDir(`temp/universal_clone_${Date.now()}`);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  let videoFilePath = input.videoPath;
  if (!videoFilePath && input.videoBuffer) {
    videoFilePath = path.join(tempDir, "reference_video.mp4");
    fs.writeFileSync(videoFilePath, input.videoBuffer);
  }

  if (!videoFilePath || !fs.existsSync(videoFilePath)) {
    throw new Error("Video referensi tidak ditemukan untuk analisis Universal Clone.");
  }

  try {
    // 1. Ekstraksi 8 frame (4 opening + 4 body)
    const frames = await extractReferenceFrames(videoFilePath, tempDir);
    if (frames.length === 0) {
      throw new Error("Gagal mengekstrak frame dari video referensi.");
    }

    // 2. Analisis warna bebas watermark
    const sampleFrame = frames.find((f) => !f.isOpening)?.filePath || frames[0]!.filePath;
    const { dominantHex, accentHex } = await extractWatermarkSafePalette(sampleFrame);

    // 3. Bangun Prompt Parametrik Objektif

    const prompt = `Anda adalah Universal Video Style Cloner & Director of Photography profesional.
Tugas Anda: Menganalisis frame-frame dari video referensi yang diunggah dan mengekstrak SELURUH parameter visualnya secara OBJEKTIF & PARAMETRIK (BUKAN memilih nama template kaku!).

FRAME YANG DISEDIAKAN:
- Frame 1 s/d 4: 5 detik pertama video referensi (mengamati apakah ada teks pembuka/kinetic hook, posisi teks, efek font, warna teks).
- Frame 5 s/d 8: Bagian tengah hingga akhir (mengamati tata letak video, rasio crop, subtitle: berapa kata per layar, posisi Y, ukuran font, outline, dan warna).

WARNA PIKSEL ALAMI TERVERIFIKASI (Telah dipotong 12% atas & bawah agar bebas watermark):
- Warna dominan latar: ${dominantHex}
- Warna aksen terkuat: ${accentHex}

ATURAN PARAMETRIK:
1. canvas_framing:
   - video_scale_mode: "FULL_BLEED_9_16" jika video memenuhi seluruh layar vertikal tanpa kotak hitam di atas/bawah. "CENTER_FIT_WITH_BG" jika video 16:9 di tengah dengan latar blur/hitam di atas dan bawah.
   - camera_tracking: "ACTIVE_SPEAKER_SMOOTH" jika kamera menyorot bergantian orang yang bicara dengan gerakan kamera halus.
2. opening_hook (detik 0 - 6):
   - has_special_opening_text: true jika pada 5 detik pertama terdapat teks pembuka besar yang menonjol di atas video.
   - line_1_style & line_2_style: tentukan size_px, font_weight, color_hex, dan visual_effect ("MOTION_BLUR_GLOW" | "NEON_GLOW" | "SOLID_BOX" | "HARD_SHADOW" | "SHADOW" | "GLOW").
3. subtitle_system:
   - words_per_screen: JUMLAH KATA per kemunculan (misal 1 jika hanya 1 kata pop-up seperti @renxclip, atau 3 s/d 4 jika kalimat pendek berfrasa).
   - position_y_ratio: koordinat vertikal subtitle (contoh: 0.74 = di sepertiga bawah, 0.81 = di dekat batas bawah).
   - casing: "UPPERCASE" | "lowercase" | "Capitalize".
   - font_size_px: ukuran font subtitle (contoh: 60 - 74 untuk 1-kata besar, 40 - 50 untuk kalimat).
   - highlight_mode: "TEXT_COLOR" | "BACKGROUND_PILL" | "NONE".

KEMBALIKAN HANYA JSON SESUAI STRUKTUR SKEMA BERIKUT:
{
  "blueprint_id": "clone_${Date.now()}",
  "detected_style_summary": "Deskripsi singkat gaya video referensi",
  "canvas_framing": {
    "video_scale_mode": "FULL_BLEED_9_16",
    "video_height_ratio": 1.0,
    "video_y_position_ratio": 0.5,
    "background_fill": "NONE",
    "background_hex": "#000000",
    "edge_feather_px": 0,
    "bottom_vignette_strength": 0.65,
    "camera_tracking": "ACTIVE_SPEAKER_SMOOTH"
  },
  "opening_hook": {
    "has_special_opening_text": true,
    "active_start_sec": 0.0,
    "active_end_sec": 6.0,
    "text_placement_x_ratio": 0.5,
    "text_placement_y_ratio": 0.45,
    "text_align": "center",
    "sync_type": "LIVE_SPOKEN_WORDS",
    "line_1_style": {
      "casing": "UPPERCASE",
      "font_weight": "Bold",
      "size_px": 48,
      "color_hex": "#FFFFFF",
      "visual_effect": "SHADOW",
      "effect_color_hex": "#000000",
      "effect_radius_px": 8
    },
    "line_2_style": {
      "casing": "UPPERCASE",
      "font_weight": "Black",
      "size_px": 84,
      "color_hex": "${accentHex}",
      "visual_effect": "MOTION_BLUR_GLOW",
      "effect_color_hex": "${accentHex}",
      "effect_radius_px": 16
    },
    "backdrop_dim_opacity": 0.35
  },
  "upper_graphics": {
    "has_persistent_top_card": false,
    "card_style": "NONE"
  },
  "subtitle_system": {
    "mute_during_opening_hook": true,
    "words_per_screen": 1,
    "position_x_ratio": 0.5,
    "position_y_ratio": 0.74,
    "font_family": "Montserrat ExtraBold",
    "font_size_px": 64,
    "casing": "UPPERCASE",
    "base_text_hex": "#FFFFFF",
    "highlight_active_word": false,
    "highlight_hex": "#FFFFFF",
    "highlight_mode": "NONE",
    "stroke_width_px": 3.5,
    "stroke_hex": "#000000",
    "shadow_blur_px": 6,
    "entry_animation": "POP_SCALE"
  },
  "color_grade": {
    "brightness": 0.0,
    "contrast": 1.04,
    "saturation": 1.05
  }
}`;

    const parts: any[] = [{ text: prompt }];
    for (const f of frames) {
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

    let validated: UniversalParametricBlueprint | null = null;
    const candidateModels = [
      "gemini-3.8-flash",      // Rekomendasi Resmi Google Gemini API
      "gemini-3.5-flash",      // Model Vision Sangat Stabil & Cepat
      "gemini-3.6-flash",      // Alternatif Flash
      "gemini-3.5-flash-lite", // Ringan & Cepat
      "gemini-flash-latest",   // Dynamic Latest Pointer
    ];

    try {
      console.log("[UniversalClone] Memulai analisis visual Gemini Vision dengan failover cascade...");
      const candidateText = await executeGeminiWithFailover({
        service: "STYLE_CLONER",
        candidateModels,
        timeoutMs: 35000,
        action: async (ai, modelName) => {
          const model = ai.getGenerativeModel({
            model: modelName,
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          });
          const response = await model.generateContent(parts);
          return response.response.text();
        },
      });

      const rawParsed = JSON.parse(candidateText);
      validated = UniversalParametricBlueprintSchema.parse({
        ...rawParsed,
        blueprint_id: `temp_clone_${Date.now()}`,
        isUniversalClone: true,
        createdAt: new Date().toISOString(),
      });

      console.log(
        `[UniversalClone] Berhasil menganalisis video referensi via Gemini Vision: ${validated.detected_style_summary}`
      );
    } catch (aiErr: any) {
      console.warn(
        `[UniversalClone] Peringatan AI Vision (${aiErr?.message || aiErr}). Menggunakan blueprint parametrik dinamis bebas watermark.`
      );
      validated = createDynamicFallbackBlueprint(accentHex, dominantHex);
    }

    // [FASE 4: SIMPAN KE ACTIVE_TEMP_CLONE.JSON (BUKAN DI PRESET PERMANEN!)]
    saveActiveTempCloneBlueprint(validated);

    return validated;
  } finally {
    // Cleanup temporary frame images
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

function createDynamicFallbackBlueprint(
  accentHex: string,
  dominantHex: string
): UniversalParametricBlueprint {
  return {
    blueprint_id: `temp_clone_${Date.now()}`,
    detected_style_summary: "Dynamic Parametric Cloned Style",
    isUniversalClone: true,
    createdAt: new Date().toISOString(),
    canvas_framing: {
      video_scale_mode: "FULL_BLEED_9_16",
      video_height_ratio: 1.0,
      video_y_position_ratio: 0.5,
      background_fill: "NONE",
      background_hex: dominantHex,
      edge_feather_px: 0,
      bottom_vignette_strength: 0.65,
      camera_tracking: "ACTIVE_SPEAKER_SMOOTH",
    },
    opening_hook: {
      has_special_opening_text: true,
      active_start_sec: 0.0,
      active_end_sec: 6.0,
      text_placement_x_ratio: 0.5,
      text_placement_y_ratio: 0.45,
      text_align: "center",
      sync_type: "LIVE_SPOKEN_WORDS",
      line_1_style: {
        casing: "UPPERCASE",
        font_weight: "Bold",
        size_px: 48,
        color_hex: "#FFFFFF",
        visual_effect: "SHADOW",
        effect_color_hex: "#000000",
        effect_radius_px: 8,
      },
      line_2_style: {
        casing: "UPPERCASE",
        font_weight: "Black",
        size_px: 84,
        color_hex: accentHex,
        visual_effect: "MOTION_BLUR_GLOW",
        effect_color_hex: accentHex,
        effect_radius_px: 16,
      },
      backdrop_dim_opacity: 0.35,
    },
    upper_graphics: {
      has_persistent_top_card: false,
      card_style: "NONE",
    },
    subtitle_system: {
      mute_during_opening_hook: true,
      words_per_screen: 1,
      position_x_ratio: 0.5,
      position_y_ratio: 0.74,
      font_family: "Montserrat ExtraBold",
      font_size_px: 64,
      casing: "UPPERCASE",
      base_text_hex: "#FFFFFF",
      highlight_active_word: false,
      highlight_hex: "#FFFFFF",
      highlight_mode: "NONE",
      stroke_width_px: 3.5,
      stroke_hex: "#000000",
      shadow_blur_px: 6,
      entry_animation: "POP_SCALE",
    },
    color_grade: {
      brightness: 0.0,
      contrast: 1.04,
      saturation: 1.05,
    },
  };
}

/**
 * [FASE 4 & 5: MANUAL SAVE FROM BLUEPRINT TO PERMANENT PRESET]
 * Dipanggil HANYA saat pengguna menekan tombol "Simpan Gaya Clone ke Preset".
 * Menyimpan UniversalStyleBlueprint / UniversalParametricBlueprint ke /backend/presets/{id}.json.
 */
export async function saveBlueprintAsPreset(
  blueprint: any,
  customName?: string
): Promise<VideoPreset> {
  const safeId = `cloned-${Date.now()}`;
  const summary =
    blueprint.detected_style_summary ||
    blueprint.source_metadata?.detected_summary ||
    "Gaya Kloning Kustom";
  const presetName = customName?.trim() || summary;

  // Adapt nested or flat blueprint
  const hook = blueprint.opening_hook || {
    has_special_opening_text: blueprint.opening_hook_engine?.enabled ?? true,
    line_2_style: {
      color_hex: blueprint.opening_hook_engine?.line_2_punchword?.color_hex || "#FF7A00",
    },
  };

  const framing = blueprint.canvas_framing || {
    video_scale_mode:
      blueprint.canvas_and_framing?.framing_mode === "FULL_9_16_SPEAKER_TRACK"
        ? "FULL_BLEED_9_16"
        : "CENTER_FIT_WITH_BG",
  };

  const sub = blueprint.subtitle_system || {
    words_per_screen: blueprint.body_subtitle_engine?.max_words_per_event ?? 1,
    font_family: blueprint.body_subtitle_engine?.typography?.font_family || "Montserrat ExtraBold",
    font_size_px: blueprint.body_subtitle_engine?.typography?.font_size_px || 64,
    base_text_hex: blueprint.body_subtitle_engine?.color_and_highlights?.base_text_hex || "#FFFFFF",
    highlight_hex: blueprint.body_subtitle_engine?.color_and_highlights?.highlight_text_hex || "#FF7A00",
    stroke_hex: blueprint.body_subtitle_engine?.stroke_and_shadow?.outline_color_hex || "#000000",
    stroke_width_px: blueprint.body_subtitle_engine?.stroke_and_shadow?.outline_thickness_px || 3.8,
    position_y_ratio: blueprint.body_subtitle_engine?.spatial_placement?.pos_y_ratio || 0.74,
  };

  const colorGrade = blueprint.color_grade || {
    contrast: blueprint.color_science_and_atmosphere?.color_grading?.contrast_multiplier ?? 1.04,
    brightness: blueprint.color_science_and_atmosphere?.color_grading?.brightness_lift ?? 0.0,
    saturation: blueprint.color_science_and_atmosphere?.color_grading?.saturation_multiplier ?? 1.05,
  };

  const accentColor = hook.line_2_style?.color_hex || "#FF7A00";

  const presetData: Partial<VideoPreset> = {
    id: safeId,
    name: presetName,
    description: `Preset permanen hasil kloning gaya: ${summary}`,
    format: "9:16",
    width: 1080,
    height: 1920,
    colorGrading: `eq=contrast=${Number(colorGrade.contrast).toFixed(2)}:brightness=${Number(colorGrade.brightness).toFixed(2)}:saturation=${Number(colorGrade.saturation).toFixed(2)}`,
    accentColor,
    primaryAccentHex: accentColor,
    layoutArchitecture:
      framing.video_scale_mode === "FULL_BLEED_9_16"
        ? "IN_SCENE_KINETIC_CLIPPER"
        : "TOP_INFOGRAPHIC_PODCAST",
    cameraFraming:
      framing.video_scale_mode === "FULL_BLEED_9_16"
        ? "FULL_9_16_SPEAKER_TRACK"
        : "CENTER_16_9_BLUR_BG",
    subtitleBehavior:
      sub.words_per_screen === 1
        ? "SINGLE_WORD_POP"
        : "PHRASE_HIGHLIGHT_BOX",
    hookVisualType: hook.has_special_opening_text
      ? "IN_SCENE_KINETIC_HOOK"
      : "NONE",
    enableTopMotion: Boolean(blueprint.upper_graphics?.has_persistent_top_card || blueprint.upper_context_graphics?.enabled),
    badge: "AI Cloned",
    isCloned: true,
    isCustom: true,
    isUniversalClone: true,
    blueprint,
    subtitleStyle: {
      fontName: sub.font_family,
      fontSize: sub.font_size_px,
      primaryColor: sub.base_text_hex,
      highlightColor: sub.highlight_hex,
      outlineColor: sub.stroke_hex,
      outlineWidth: Math.round(sub.stroke_width_px),
      alignment: 2,
      marginV: Math.round(1920 * (1 - (sub.position_y_ratio || 0.74))),
      bold: true,
    },
  };

  const saved = await savePreset(presetData);
  console.log(`[UniversalClone] Blueprint berhasil disimpan permanen sebagai Preset "${saved.name}" (${saved.id})`);
  return saved;
}
