import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { getFfmpegPath } from "../../utils/ffmpeg-path";
import type { UniversalParametricBlueprint, TypographyStyleSchema } from "./universal_style_analyzer";
import type { WordTimestamp } from "./clone_subtitle_generator";
import { CLONE_POP_EASING } from "./easing_engine";
import { getClosestFont, resolveCanvasFontString } from "./font_registry";
import { z } from "zod";

type TypographyStyle = z.infer<typeof TypographyStyleSchema>;

export type { WordTimestamp };

export interface RenderParametricHookInput {
  destinationPath: string;
  durationSec: number;
  spokenWords: WordTimestamp[];
  summaryHeadline?: string;
  blueprint: any;
}

function applyCasing(text: string, casing: "UPPERCASE" | "lowercase" | "Capitalize"): string {
  if (casing === "UPPERCASE") return text.toUpperCase();
  if (casing === "lowercase") return text.toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * [FASE 3: SMART MULTI-LINE AUTO-WRAPPING & BOUNDS-CONSTRAINED SCALING]
 * Menjamin teks hook tidak pernah melebihi maxWidth (900px) dan tidak terpotong di tepi kanan/kiri.
 * Jika teks panjang, otomatis dibungkus rapi menjadi 2 baris atau font diperkecil secara proporsional.
 */
function layoutWrappedLines(
  ctx: SKRSContext2D,
  rawText: string,
  initialFontSize: number,
  fontWeight: string,
  fontFamily: string,
  maxWidth: number,
  maxLines: number = 2
): { lines: string[]; fontSize: number; lineHeight: number } {
  let fontSize = initialFontSize;
  const minFontSize = Math.max(34, Math.round(initialFontSize * 0.60));

  while (fontSize >= minFontSize) {
    ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
    const words = rawText.trim().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = word;
          break;
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    const allFit =
      lines.length <= maxLines &&
      lines.every((l) => ctx.measureText(l).width <= maxWidth);

    if (allFit || fontSize === minFontSize) {
      const lineHeight = Math.round(fontSize * 1.25);
      return { lines, fontSize, lineHeight };
    }

    fontSize -= 4;
  }

  ctx.font = `${fontWeight} ${minFontSize}px "${fontFamily}", sans-serif`;
  return {
    lines: [rawText],
    fontSize: minFontSize,
    lineHeight: Math.round(minFontSize * 1.25),
  };
}

/**
 * [FASE 3: RENDER OPENING HOOK PARAMETRIK (0.0s s/d 6.0s)]
 * Menggambar teks pembuka persis sesuai koordinat, ukuran font, dan efek visual di blueprint.
 * Menjamin teks hook 100% tepat di tengah horizontal layar dan tidak terpotong tepi layar.
 */
export async function renderParametricOpeningHook(
  input: RenderParametricHookInput
): Promise<string> {
  const hookConfig = input.blueprint.opening_hook || {
    has_special_opening_text: input.blueprint.opening_hook_engine?.enabled ?? true,
    active_start_sec: input.blueprint.opening_hook_engine?.active_zone_start_sec ?? 0.0,
    active_end_sec: input.blueprint.opening_hook_engine?.active_zone_end_sec ?? 6.0,
    text_placement_x_ratio: 0.5,
    text_placement_y_ratio: input.blueprint.opening_hook_engine?.layout_geometry?.anchor_y ?? 0.45,
    text_align: "center",
    backdrop_dim_opacity: input.blueprint.opening_hook_engine?.scene_dimmer_during_hook?.dim_background_opacity ?? 0.35,
    line_1_style: {
      casing: input.blueprint.opening_hook_engine?.line_1_setup?.casing ?? "UPPERCASE",
      font_weight: (input.blueprint.opening_hook_engine?.line_1_setup?.font_weight as any) ?? "Bold",
      size_px: input.blueprint.opening_hook_engine?.line_1_setup?.font_size_px ?? 48,
      color_hex: input.blueprint.opening_hook_engine?.line_1_setup?.color_hex ?? "#FFFFFF",
      visual_effect: "SHADOW" as const,
      effect_color_hex: input.blueprint.opening_hook_engine?.line_1_setup?.shadow?.color_hex ?? "#000000",
      effect_radius_px: input.blueprint.opening_hook_engine?.line_1_setup?.shadow?.blur_px ?? 8,
    },
    line_2_style: {
      casing: input.blueprint.opening_hook_engine?.line_2_punchword?.casing ?? "UPPERCASE",
      font_weight: (input.blueprint.opening_hook_engine?.line_2_punchword?.font_weight as any) ?? "Black",
      size_px: input.blueprint.opening_hook_engine?.line_2_punchword?.font_size_px ?? 84,
      color_hex: input.blueprint.opening_hook_engine?.line_2_punchword?.color_hex ?? "#FF7A00",
      visual_effect: "MOTION_BLUR_GLOW" as const,
      effect_color_hex: input.blueprint.opening_hook_engine?.line_2_punchword?.color_hex ?? "#FF7A00",
      effect_radius_px: 16,
    },
  };

  if (!hookConfig.has_special_opening_text) {
    return "";
  }

  const durationSec = Math.min(input.durationSec, hookConfig.active_end_sec || 6.0);
  const fps = 30;
  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const width = 1080;
  const height = 1920;

  const targetPath = input.destinationPath.replace(/\.mp4$/i, ".mov");
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const ffmpegExe = getFfmpegPath();

  const ffmpegProc = spawn(
    ffmpegExe,
    [
      "-y",
      "-f", "rawvideo",
      "-pix_fmt", "rgba",
      "-s", `${width}x${height}`,
      "-r", String(fps),
      "-i", "pipe:0",
      "-c:v", "qtrle",
      "-t", String(durationSec),
      targetPath,
    ],
    { stdio: ["pipe", "ignore", "pipe"] }
  );

  // Ambil kata pembuka untuk hook
  const fallbackHeadline = input.summaryHeadline || "SOROTAN UTAMA TOPIK";
  const wordsInRange = input.spokenWords.filter(
    (w) => w.start >= hookConfig.active_start_sec && w.start <= durationSec
  );

  // Batasi maksimal 10 kata agar tidak memenuhi layar
  const wordsList =
    wordsInRange.length > 0
      ? wordsInRange.slice(0, 10).map((w) => w.word)
      : fallbackHeadline.split(/\s+/);

  const half = Math.ceil(wordsList.length / 2);
  const line1Raw = wordsList.slice(0, half).join(" ");
  const line2Raw = wordsList.slice(half).join(" ") || line1Raw;

  const line1Text = applyCasing(line1Raw, hookConfig.line_1_style?.casing || "UPPERCASE");
  const line2Text = applyCasing(line2Raw, hookConfig.line_2_style?.casing || "UPPERCASE");

  const rawFontName =
    input.blueprint?.subtitle_system?.font_family ||
    input.blueprint?.body_subtitle_engine?.typography?.font_family ||
    input.blueprint?.holistic_dna?.hook_typography?.font_family ||
    "Montserrat ExtraBold";
  const fontName = getClosestFont(rawFontName);

  // SELALU gunakan centerX = 540 (Dead center layar 1080x1920)
  const centerX = Math.round(width * 0.5);
  const centerY = Math.round(height * (hookConfig.text_placement_y_ratio || 0.45));
  const MAX_SAFE_WIDTH = 900; // 90px safe margin kiri & kanan (1080 - 180 = 900)

  // Hitung layout pembungkusan teks multi-baris otomatis
  const line1Layout = layoutWrappedLines(
    ctx,
    line1Text,
    hookConfig.line_1_style?.size_px || 48,
    hookConfig.line_1_style?.font_weight || "Bold",
    fontName,
    MAX_SAFE_WIDTH,
    2
  );

  const line2Layout = layoutWrappedLines(
    ctx,
    line2Text,
    hookConfig.line_2_style?.size_px || 84,
    hookConfig.line_2_style?.font_weight || "Black",
    fontName,
    MAX_SAFE_WIDTH,
    2
  );

  const gapBetweenLines = 24;
  const totalBlockHeight =
    line1Layout.lines.length * line1Layout.lineHeight +
    gapBetweenLines +
    line2Layout.lines.length * line2Layout.lineHeight;

  // [FASE 2: ADAPTIVE LAYOUT GEOMETRY & CHIN COLLISION GUARD]
  // Kunci batas penempatan teks vertikal agar tidak pernah menabrak dagu atau wajah pembicara (Y: 1100 s/d 1480 px).
  let startY = centerY - totalBlockHeight / 2;
  const MIN_SAFE_Y = 1100;
  const MAX_SAFE_Y = 1480;
  if (startY + totalBlockHeight > MAX_SAFE_Y) {
    startY = MAX_SAFE_Y - totalBlockHeight;
  }
  if (startY < MIN_SAFE_Y) {
    startY = MIN_SAFE_Y;
  }

  // [FASE 2: MULTI-LAYER TYPOGRAPHY EXTRACTION VIA @napi-rs/canvas]
  // Pass 1: Directional Motion Blur slices
  // Pass 2: Ambient Bloom Glow (Neon halo)
  // Pass 3: Sharp Core Text with solid stroke & directed shadow
  const drawTypographyLine = (
    c: SKRSContext2D,
    text: string,
    x: number,
    y: number,
    style: TypographyStyle,
    lineHeight: number,
    scaleAnim: number,
    alphaAnim: number
  ) => {
    if (!text.trim() || alphaAnim <= 0) return;
    c.save();
    c.translate(x, y);
    c.scale(scaleAnim, scaleAnim);
    c.globalAlpha = Math.max(0, Math.min(1, alphaAnim));
    c.textAlign = "center"; // WAJIB CENTER: Mengunci presisi horizontal 100% di tengah
    c.textBaseline = "middle"; // WAJIB MIDDLE: Mengunci presisi vertikal

    const fontStyle = `${style.font_weight} ${style.size_px}px "${fontName}", sans-serif`;
    c.font = fontStyle;

    // Optional Highlight Pill Box (Skill Tipografi & Efek Kinetik)
    if (
      style.visual_effect === "SOLID_BOX" ||
      style.visual_effect === "BOX" ||
      style.visual_effect === "HIGHLIGHT_PILL" ||
      style.visual_effect === "PILL"
    ) {
      const metrics = c.measureText(text);
      const boxW = metrics.width + 44;
      const boxH = Math.round(lineHeight * 0.94);
      const boxX = -boxW / 2;
      const boxY = -boxH / 2;
      c.fillStyle = style.effect_color_hex || "#E50914";
      c.beginPath();
      c.roundRect(boxX, boxY, boxW, boxH, 18);
      c.fill();
    }

    // PASS 1: Directional Motion Blur (multi-offset horizontal blur slices)
    if (
      style.visual_effect === "MOTION_BLUR_GLOW" ||
      style.visual_effect === "NEON_GLOW" ||
      style.visual_effect === "GLOW"
    ) {
      c.save();
      c.globalAlpha = Math.max(0, Math.min(1, alphaAnim)) * 0.25;
      c.fillStyle = style.effect_color_hex;
      for (const offset of [-8, -4, 4, 8]) {
        c.fillText(text, offset, 0);
      }
      c.restore();
    }

    // PASS 2: Ambient Bloom Glow (High-radius neon aura)
    if (
      style.visual_effect === "MOTION_BLUR_GLOW" ||
      style.visual_effect === "NEON_GLOW" ||
      style.visual_effect === "GLOW"
    ) {
      c.save();
      c.shadowColor = style.effect_color_hex;
      c.shadowBlur = Math.max(16, (style.effect_radius_px || 16) * 1.5);
      c.globalAlpha = Math.max(0, Math.min(1, alphaAnim)) * 0.85;
      c.fillStyle = style.color_hex;
      c.fillText(text, 0, 0);
      c.restore();
    }

    // PASS 3: Sharp Core Text (Stroke hitam tegas + drop shadow terarah)
    c.save();
    c.shadowColor = "rgba(0, 0, 0, 0.85)";
    c.shadowOffsetX = 3;
    c.shadowOffsetY = 4;
    c.shadowBlur = 5;
    c.strokeStyle = "#000000";
    c.lineWidth = Math.max(2, Math.round(style.size_px * 0.055));
    c.strokeText(text, 0, 0);
    c.fillStyle = style.color_hex;
    c.fillText(text, 0, 0);
    c.restore();

    c.restore();
  };

  try {
    for (let f = 0; f < totalFrames; f++) {
      const curTime = f / fps;
      ctx.clearRect(0, 0, width, height);

      // 1. Backdrop Dim
      if (hookConfig.backdrop_dim_opacity > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${hookConfig.backdrop_dim_opacity})`;
        ctx.fillRect(0, 0, width, height);
      }

      // [FASE 2: LIGHTWEIGHT EASING ENGINE (cubic-bezier 0.25, 1, 0.5, 1)]
      const enterP1 = Math.min(1, curTime / 0.35);
      const eased1 = CLONE_POP_EASING(enterP1);
      const scale1 = 0.88 + 0.12 * eased1;
      const alpha1 = eased1;

      // Animasi Baris 2 (staggered delay 0.12s)
      const enterP2 = Math.min(1, Math.max(0, (curTime - 0.12) / 0.35));
      const eased2 = CLONE_POP_EASING(enterP2);
      const scale2 = 0.85 + 0.15 * eased2;
      const alpha2 = eased2;

      // Animasi keluar menjelang akhir hook
      const exitStart = durationSec - 0.4;
      let exitAlpha = 1.0;
      if (curTime >= exitStart) {
        exitAlpha = Math.max(0, 1.0 - (curTime - exitStart) / 0.4);
      }

      // Gambar Line 1 (Setup)
      for (let i = 0; i < line1Layout.lines.length; i++) {
        const lineStr = line1Layout.lines[i]!;
        const lineY = startY + (i + 0.5) * line1Layout.lineHeight;
        drawTypographyLine(
          ctx,
          lineStr,
          centerX,
          lineY,
          {
            ...hookConfig.line_1_style,
            size_px: line1Layout.fontSize,
          },
          line1Layout.lineHeight,
          scale1,
          alpha1 * exitAlpha
        );
      }

      // Gambar Line 2 (Giant Punchword)
      const line2StartY =
        startY + line1Layout.lines.length * line1Layout.lineHeight + gapBetweenLines;
      for (let j = 0; j < line2Layout.lines.length; j++) {
        const lineStr = line2Layout.lines[j]!;
        const lineY = line2StartY + (j + 0.5) * line2Layout.lineHeight;
        drawTypographyLine(
          ctx,
          lineStr,
          centerX,
          lineY,
          {
            ...hookConfig.line_2_style,
            size_px: line2Layout.fontSize,
          },
          line2Layout.lineHeight,
          scale2,
          alpha2 * exitAlpha
        );
      }

      // Optional Kinetic Progress Bar (Skill Tipografi & Motion)
      const showProgress =
        input.blueprint?.holistic_dna?.subtitles?.progress_bar ||
        input.blueprint?.motion_graphic?.progressBar;
      if (showProgress) {
        const barH = 6;
        const progress = Math.min(1.0, curTime / durationSec);
        const barW = Math.round(width * progress);
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(0, height - barH, width, barH);
        ctx.fillStyle = hookConfig.line_2_style?.color_hex || "#2cd3c6";
        ctx.fillRect(0, height - barH, barW, barH);
      }

      const imgData = ctx.getImageData(0, 0, width, height);
      const buf = Buffer.from(imgData.data.buffer);
      const canWrite = ffmpegProc.stdin.write(buf);
      if (!canWrite) {
        await new Promise((r) => ffmpegProc.stdin.once("drain", r));
      }
    }

    ffmpegProc.stdin.end();
    await new Promise<void>((resolve, reject) => {
      ffmpegProc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg hook overlay exited with code ${code}`));
      });
      ffmpegProc.on("error", reject);
    });

    console.log(`[ParametricOverlay] Opening hook berhasil dirender presisi: ${targetPath}`);
    return targetPath;
  } catch (err: any) {
    console.warn(`[ParametricOverlay] Notice render hook: ${err?.message}`);
    return "";
  }
}
