import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import * as culori from "culori";
import { Vibrant } from "node-vibrant/node";
import { jsonrepair } from "jsonrepair";
import { getFfmpegPath, getVideoDurationSeconds } from "../utils/ffmpeg-path";
import { getTempDir } from "./downloader";
import { savePreset, type VideoPreset } from "./presets.service";
import { executeGeminiWithFailover } from "./api_key_manager";
import { HttpError } from "../lib/http-error";

const execFileAsync = promisify(execFile);

/**
 * Normalizes detected font name to one of the 5 pre-installed system fonts.
 */
export function normalizeClonedFont(fontName?: string): string {
  if (!fontName) return "Montserrat ExtraBold";
  const lower = fontName.toLowerCase();
  if (lower.includes("jakarta")) return "Plus Jakarta Sans";
  if (lower.includes("poppins")) return "Poppins Black";
  if (lower.includes("anton")) return "Anton";
  if (lower.includes("bebas")) return "Bebas Neue";
  return "Montserrat ExtraBold";
}

/**
 * Normalizes hex or ASS color string to standard 6-character hex (#RRGGBB).
 */
export function normalizeClonedColor(color?: string, fallback = "#00FFFF"): string {
  if (!color) return fallback;
  const trimmed = color.trim();
  if (trimmed.startsWith("#") && (trimmed.length === 7 || trimmed.length === 4)) {
    return trimmed;
  }
  if (trimmed.startsWith("&H")) {
    const clean = trimmed.replace(/&H|&/g, "").padStart(8, "0");
    const b = clean.slice(2, 4);
    const g = clean.slice(4, 6);
    const r = clean.slice(6, 8);
    return `#${r}${g}${b}`;
  }
  return fallback;
}

/**
 * Checks if a hex color is in the blue/cyan watermark spectrum (TikTok/Reels/WhatsApp badge).
 * Pure arithmetic RGB->HSL to avoid any external library type mismatch.
 */
export function isWatermarkBlue(hex?: string): boolean {
  if (!hex) return false;
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return false;

  let h = 0;
  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta / (1 - Math.abs(2 * l - 1));

  // Blue/Cyan hue is between 175° and 255° with saturation > 0.18
  return h >= 175 && h <= 255 && s > 0.18;
}

/**
 * [FASE 3: EKSTRAK 8 FRAME REPRESENTATIF DARI VIDEO REFERENSI (0.0s - 10.0s)]
 * Samples 8 keyframes across duration (0.0s to 10.0s) and crops out the bottom 14%
 * (where TikTok / Reels watermarks reside) so Gemini Vision and Vibrant analyze pure video styling.
 */
export async function extractSampleFrames(videoFilePath: string): Promise<string[]> {
  const ffmpegPath = getFfmpegPath();
  const framesDir = getTempDir("temp/clone_frames");
  const baseName = `frame_${Date.now()}`;

  let totalDur = 6.0;
  try {
    const d = await getVideoDurationSeconds(videoFilePath);
    if (d > 1.0) totalDur = d;
  } catch {}

  const maxScanDur = Math.min(totalDur, 10.0);
  const frameTimestamps = totalDur >= 10.0
    ? ["0.5", "1.8", "3.2", "4.5", "6.0", "7.2", "8.5", "9.8"]
    : [
        (maxScanDur * 0.05).toFixed(2),
        (maxScanDur * 0.18).toFixed(2),
        (maxScanDur * 0.32).toFixed(2),
        (maxScanDur * 0.45).toFixed(2),
        (maxScanDur * 0.58).toFixed(2),
        (maxScanDur * 0.72).toFixed(2),
        (maxScanDur * 0.85).toFixed(2),
        (maxScanDur * 0.96).toFixed(2),
      ];

  const framePaths: string[] = [];

  for (let i = 0; i < frameTimestamps.length; i++) {
    const ts = frameTimestamps[i]!;
    const rawFrameOut = path.join(framesDir, `${baseName}_raw_${i}.jpg`);
    const cleanFrameOut = path.join(framesDir, `${baseName}_${i}.jpg`);
    try {
      await execFileAsync(
        ffmpegPath,
        [
          "-y",
          "-ss",
          ts,
          "-i",
          videoFilePath,
          "-vframes",
          "1",
          "-q:v",
          "2",
          rawFrameOut,
        ],
        { timeout: 15000 }
      );

      if (fs.existsSync(rawFrameOut)) {
        // [FASE 3: WATERMARK EXCLUSION ZONE]
        // Crop out bottom 14% of the frame to permanently eliminate TikTok/Reels badge interference
        try {
          const meta = await sharp(rawFrameOut).metadata();
          if (meta.width && meta.height) {
            const safeHeight = Math.max(100, Math.round(meta.height * 0.86));
            await sharp(rawFrameOut)
              .extract({ left: 0, top: 0, width: meta.width, height: safeHeight })
              .jpeg({ quality: 90 })
              .toFile(cleanFrameOut);

            try { fs.unlinkSync(rawFrameOut); } catch {}
            framePaths.push(cleanFrameOut);
            continue;
          }
        } catch {}

        framePaths.push(rawFrameOut);
      }
    } catch (err: any) {
      console.warn(`[Style Cloner] Gagal ekstrak frame pada detik ${ts}:`, err?.message);
    }
  }

  if (framePaths.length === 0) {
    const fallbackOut = path.join(framesDir, `${baseName}_fallback.jpg`);
    try {
      await execFileAsync(
        ffmpegPath,
        [
          "-y",
          "-ss",
          "0.0",
          "-i",
          videoFilePath,
          "-vframes",
          "1",
          "-q:v",
          "2",
          fallbackOut,
        ],
        { timeout: 15000 }
      );
      if (fs.existsSync(fallbackOut)) {
        framePaths.push(fallbackOut);
      }
    } catch {}
  }

  return framePaths;
}

/**
 * [FASE 3: MULTI-FRAME PIXEL METRIC EXTRACTION VIA NODE-VIBRANT, SHARP & CULORI]
 * Analyzes video keyframe pixel data with strict watermark exclusion & natural brightness preservation.
 */
export async function extractDominantPalette(framePaths: string[]): Promise<{
  accentHex: string;
  secondaryAccentHex: string;
  primaryHex: string;
  bgHex: string;
  measuredColorGrading: string;
}> {
  if (framePaths.length === 0) {
    return {
      accentHex: "#FF6B00",
      secondaryAccentHex: "#FACC15",
      primaryHex: "#FFFFFF",
      bgHex: "#0F172A",
      measuredColorGrading: "eq=brightness=0.02:contrast=1.03:saturation=1.05",
    };
  }

  try {
    let vibrantPrimaryHex: string | null = null;
    let vibrantSecondaryHex: string | null = null;

    // 1. Extract color swatches via node-vibrant
    for (const framePath of framePaths) {
      if (!fs.existsSync(framePath)) continue;
      try {
        const v = new Vibrant(framePath);
        const pal = await v.getPalette();
        if (pal.Vibrant?.hex && !vibrantPrimaryHex && !isWatermarkBlue(pal.Vibrant.hex)) {
          vibrantPrimaryHex = pal.Vibrant.hex;
        }
        if (pal.DarkVibrant?.hex && !vibrantSecondaryHex && !isWatermarkBlue(pal.DarkVibrant.hex)) {
          vibrantSecondaryHex = pal.DarkVibrant.hex;
        } else if (pal.LightVibrant?.hex && !vibrantSecondaryHex && !isWatermarkBlue(pal.LightVibrant.hex)) {
          vibrantSecondaryHex = pal.LightVibrant.hex;
        }
      } catch {}
    }

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let totalPixels = 0;
    let maxSaturation = 0;
    let vibrantColor = vibrantPrimaryHex || "#FF6B00";
    let minLum = 1.0;
    let maxLum = 0.0;

    for (const framePath of framePaths) {
      if (!fs.existsSync(framePath)) continue;
      const { data, info } = await sharp(framePath)
        .resize(60, 60, { fit: "cover" })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixelCount = info.width * info.height;
      totalPixels += pixelCount;

      for (let i = 0; i < data.length; i += info.channels) {
        const r = (data[i] || 0) / 255;
        const g = (data[i + 1] || 0) / 255;
        const b = (data[i + 2] || 0) / 255;
        rSum += r;
        gSum += g;
        bSum += b;

        const maxVal = Math.max(r, g, b);
        const minVal = Math.min(r, g, b);
        const sat = maxVal === 0 ? 0 : (maxVal - minVal) / maxVal;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;

        if (sat > maxSaturation && lum > 0.25 && lum < 0.92) {
          const c = culori.rgb({ mode: "rgb", r, g, b });
          const candidateHex = culori.formatHex(c);
          if (candidateHex && !isWatermarkBlue(candidateHex)) {
            maxSaturation = sat;
            if (!vibrantPrimaryHex) {
              vibrantColor = candidateHex;
            }
          }
        }
      }
    }

    const avgR = totalPixels > 0 ? rSum / totalPixels : 0.5;
    const avgG = totalPixels > 0 ? gSum / totalPixels : 0.5;
    const avgB = totalPixels > 0 ? bSum / totalPixels : 0.5;
    const avgColor = culori.rgb({ mode: "rgb", r: avgR, g: avgG, b: avgB });

    // [FASE 2 & 3: NATURAL BRIGHTNESS PRESERVATION - ZERO CRUSHED BLACKS]
    // Strictly prohibit negative brightness. Use natural clarity baseline.
    const naturalGrading = "eq=brightness=0.02:contrast=1.03:saturation=1.05";

    let finalAccent = vibrantPrimaryHex || vibrantColor;
    if (isWatermarkBlue(finalAccent)) {
      finalAccent = "#FF6B00";
    }

    let finalSecAccent = vibrantSecondaryHex || "#FACC15";
    if (isWatermarkBlue(finalSecAccent)) {
      finalSecAccent = "#FACC15";
    }

    return {
      accentHex: finalAccent,
      secondaryAccentHex: finalSecAccent,
      primaryHex: "#FFFFFF",
      bgHex: culori.formatHex(avgColor) || "#0F172A",
      measuredColorGrading: naturalGrading,
    };
  } catch (err: any) {
    console.warn("[StyleCloner] Palet ekstraksi notice:", err?.message);
    return {
      accentHex: "#FF6B00",
      secondaryAccentHex: "#FACC15",
      primaryHex: "#FFFFFF",
      bgHex: "#0F172A",
      measuredColorGrading: "eq=brightness=0.02:contrast=1.03:saturation=1.05",
    };
  }
}

/**
 * [FASE 5: CLONE STYLE FROM REFERENCE VIDEO]
 * Uses GEMINI_API_KEY_STYLE_CLONER with sharp & culori to reverse-engineer
 * subtitle typography, color grading, and motion graphics into physical preset files.
 */
export async function cloneStyleFromVideo(input: {
  videoBuffer?: Buffer;
  videoFilePath?: string;
  presetName?: string;
}): Promise<VideoPreset> {
  const tempDir = getTempDir("temp/clone_uploads");
  let targetVideoPath = input.videoFilePath;

  if (!targetVideoPath && input.videoBuffer) {
    targetVideoPath = path.join(tempDir, `ref_${Date.now()}.mp4`);
    fs.writeFileSync(targetVideoPath, input.videoBuffer);
  }

  if (!targetVideoPath || !fs.existsSync(targetVideoPath)) {
    throw new HttpError(400, "MISSING_VIDEO", "File video referensi (5-15s) tidak ditemukan.");
  }

  const sampleFrames = await extractSampleFrames(targetVideoPath);
  const palette = await extractDominantPalette(sampleFrames);

  let detectedStyle: Partial<VideoPreset> = {
    id: "ai-cloned",
    name: input.presetName || "AI Cloned Style 🪄",
    description: "Gaya video yang diekstrak dan diduplikasi secara otomatis dari video referensi Anda.",
    format: "9:16",
    colorGrading: palette.measuredColorGrading,
    transition: "zoom-in",
    enableTopMotion: false,
    enableHook: true,
    enablePolish: true,
    layoutArchitecture: "IN_SCENE_KINETIC_CLIPPER",
    subtitleBehavior: "SINGLE_WORD_POP",
    hookTypographyStyle: "GLOWING_STACKED_IMPACT",
    styleVariant: 0,
    accentColor: palette.accentHex || "#FF6B00",
    cameraFraming: "FULL_9_16_SPEAKER_TRACK",
    hasTopInfographicCard: false,
    hookVisualType: "IN_SCENE_KINETIC_HOOK",
    primaryAccentHex: palette.accentHex || "#FF6B00",
    secondaryAccentHex: palette.secondaryAccentHex || "#FACC15",
    colorMood: "DARK_MOODY_CONTRAST",
    subtitleStyle: {
      fontName: "Montserrat ExtraBold",
      fontSize: 52,
      primaryColor: "#FFFFFF",
      highlightColor: "#FF6B00",
      outlineColor: "#000000",
      outlineWidth: 4,
      alignment: 2,
      marginV: 360,
      bold: true,
      animation: "bounce-popup",
      bounceScale: 1.25,
      showSpeakerTag: false,
    },
    motionGraphic: {
      progressBar: false,
      punchZoom: true,
      punchZoomScale: 1.15,
    },
  };

  if (sampleFrames.length > 0) {
    try {
      const promptText = `
You are an elite video colorist, art director, and visual reverse-engineer for viral short-form videos (TikTok, Shorts, Reels, WhatsApp e.g. @renxclip clipper style).
Analyze these 8 sequential frames extracted across the timeline (0.0s to 10.0s) of a reference viral short-form video.
Real measured color metrics from video pixels (watermark exclusion applied):
- Primary Vibrant Accent: ${palette.accentHex}
- Secondary Accent: ${palette.secondaryAccentHex}
- Ambient Background: ${palette.bgHex}
- Natural Crisp Color Grading: ${palette.measuredColorGrading}

Analisis gaya editing video pendek ini secara menyeluruh agar dapat direplikasi 1:1 pada video lain. Perhatikan:
1. Bagaimana gaya teks pada 5 detik pertama (Hook)? Apakah teks bertumpuk di tengah/atas dengan kata kunci berwarna mencolok (misal Oranye #FF6B00 atau Kuning #FACC15) yang berganti mengikuti ucapan ("DYNAMIC_STACKED_GLOW")?
2. Bagaimana gaya teks subtitle setelah detik ke-5? Apakah muncul 1 kata per waktu di tengah bawah ("SINGLE_WORD_POP"), atau kalimat 3-4 kata dengan kotak highlight?
3. Apa warna eksak (HEX) dari teks utama (biasanya #FFFFFF) dan warna aksen/glow pada kata penting (misal #FF6B00 Oranye pada video @renxclip, BUKAN warna biru logo TikTok!)?
4. Apakah menggunakan tampilan layar penuh vertikal 9:16 yang menyorot pembicara ("FULL_9_16_SPEAKER_TRACK"), atau tampilan 16:9 di tengah dengan latar blur ("CENTER_16_9_BLUR")?
5. Apakah ada kartu tabel infografis di bagian atas (has_top_infographic: true/false)?

Examine the frames carefully and reverse-engineer the EXACT styling & layout architecture:
1. Camera Framing ("camera_framing"):
   - "FULL_9_16_SPEAKER_TRACK": Select this if the main video fills the entire vertical screen without letterbox bars on top/bottom.
   - "LETTERBOX_16_9_BLUR_BG": Select this if the video is 16:9 centered in the middle with blurred copy of the video on top and bottom.

2. Has Top Infographic Card ("has_top_infographic_card"):
   - false: If the video does NOT have an infographic box / diagram card at the top (like viral clipper videos such as @renxclip).
   - true: If the video has a dedicated top bar/box showing diagrams, flow steps, or metric numbers.

3. Hook Visual Type ("hook_visual_type"):
   - "IN_SCENE_KINETIC_HOOK": Glowing kinetic hook typography inside the video scene during the first seconds.
   - "TOP_HEADER_CARD": Card banner placed at top.
   - "NONE": No hook overlay.

4. Color Mood ("color_mood"):
   - "NATURAL_CRISP" | "WARM_CINEMATIC" | "DARK_MOODY_CONTRAST"

5. Layout Architecture ("layout_architecture"):
   - "IN_SCENE_KINETIC_CLIPPER": Select this if the video focuses directly on the speaker with a glowing text Hook in the first few seconds, followed by 1-word-per-word rapid subtitles at the bottom without top infographic cards.
   - "TOP_INFOGRAPHIC_PODCAST": Select this if the video has a dedicated top bar/box showing diagrams, flow steps, or metric numbers.
   - "FULL_VERTICAL_CROP": Select this if the video is cropped to fill the entire 9:16 vertical screen.

6. Subtitle Behavior ("subtitle_behavior"):
   - "SINGLE_WORD_POP": Subtitle appears 1 word (or max 2 short words) alternating rapidly in center bottom without background box (thick white text 72px + strong black outline/shadow, exactly @renxclip style).
   - "PHRASE_HIGHLIGHT_BOX": Subtitle displays 3-4 words per line with shifting color box/pill.
   - "CLEAN_CINEMATIC_LINE": Subtitle displays full sentence minimal movie line.
   - "DUAL_COLOR_DYNAMIC": Subtitle displays 2-3 words where active word turns golden yellow/cyan/orange at 115% size.

7. Hook Typography Style ("hook_typography_style"):
   - "GLOWING_STACKED_IMPACT": Top line small white text 44px + Bottom line GIANT glowing punchword 84px (#FF6B00 orange or #FACC15 yellow) with warm glow behind text (active during first 5 seconds).
   - "EDITORIAL_SERIF_BANNER": Documentary Cinzel serif banner.

8. Subtitle Typography:
   - "fontName": Choose the closest match from: ["Montserrat ExtraBold", "Plus Jakarta Sans", "Poppins Black", "Anton", "Bebas Neue"]
   - "fontSize": integer (68 to 76, default 72 for viral clippers)
   - "primaryColor": Hex color of normal spoken words ("#FFFFFF")
   - "highlightColor": Hex color of active/highlighted spoken word ("#FF6B00" vibrant orange, or "#FACC15" yellow, NEVER blue watermark!)
   - "outlineColor": Hex color for outline ("#000000")
   - "outlineWidth": integer (4)
   - "marginV": vertical margin from bottom in 1080x1920 (480 for Y=1440)

9. Color Grading Filter for FFmpeg:
   - "colorGrading": Always use natural bright clarity without crushed blacks: "eq=brightness=0.02:contrast=1.03:saturation=1.05"

Return ONLY a pure JSON object matching this schema without markdown fences:
{
  "name": "AI Cloned Style",
  "description": "Gaya estetik dari video referensi",
  "camera_framing": "FULL_9_16_SPEAKER_TRACK",
  "has_top_infographic_card": false,
  "hook_visual_type": "IN_SCENE_KINETIC_HOOK",
  "color_mood": "NATURAL_CRISP",
  "primary_accent_hex": "#FF6B00",
  "secondary_accent_hex": "#FACC15",
  "layout_architecture": "IN_SCENE_KINETIC_CLIPPER",
  "subtitle_behavior": "SINGLE_WORD_POP",
  "hook_typography_style": "GLOWING_STACKED_IMPACT",
  "enableTopMotion": false,
  "enableHook": true,
  "enablePolish": true,
  "accentColor": "#FF6B00",
  "colorGrading": "eq=brightness=0.02:contrast=1.03:saturation=1.05",
  "subtitleStyle": {
    "fontName": "Montserrat ExtraBold",
    "fontSize": 72,
    "primaryColor": "#FFFFFF",
    "highlightColor": "#FF6B00",
    "outlineColor": "#000000",
    "outlineWidth": 4,
    "alignment": 2,
    "marginV": 480,
    "bold": true,
    "animation": "bounce-popup",
    "bounceScale": 1.25
  },
  "motionGraphic": {
    "progressBar": false,
    "punchZoom": true,
    "punchZoomScale": 1.15
  }
}
`;

      const candidateModels = [
        "gemini-3.8-flash",      // Rekomendasi Resmi Google Gemini API
        "gemini-3.5-flash",      // Model Vision Sangat Stabil & Cepat
        "gemini-3.6-flash",      // Alternatif Flash
        "gemini-3.5-flash-lite", // Ringan & Cepat
        "gemini-flash-latest",   // Dynamic Latest Pointer
      ];
      const candidateText = await executeGeminiWithFailover({
        service: "STYLE_CLONER",
        candidateModels,
        timeoutMs: 30000,
        action: async (ai, modelName, keyInfo) => {
          console.log(`[StyleCloner] Mengirim ${sampleFrames.length} keyframe ke ${modelName} (${keyInfo.label})...`);
          const model = ai.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.15,
              responseMimeType: "application/json",
            },
          });
          const imageParts = sampleFrames.map((fPath) => ({
            inlineData: {
              data: fs.readFileSync(fPath).toString("base64"),
              mimeType: "image/jpeg",
            },
          }));
          const res = await model.generateContent([promptText, ...imageParts]);
          return res.response.text();
        },
      });

      if (candidateText) {
        let clean = candidateText.trim();
        if (clean.startsWith("```json")) {
          clean = clean.replace(/^```json/, "").replace(/```$/, "").trim();
        } else if (clean.startsWith("```")) {
          clean = clean.replace(/^```/, "").replace(/```$/, "").trim();
        }

        let parsed: any;
        try {
          parsed = JSON.parse(clean);
        } catch {
          parsed = JSON.parse(jsonrepair(clean));
        }

        const cleanName = input.presetName || parsed.name || "AI Cloned Style 🪄";
        let rawAccent =
          parsed.accentColor && /^#[0-9A-Fa-f]{6}$/.test(parsed.accentColor)
            ? parsed.accentColor
            : parsed.subtitleStyle?.highlightColor && /^#[0-9A-Fa-f]{6}$/.test(parsed.subtitleStyle.highlightColor)
            ? parsed.subtitleStyle.highlightColor
            : palette.accentHex || "#FF6B00";

        // Anti-watermark contamination check
        if (isWatermarkBlue(rawAccent)) {
          rawAccent = "#FF6B00";
        }
        const finalAccentColor = rawAccent;

        const layoutArch =
          parsed.layout_architecture === "IN_SCENE_KINETIC_CLIPPER" ||
          parsed.layout_architecture === "TOP_INFOGRAPHIC_PODCAST" ||
          parsed.layout_architecture === "FULL_VERTICAL_CROP"
            ? parsed.layout_architecture
            : (parsed.enableTopMotion === false ? "IN_SCENE_KINETIC_CLIPPER" : "TOP_INFOGRAPHIC_PODCAST");

        const isKineticClipper = layoutArch === "IN_SCENE_KINETIC_CLIPPER";

        const subtitleBehav =
          parsed.subtitle_behavior === "SINGLE_WORD_POP" ||
          parsed.subtitle_behavior === "PHRASE_HIGHLIGHT_BOX" ||
          parsed.subtitle_behavior === "CLEAN_CINEMATIC_LINE" ||
          parsed.subtitle_behavior === "DUAL_COLOR_DYNAMIC"
            ? parsed.subtitle_behavior
            : (isKineticClipper ? "SINGLE_WORD_POP" : "PHRASE_HIGHLIGHT_BOX");

        const hookStyle =
          parsed.hook_typography_style === "GLOWING_STACKED_IMPACT" ||
          parsed.hook_typography_style === "EDITORIAL_SERIF_BANNER"
            ? parsed.hook_typography_style
            : (isKineticClipper ? "GLOWING_STACKED_IMPACT" : "EDITORIAL_SERIF_BANNER");

        const enableTopMotionFinal = isKineticClipper ? false : (typeof parsed.enableTopMotion === "boolean" ? parsed.enableTopMotion : true);
        const styleVariantFinal = isKineticClipper ? 0 : 1;

        const camFraming =
          parsed.camera_framing === "FULL_9_16_SPEAKER_TRACK" || parsed.camera_framing === "LETTERBOX_16_9_BLUR_BG"
            ? parsed.camera_framing
            : (isKineticClipper ? "FULL_9_16_SPEAKER_TRACK" : "LETTERBOX_16_9_BLUR_BG");

        const hasTopCard =
          typeof parsed.has_top_infographic_card === "boolean"
            ? parsed.has_top_infographic_card
            : !isKineticClipper;

        const hookVisType =
          parsed.hook_visual_type === "IN_SCENE_KINETIC_HOOK" ||
          parsed.hook_visual_type === "IN_SCENE_GLOW_TYPOGRAPHY" ||
          parsed.hook_visual_type === "TOP_BANNER_CARD" ||
          parsed.hook_visual_type === "NONE"
            ? parsed.hook_visual_type
            : (isKineticClipper ? "IN_SCENE_KINETIC_HOOK" : "TOP_BANNER_CARD");

        let priAccent =
          parsed.primary_accent_hex && /^#[0-9A-Fa-f]{6}$/.test(parsed.primary_accent_hex)
            ? parsed.primary_accent_hex
            : (isKineticClipper && !parsed.accentColor ? "#FF6B00" : finalAccentColor);

        if (isWatermarkBlue(priAccent)) {
          priAccent = "#FF6B00";
        }

        let secAccent =
          parsed.secondary_accent_hex && /^#[0-9A-Fa-f]{6}$/.test(parsed.secondary_accent_hex)
            ? parsed.secondary_accent_hex
            : palette.secondaryAccentHex || "#FACC15";

        if (isWatermarkBlue(secAccent)) {
          secAccent = "#FACC15";
        }

        const colorMoodVal = parsed.color_mood || (isKineticClipper ? "NATURAL_CRISP" : "DARK_MOODY_CONTRAST");

        const parsedSub = parsed.subtitleStyle || {};
        let subHighlight = normalizeClonedColor(parsedSub.highlightColor, isKineticClipper ? "#FF6B00" : finalAccentColor);
        if (isWatermarkBlue(subHighlight)) {
          subHighlight = "#FF6B00";
        }
        detectedStyle = {
          ...detectedStyle,
          ...parsed,
          name: cleanName,
          accentColor: isKineticClipper && !parsed.accentColor ? "#FF6B00" : finalAccentColor,
          colorGrading: parsed.colorGrading || palette.measuredColorGrading,
          layoutArchitecture: layoutArch,
          subtitleBehavior: subtitleBehav,
          hookTypographyStyle: hookStyle,
          styleVariant: styleVariantFinal,
          enableTopMotion: enableTopMotionFinal,
          enableHook: typeof parsed.enableHook === "boolean" ? parsed.enableHook : true,
          enablePolish: typeof parsed.enablePolish === "boolean" ? parsed.enablePolish : true,

          // Universal Blueprint fields
          cameraFraming: camFraming,
          hasTopInfographicCard: hasTopCard,
          hookVisualType: hookVisType,
          primaryAccentHex: priAccent,
          secondaryAccentHex: secAccent,
          colorMood: colorMoodVal,

          subtitleStyle: {
            ...detectedStyle.subtitleStyle,
            ...parsedSub,
            fontName: normalizeClonedFont(parsedSub.fontName),
            fontSize: typeof parsedSub.fontSize === "number" && parsedSub.fontSize >= 60 ? parsedSub.fontSize : (isKineticClipper ? 72 : 48),
            primaryColor: parsedSub.primaryColor || "#FFFFFF",
            highlightColor: subHighlight,
            outlineColor: parsedSub.outlineColor || "#000000",
            outlineWidth: typeof parsedSub.outlineWidth === "number" ? parsedSub.outlineWidth : (isKineticClipper ? 4 : 3),
            marginV: typeof parsedSub.marginV === "number" ? parsedSub.marginV : (isKineticClipper ? 480 : 340),
            bold: true,
            showSpeakerTag: false,
          },
        };
      }
    } catch (err: any) {
      console.warn("[Style Cloner] Gemini visual analysis error, fallback:", err?.message);
    }
  }

  // Clean up extracted sample frames
  sampleFrames.forEach((fp) => {
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch {}
  });

  const timestamp = Date.now();
  const clonedId = `cloned-${timestamp}`;
  const finalPreset: Partial<VideoPreset> = {
    ...detectedStyle,
    id: clonedId,
    badge: "Clone Saja",
    isCloned: true,
    isCustom: true,
    pipelineMode: "clone_only",
    layoutArchitecture: detectedStyle.layoutArchitecture || "IN_SCENE_KINETIC_CLIPPER",
    subtitleBehavior: detectedStyle.subtitleBehavior || "SINGLE_WORD_POP",
    hookTypographyStyle: detectedStyle.hookTypographyStyle || "GLOWING_STACKED_IMPACT",
    styleVariant: detectedStyle.styleVariant ?? 0,
    accentColor: isWatermarkBlue(detectedStyle.accentColor) ? "#FF6B00" : (detectedStyle.accentColor || palette.accentHex || "#FF6B00"),
    colorGrading: detectedStyle.colorGrading?.includes("brightness=-")
      ? "eq=brightness=0.02:contrast=1.03:saturation=1.05"
      : (detectedStyle.colorGrading || palette.measuredColorGrading || "eq=brightness=0.02:contrast=1.03:saturation=1.05"),
    enableHook: detectedStyle.enableHook ?? true,
    enableTopMotion: detectedStyle.enableTopMotion ?? false,
    enablePolish: detectedStyle.enablePolish ?? true,

    // Universal Clone Blueprint (Fase 3 & 5)
    cameraFraming: detectedStyle.cameraFraming || (detectedStyle.layoutArchitecture === "IN_SCENE_KINETIC_CLIPPER" ? "FULL_9_16_SPEAKER_TRACK" : "LETTERBOX_16_9_BLUR_BG"),
    hasTopInfographicCard: typeof detectedStyle.hasTopInfographicCard === "boolean" ? detectedStyle.hasTopInfographicCard : (detectedStyle.layoutArchitecture !== "IN_SCENE_KINETIC_CLIPPER"),
    hookVisualType: detectedStyle.hookVisualType || (detectedStyle.layoutArchitecture === "IN_SCENE_KINETIC_CLIPPER" ? "IN_SCENE_KINETIC_HOOK" : "TOP_BANNER_CARD"),
    primaryAccentHex: isWatermarkBlue(detectedStyle.primaryAccentHex) ? "#FF6B00" : (detectedStyle.primaryAccentHex || detectedStyle.accentColor || palette.accentHex || "#FF6B00"),
    secondaryAccentHex: isWatermarkBlue(detectedStyle.secondaryAccentHex) ? "#FACC15" : (detectedStyle.secondaryAccentHex || palette.secondaryAccentHex || "#FACC15"),
    colorMood: detectedStyle.colorMood || (detectedStyle.layoutArchitecture === "IN_SCENE_KINETIC_CLIPPER" ? "NATURAL_CRISP" : "DARK_MOODY_CONTRAST"),
    createdAt: new Date().toISOString(),
  };

  // Save the cloned preset to cloned-{timestamp}.json physically in presets dir
  const saved = await savePreset(finalPreset);

  // Also mirror to ai-cloned.json for backwards compatibility
  try {
    await savePreset({
      ...finalPreset,
      id: "ai-cloned",
      name: `${finalPreset.name} (Latest)`,
    });
  } catch {}

  return saved;
}
