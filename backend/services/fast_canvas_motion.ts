import { createCanvas, Image, Path2D, GlobalFonts, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createNoise2D } from "simplex-noise";
import chroma from "chroma-js";
import { line, curveMonotoneX } from "d3-shape";
import { easeCubicOut, easeBackOut, easeQuadInOut } from "d3-ease";
import { interpolateRgb, interpolateNumber } from "d3-interpolate";
import { gsap } from "gsap";
import BezierEasing from "bezier-easing";
import * as LucideIcons from "lucide-static";
import { getFfmpegPath } from "../utils/ffmpeg-path";
import type { ClipMotionMetadata, MotionArchetype, ExplanationBeat, VisualSceneType, VisualSceneDataPayload } from "./motion_director";
import { cleanAscii, truncateAtWordBoundary } from "./motion_director";
import { getFontsDirPath } from "./ass-generator.service";

const createBezier = (BezierEasing as any).default || BezierEasing;
export const easeOutExpo = createBezier(0.16, 1, 0.3, 1);

/**
 * Resolves the easing function selected by the AI Art Director.
 */
export function resolveEasing(curve?: string): (t: number) => number {
  if (curve === "easeBackOut") return easeBackOut;
  if (curve === "easeCubicOut") return easeCubicOut;
  if (curve === "easeQuadInOut") return easeQuadInOut;
  return easeOutExpo;
}

export interface FastCanvasMotionOptions {
  config: ClipMotionMetadata;
  destinationPath: string;
  durationSec?: number;
  width?: number;
  height?: number;
}

// Global simplex noise instance for smooth natural fluid waves
const noise2D = createNoise2D();

// GSAP Power3 Out Easing Function
const power3Out = gsap.parseEase("power3.out");

// In-memory icon cache for vector SVG icons from lucide-static
const iconCache = new Map<string, Image>();

function getLucideIconImage(iconName?: string, colorHex = "#FFFFFF"): Image | null {
  const name = iconName || "Sparkles";
  const key = `${name}_${colorHex}`;
  if (iconCache.has(key)) return iconCache.get(key)!;

  const rawSvg =
    (LucideIcons as Record<string, string>)[name] ||
    LucideIcons.Sparkles ||
    LucideIcons.Activity ||
    LucideIcons.Flame;

  if (!rawSvg) return null;

  try {
    const coloredSvg = rawSvg
      .replace(/stroke="currentColor"/g, `stroke="${colorHex}"`)
      .replace(/stroke="[^"]*"/, `stroke="${colorHex}"`);
    const img = new Image();
    img.src = Buffer.from(coloredSvg);
    iconCache.set(key, img);
    return img;
  } catch {
    return null;
  }
}

/**
 * Procedurally draws a single frame of the 1080x500 motion header (30 FPS).
 * Elements moving in EVERY frame:
 * 1. Dynamic Audio Equalizer (24 bars via simplex-noise & chroma-js)
 * 2. Dynamic Wave Curve Graph (via d3-shape curveMonotoneX)
 * 3. Rolling Number Counter (via gsap power3.out)
 * 4. Active Progress Stepper Timeline
 * 5. Lucide Vector Icon beside the headline
 */
export function drawMotionHeaderFrame(
  canvas: Canvas,
  ctx: SKRSContext2D,
  options: {
    width: number;
    height: number;
    frameIndex: number;
    totalFrames: number;
    config: ClipMotionMetadata;
    styleVariant?: number;
  }
) {
  const { width, height, frameIndex, totalFrames, config } = options;
  const progress = Math.min(1, Math.max(0, frameIndex / totalFrames));
  const archetype: MotionArchetype = config.archetype || "AUDIO_RADAR";
  const headline = (config.headline || config.title || "END-TO-END BLUEPRINT").toUpperCase().slice(0, 38);
  const tag = (config.tag || "[ INSIGHT UTAMA ]").toUpperCase();
  const mv = config.motion_values || {};

  const variant = options.styleVariant !== undefined ? Math.abs(options.styleVariant) % 8 : 0;
  const variantDefaultAccents = [
    "#FF6B00", // 0: GLOWING_KINETIC_TYPOGRAPHY (Viral Orange Glow)
    "#06B6D4", // 1: CYBER_GLASS_TIMELINE (Electric Cyan)
    "#F59E0B", // 2: WARM_GOLD_METRIC_HUD (Luxury Gold)
    "#38BDF8", // 3: MINIMAL_APPLE_CARDS (Frosted Minimalist)
    "#E50914", // 4: CRIMSON_EDITORIAL_SPLIT (Netflix Crimson)
    "#8B5CF6", // 5: ELECTRIC_PURPLE_CREATOR (Vibrant Violet Creator)
    "#10B981", // 6: EMERALD_INVESTIGATIVE_MATRIX (Cyber Emerald Matrix)
    "#FACC15", // 7: BOLD_SWISS_BRUTALIST (High-contrast Solar Yellow)
  ];
  const accentColor = config.accent_color && /^#[0-9A-Fa-f]{6}$/.test(config.accent_color)
    ? config.accent_color
    : variantDefaultAccents[variant] || "#FF6B00";

  // 1. Clear Frame (100% transparent buffer)
  ctx.clearRect(0, 0, width, height);

  // 2. Themed Container (Polymorphic Style Archetype)
  const cardX = 40;
  const cardY = 15;
  const cardW = width - 80; // 1000px
  const cardH = height - 30; // 470px
  const cardR = 24;

  if (variant === 0) {
    // 0: GLOWING_KINETIC_TYPOGRAPHY - No rigid box, neon glow atmosphere
    ctx.save();
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 35;
    ctx.restore();
  } else if (variant === 1) {
    // 1: CYBER_GLASS_TIMELINE - Frosted cyan capsule + horizontal glow timeline
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
    ctx.fillStyle = "rgba(6, 18, 32, 0.78)";
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "#06B6D4";
    ctx.stroke();

    // Horizontal cyber glowing line
    ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cardX + 30, cardY + 70);
    ctx.lineTo(cardX + cardW - 30, cardY + 70);
    ctx.stroke();
    ctx.restore();
  } else if (variant === 2) {
    // 2: WARM_GOLD_METRIC_HUD - Sharp HUD with gold corner brackets
    ctx.save();
    ctx.beginPath();
    ctx.rect(cardX, cardY, cardW, cardH);
    ctx.fillStyle = "rgba(20, 16, 8, 0.85)";
    ctx.fill();
    const bLen = 22;
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cardX, cardY + bLen); ctx.lineTo(cardX, cardY); ctx.lineTo(cardX + bLen, cardY);
    ctx.moveTo(cardX + cardW - bLen, cardY); ctx.lineTo(cardX + cardW, cardY); ctx.lineTo(cardX + cardW, cardY + bLen);
    ctx.moveTo(cardX, cardY + cardH - bLen); ctx.lineTo(cardX, cardY + cardH); ctx.lineTo(cardX + bLen, cardY + cardH);
    ctx.moveTo(cardX + cardW - bLen, cardY + cardH); ctx.lineTo(cardX + cardW, cardY + cardH); ctx.lineTo(cardX + cardW, cardY + cardH - bLen);
    ctx.stroke();
    ctx.restore();
  } else if (variant === 3) {
    // 3: MINIMAL_APPLE_CARDS - Soft white floating card
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.stroke();
    ctx.restore();
  } else if (variant === 4) {
    // 4: CRIMSON_EDITORIAL_SPLIT - Netflix red block with left crimson band
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 12);
    ctx.fillStyle = "rgba(24, 6, 8, 0.88)";
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(229, 9, 20, 0.4)";
    ctx.stroke();
    ctx.fillStyle = "#E50914";
    ctx.fillRect(cardX, cardY, 8, cardH);
    ctx.restore();
  } else if (variant === 5) {
    // 5: ELECTRIC_PURPLE_CREATOR - Obsidian purple glass with vibrant neon violet glow
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
    ctx.fillStyle = "rgba(24, 10, 38, 0.86)";
    ctx.fill();
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = "#8B5CF6";
    ctx.shadowColor = "#8B5CF6";
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  } else if (variant === 6) {
    // 6: EMERALD_INVESTIGATIVE_MATRIX - Deep dark-slate with emerald cyber border
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 14);
    ctx.fillStyle = "rgba(6, 24, 18, 0.86)";
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "#10B981";
    ctx.stroke();
    ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cardX + 25, cardY + 70);
    ctx.lineTo(cardX + cardW - 25, cardY + 70);
    ctx.stroke();
    ctx.restore();
  } else {
    // 7: BOLD_SWISS_BRUTALIST - High-contrast sharp charcoal box with yellow accents
    ctx.save();
    ctx.beginPath();
    ctx.rect(cardX, cardY, cardW, cardH);
    ctx.fillStyle = "rgba(14, 14, 14, 0.92)";
    ctx.fill();
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = "#FACC15";
    ctx.stroke();
    ctx.fillStyle = "#FACC15";
    ctx.fillRect(cardX, cardY, cardW, 6);
    ctx.restore();
  }

  // 3. Category Tag Badge (Top Left)
  ctx.save();
  ctx.font = "800 13px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const tagMetrics = ctx.measureText(tag);
  const badgeW = tagMetrics.width + 24;
  const badgeH = 28;
  const badgeX = cardX + 32;
  const badgeY = cardY + 22;

  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
  ctx.fillStyle = chroma(accentColor).alpha(0.18).css();
  ctx.fill();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = chroma(accentColor).brighten(0.8).hex();
  ctx.fillText(tag, badgeX + 12, badgeY + 19);
  ctx.restore();

  // 4. Lucide Vector Icon (Beside Tag or Top Right)
  const iconImg = getLucideIconImage(mv.lucideIcon, accentColor);
  if (iconImg) {
    ctx.drawImage(iconImg, badgeX + badgeW + 16, badgeY - 2, 30, 30);
  }

  // 5. Animated Audio Radar Pulse Ring (Top Right)
  const radarCenterX = cardX + cardW - 70;
  const radarCenterY = cardY + 36;
  const pulsePhase = (frameIndex % 45) / 45;
  const pulseR = 6 + pulsePhase * 28;
  const pulseAlpha = Math.max(0, (1 - pulsePhase) * 0.7);

  ctx.save();
  ctx.beginPath();
  ctx.arc(radarCenterX, radarCenterY, 5, 0, Math.PI * 2);
  ctx.fillStyle = accentColor;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(radarCenterX, radarCenterY, pulseR, 0, Math.PI * 2);
  ctx.strokeStyle = chroma(accentColor).alpha(pulseAlpha).css();
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = "700 11px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.textAlign = "right";
  ctx.fillText("LIVE SYNC", radarCenterX - 35, radarCenterY + 4);
  ctx.restore();

  // 6. Punchy Headline Title (Centered Y=125)
  ctx.save();
  ctx.font = "900 38px sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
  ctx.shadowBlur = 12;
  ctx.fillText(headline, cardX + 32, cardY + 105);

  // Decorative Accent Line below headline
  const lineW = Math.min(cardW - 64, 400 + Math.sin(frameIndex * 0.1) * 30);
  const lineGrad = ctx.createLinearGradient(cardX + 32, 0, cardX + 32 + lineW, 0);
  lineGrad.addColorStop(0, accentColor);
  lineGrad.addColorStop(0.8, chroma(accentColor).alpha(0.2).css());
  lineGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = lineGrad;
  ctx.fillRect(cardX + 32, cardY + 120, lineW, 3);
  ctx.restore();

  // 7. Render Archetype-Specific Living Motion Elements
  if (archetype === "DYNAMIC_COUNTER") {
    // A. Rolling Number Counter via gsap power3.out
    const counterProgress = power3Out(Math.min(1, frameIndex / (totalFrames * 0.65)));
    const targetVal = mv.targetNumber || 100;
    const currentNum = Math.floor(targetVal * counterProgress);
    const unit = mv.unit || "%";
    const label = (mv.metricLabel || "KEY PERFORMANCE METRIC").toUpperCase();

    ctx.save();
    ctx.font = "900 68px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 18;
    const numText = `${currentNum.toLocaleString("id-ID")}${unit}`;
    ctx.fillText(numText, cardX + 35, cardY + 225);

    ctx.font = "700 16px sans-serif";
    ctx.fillStyle = chroma(accentColor).brighten(1).hex();
    ctx.shadowBlur = 0;
    ctx.fillText(`▲ ${label}`, cardX + 38, cardY + 265);
    ctx.restore();

    // B. Dynamic Graph Line creeping from left to right via d3-shape
    const graphW = 440;
    const graphH = 90;
    const graphX = cardX + 35;
    const graphY = cardY + 360;

    const numPoints = 14;
    const visiblePoints = Math.max(2, Math.floor(progress * numPoints));
    const points: [number, number][] = [];

    for (let pt = 0; pt <= visiblePoints; pt++) {
      const px = graphX + (pt / (numPoints - 1)) * graphW;
      const n = noise2D(pt * 0.35, frameIndex * 0.04);
      const py = graphY - (pt / numPoints) * graphH * 0.7 - (n + 1) * 14;
      points.push([px, py]);
    }

    const lineGen = line().curve(curveMonotoneX);
    const pathD = lineGen(points);
    if (pathD) {
      ctx.save();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 14;
      const p2d = new Path2D(pathD);
      ctx.stroke(p2d);
      ctx.restore();
    }
  } else if (archetype === "PROCESS_STEPPER") {
    // 3 Sequential Steps Lighting Up Dynamically
    const steps = mv.steps && mv.steps.length > 0 ? mv.steps : ["01 INPUT", "02 ANALISIS", "03 HASIL"];
    const stepperX = cardX + 40;
    const stepperY = cardY + 220;
    const stepperW = cardW - 80;

    // Background track
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(stepperX, stepperY + 12, stepperW, 4);

    // Active illuminated track following progress
    const activeTrackW = stepperW * progress;
    const trackGrad = ctx.createLinearGradient(stepperX, 0, stepperX + activeTrackW, 0);
    trackGrad.addColorStop(0, accentColor);
    trackGrad.addColorStop(1, chroma(accentColor).brighten(1.2).hex());
    ctx.fillStyle = trackGrad;
    ctx.fillRect(stepperX, stepperY + 12, activeTrackW, 4);

    // Step Nodes
    steps.forEach((step, idx) => {
      const nodeX = stepperX + (idx / (steps.length - 1)) * stepperW;
      const stepThreshold = idx / (steps.length - 1);
      const isReached = progress >= stepThreshold;

      ctx.beginPath();
      ctx.arc(nodeX, stepperY + 14, isReached ? 14 : 9, 0, Math.PI * 2);
      ctx.fillStyle = isReached ? accentColor : "#1E293B";
      ctx.fill();
      ctx.strokeStyle = isReached ? "#FFFFFF" : "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.font = isReached ? "800 18px sans-serif" : "600 15px sans-serif";
      ctx.fillStyle = isReached ? "#FFFFFF" : "#94A3B8";
      ctx.fillText(step.toUpperCase(), nodeX, stepperY + 65);
    });
    ctx.restore();
  } else if (archetype === "VERSUS_CARDS") {
    // Dual Versus Comparison Cards
    const leftTitle = mv.leftTitle || "CARA LAMA";
    const leftDesc = mv.leftDesc || "Manual & Boros";
    const rightTitle = mv.rightTitle || "AI PIPELINE";
    const rightDesc = mv.rightDesc || "10x Lebih Cepat";

    const vCardW = 420;
    const vCardH = 170;
    const vCardY = cardY + 160;

    // Left Card (Old Way - Muted Dark Red)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX + 35, vCardY, vCardW, vCardH, 14);
    ctx.fillStyle = "rgba(239, 68, 68, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(239, 68, 68, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "800 22px sans-serif";
    ctx.fillStyle = "#F87171";
    ctx.textAlign = "left";
    ctx.fillText(leftTitle.toUpperCase(), cardX + 60, vCardY + 55);

    ctx.font = "600 16px sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.fillText(leftDesc, cardX + 60, vCardY + 95);

    // Right Card (New AI Way - Glowing Neon Cyan/Teal)
    const rightCardX = cardX + cardW - vCardW - 35;
    ctx.beginPath();
    ctx.roundRect(rightCardX, vCardY, vCardW, vCardH, 14);
    ctx.fillStyle = chroma(accentColor).alpha(0.15).css();
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = "800 22px sans-serif";
    ctx.fillStyle = chroma(accentColor).brighten(0.8).hex();
    ctx.fillText(rightTitle.toUpperCase(), rightCardX + 25, vCardY + 55);

    ctx.font = "600 16px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(rightDesc, rightCardX + 25, vCardY + 95);

    // Pulsing VS Badge Center
    const vsX = cardX + cardW / 2;
    const vsY = vCardY + vCardH / 2;
    const vsPulse = 1 + Math.sin(frameIndex * 0.25) * 0.08;
    ctx.save();
    ctx.translate(vsX, vsY);
    ctx.scale(vsPulse, vsPulse);
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fillStyle = "#E50914";
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = "900 14px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VS", 0, 1);
    ctx.restore();

    ctx.restore();
  } else {
    // AUDIO_RADAR / EDITORIAL BANNER: Subheadline Context & Quote
    const quote = (config.hookQuote || config.keyTakeaway || "STRATEGI VIRAL TINGGI").slice(0, 65);
    ctx.save();
    ctx.font = "600 20px sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.textAlign = "left";
    ctx.fillText(`"${quote}"`, cardX + 35, cardY + 205);

    ctx.font = "700 14px sans-serif";
    ctx.fillStyle = chroma(accentColor).brighten(0.8).hex();
    ctx.fillText("▶ VERIFIED INSIGHT & HIGH ENGAGEMENT HOOK", cardX + 35, cardY + 250);
    ctx.restore();
  }

  // 8. Dynamic Audio Equalizer Bars (24 bars via simplex-noise & chroma-js)
  const barCount = 24;
  const totalBarW = 380;
  const barW = 8;
  const barGap = (totalBarW - barCount * barW) / (barCount - 1);
  const barStartX = cardX + cardW - totalBarW - 40;
  const barBaseY = cardY + cardH - 35;

  const colorPalette = chroma
    .scale([accentColor, chroma(accentColor).brighten(1.6).hex()])
    .colors(barCount);

  ctx.save();
  for (let i = 0; i < barCount; i++) {
    const n = noise2D(i * 0.22, frameIndex * 0.08);
    const wave = Math.sin(frameIndex * 0.18 + i * 0.45) * 10;
    const barH = Math.max(8, Math.min(75, ((n + 1) / 2) * 52 + wave + 12));

    ctx.fillStyle = colorPalette[i]!;
    ctx.beginPath();
    ctx.roundRect(barStartX + i * (barW + barGap), barBaseY - barH, barW, barH, 4);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * [FASE 3: PROCEDURAL MOTION ENGINE]
 * Renders the full 30 FPS motion header video via fast native @napi-rs/canvas
 * and pipes raw RGBA frames directly into FFmpeg (zero Chromium, zero Puppeteer).
 */
export async function renderFastCanvasMotionVideo(
  options: FastCanvasMotionOptions
): Promise<string> {
  const width = options.width || 1080;
  const height = options.height || 500;
  // Seamless 3.0-second loop (90 frames) - FFmpeg uses -stream_loop -1
  // This takes only ~1.5s to render instead of 200s, saving 99% CPU while keeping full 30 FPS motion!
  const durationSec = Math.min(Math.max(1, options.durationSec || 3), 3);
  const totalFrames = Math.round(durationSec * 30);
  const ffmpegExe = getFfmpegPath();

  const outDir = path.dirname(options.destinationPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const targetPath = options.destinationPath;
  const isWebm = targetPath.endsWith(".webm");

  console.log(
    `[FastCanvasMotion] Merender ${totalFrames} frame animasi 30 FPS (${durationSec}s loop) via Native Rust Canvas (${isWebm ? "WebM VP9 Alpha" : "MP4 H.264"})...`
  );
  const t0 = Date.now();

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // FFmpeg arguments depending on format with CPU thread guard
  const ffmpegArgs = isWebm
    ? [
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "-s",
        `${width}x${height}`,
        "-r",
        "30",
        "-i",
        "pipe:0",
        "-threads",
        "0",
        "-c:v",
        "libvpx-vp9",
        "-pix_fmt",
        "yuva420p",
        "-b:v",
        "0",
        "-crf",
        "28",
        "-deadline",
        "realtime",
        "-cpu-used",
        "8",
        "-r",
        "30",
        targetPath,
      ]
    : [
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "-s",
        `${width}x${height}`,
        "-r",
        "30",
        "-i",
        "pipe:0",
        "-threads",
        "0",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "fastdecode",
        "-crf",
        "25",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        targetPath,
      ];

  const ffmpegProc = spawn(ffmpegExe, ffmpegArgs, {
    stdio: ["pipe", "ignore", "inherit"],
  });

  const config = options.config;

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    drawMotionHeaderFrame(canvas, ctx, {
      width,
      height,
      frameIndex,
      totalFrames,
      config,
    });

    const imgData = ctx.getImageData(0, 0, width, height);
    const buf = Buffer.from(imgData.data.buffer);

    const canWrite = ffmpegProc.stdin.write(buf);
    if (!canWrite) {
      await new Promise((resolve) => ffmpegProc.stdin.once("drain", resolve));
    }
  }

  ffmpegProc.stdin.end();

  await new Promise<void>((resolve, reject) => {
    ffmpegProc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg canvas pipe failed with code ${code}`));
    });
    ffmpegProc.on("error", reject);
  });

  const elapsedMs = Date.now() - t0;
  const stat = fs.statSync(targetPath);
  console.log(
    `[FastCanvasMotion] Animasi selesai 100%: ${targetPath} (${(stat.size / 1024).toFixed(1)} KB) dalam ${elapsedMs}ms (${(
      totalFrames /
      (elapsedMs / 1000)
    ).toFixed(1)} FPS)!`
  );

  return targetPath;
}

// ----------------------------------------------------------------------------
// [FASE 3: TRUE ANIMATED MOTION HEADER TRACK GENERATOR (1080x480)]
// ----------------------------------------------------------------------------

let headerFontsLoaded = false;
function ensureHeaderFontsLoaded() {
  if (headerFontsLoaded) return;
  try {
    const fontsDir = getFontsDirPath();
    const fontFiles = [
      { file: "Montserrat-ExtraBold.ttf", family: "Montserrat" },
      { file: "Cinzel-Bold.ttf", family: "Cinzel" },
      { file: "PlusJakartaSans-ExtraBold.ttf", family: "Plus Jakarta Sans" },
      { file: "Poppins-Black.ttf", family: "Poppins" },
      { file: "Anton-Regular.ttf", family: "Anton" },
      { file: "BebasNeue-Regular.ttf", family: "Bebas Neue" },
    ];
    for (const f of fontFiles) {
      const p = path.join(fontsDir, f.file);
      if (fs.existsSync(p)) {
        try {
          GlobalFonts.registerFromPath(p, f.family);
        } catch {}
      }
    }
    headerFontsLoaded = true;
  } catch (err: any) {
    console.warn("[FastCanvasMotion] Font load notice:", err?.message);
  }
}

export interface AnimatedHeaderTrackOptions {
  destinationPath: string;
  totalDurationSec: number;
  teaserDurationSec?: number;
  hookCategory?: string;
  hookHeadline?: string;
  hookSubtext?: string;
  accentColor?: string;
  explanationBeats?: ExplanationBeat[];
  topBannerSteps?: string;
  fps?: number;
  styleVariant?: number;
  clipIndex?: number;
}

export type MotionStyleArchetype =
  | "GLOWING_KINETIC_TYPOGRAPHY" // 0: @renxclip viral style (no rigid box, neon glow)
  | "CYBER_GLASS_TIMELINE"        // 1: Cyan futuristic glass timeline
  | "WARM_GOLD_METRIC_HUD"        // 2: Elegant amber HUD with [ ] brackets
  | "MINIMAL_APPLE_CARDS"         // 3: Soft floating cards with clean badges
  | "CRIMSON_EDITORIAL_SPLIT"     // 4: Netflix red editorial with angled cuts
  | "ELECTRIC_PURPLE_CREATOR"     // 5: Obsidian purple glass with vibrant neon violet glow
  | "EMERALD_INVESTIGATIVE_MATRIX"// 6: Deep slate with emerald matrix pulse & radar
  | "BOLD_SWISS_BRUTALIST";       // 7: High-contrast yellow/black Swiss editorial

export function getStyleArchetypeName(variant: number): MotionStyleArchetype {
  const archetypes: MotionStyleArchetype[] = [
    "GLOWING_KINETIC_TYPOGRAPHY",
    "CYBER_GLASS_TIMELINE",
    "WARM_GOLD_METRIC_HUD",
    "MINIMAL_APPLE_CARDS",
    "CRIMSON_EDITORIAL_SPLIT",
    "ELECTRIC_PURPLE_CREATOR",
    "EMERALD_INVESTIGATIVE_MATRIX",
    "BOLD_SWISS_BRUTALIST",
  ];
  return archetypes[Math.abs(variant) % archetypes.length]!;
}

export function drawThemedCardBox(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  variant: number,
  themeAccent: string,
  isActive: boolean
) {
  ctx.save();
  if (variant === 0) {
    // 0: GLOWING_KINETIC_TYPOGRAPHY - Minimal borderless with neon glow
    if (isActive) {
      ctx.shadowColor = themeAccent;
      ctx.shadowBlur = 24;
      ctx.fillStyle = "rgba(20, 12, 6, 0.55)";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      ctx.strokeStyle = themeAccent;
      ctx.lineWidth = 2.0;
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(10, 10, 10, 0.40)";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    }
  } else if (variant === 1) {
    // 1: CYBER_GLASS_TIMELINE - Frosted cyan glass with glowing borders
    ctx.fillStyle = isActive ? "rgba(6, 25, 45, 0.82)" : "rgba(8, 16, 28, 0.72)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.strokeStyle = isActive ? "#06B6D4" : "rgba(6, 182, 212, 0.35)";
    ctx.lineWidth = isActive ? 2.0 : 1.2;
    ctx.stroke();
  } else if (variant === 2) {
    // 2: WARM_GOLD_METRIC_HUD - Sharp rectangular HUD with corner brackets
    ctx.fillStyle = isActive ? "rgba(28, 20, 8, 0.88)" : "rgba(18, 14, 6, 0.78)";
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    const bLen = Math.min(14, h / 3);
    ctx.strokeStyle = isActive ? "#F59E0B" : "rgba(245, 158, 11, 0.4)";
    ctx.lineWidth = isActive ? 2.2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y + bLen); ctx.lineTo(x, y); ctx.lineTo(x + bLen, y);
    ctx.moveTo(x + w - bLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + bLen);
    ctx.moveTo(x, y + h - bLen); ctx.lineTo(x, y + h); ctx.lineTo(x + bLen, y + h);
    ctx.moveTo(x + w - bLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - bLen);
    ctx.stroke();
  } else if (variant === 3) {
    // 3: MINIMAL_APPLE_CARDS - Soft white floating card
    ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.max(r, 20));
    ctx.fill();
    ctx.strokeStyle = isActive ? "rgba(255, 255, 255, 0.45)" : "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (variant === 4) {
    // 4: CRIMSON_EDITORIAL_SPLIT - Dark red/editorial block with left accent bar
    const boxAccent = themeAccent || "#E50914";
    ctx.fillStyle = isActive ? "rgba(35, 8, 12, 0.88)" : "rgba(20, 6, 8, 0.78)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = isActive ? boxAccent : chroma(boxAccent).alpha(0.35).css();
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = isActive ? boxAccent : chroma(boxAccent).alpha(0.5).css();
    ctx.fillRect(x, y, 5, h);
  } else if (variant === 5) {
    // 5: ELECTRIC_PURPLE_CREATOR - Obsidian purple glass with vibrant neon violet glow
    const pAccent = themeAccent || "#8B5CF6";
    ctx.fillStyle = isActive ? "rgba(26, 12, 42, 0.88)" : "rgba(16, 8, 28, 0.76)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    ctx.fill();
    if (isActive) {
      ctx.shadowColor = pAccent;
      ctx.shadowBlur = 20;
    }
    ctx.strokeStyle = isActive ? pAccent : "rgba(139, 92, 246, 0.35)";
    ctx.lineWidth = isActive ? 2.0 : 1.2;
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else if (variant === 6) {
    // 6: EMERALD_INVESTIGATIVE_MATRIX - Deep slate with emerald glowing borders and cyber tick marks
    const emAccent = themeAccent || "#10B981";
    ctx.fillStyle = isActive ? "rgba(6, 26, 20, 0.88)" : "rgba(4, 18, 14, 0.76)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = isActive ? emAccent : "rgba(16, 185, 129, 0.35)";
    ctx.lineWidth = isActive ? 2.0 : 1.2;
    ctx.stroke();
    ctx.fillStyle = isActive ? emAccent : "rgba(16, 185, 129, 0.5)";
    ctx.fillRect(x + w - 16, y + 6, 10, 3);
  } else {
    // 7: BOLD_SWISS_BRUTALIST - High-contrast solid charcoal card with thick brutalist border
    const brutAccent = themeAccent || "#FACC15";
    ctx.fillStyle = isActive ? "rgba(18, 18, 18, 0.94)" : "rgba(10, 10, 10, 0.85)";
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.strokeStyle = isActive ? brutAccent : "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = isActive ? 2.6 : 1.5;
    ctx.stroke();
    if (isActive) {
      ctx.fillStyle = brutAccent;
      ctx.fillRect(x, y, 16, 4);
      ctx.fillRect(x, y, 4, 16);
    }
  }
  ctx.restore();
}

export function wrapText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number
): string[] {
  const clean = cleanAscii(text);
  if (!clean) return [];
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = words[0]!;

  for (let i = 1; i < words.length; i++) {
    const word = words[i]!;
    const testLine = `${currentLine} ${word}`;
    const metrics = ctx.measureText(testLine);
    if (metrics.width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

function splitHeadlineWords(text: string, maxCharsPerLine = 22): string[] {
  const clean = cleanAscii(text);
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= 3 && clean.length <= maxCharsPerLine) return [clean];
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(" ");
  const line2 = words.slice(mid).join(" ");
  return line2 ? [line1, line2] : [line1];
}

/**
 * [FASE 1: AUTO-FIT DYNAMIC TEXT RENDERER]
 * Otomatis memperkecil ukuran font secara adaptif agar teks pas sempurna di dalam kapsul / container
 * tanpa terpotong (zero clipping) dan tanpa merusak kata (zero typo).
 */
export function drawFittedText(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  initialFontSize: number,
  minFontSize: number,
  fontFamily: string,
  fontWeight: string = "bold"
): number {
  let size = initialFontSize;
  ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
  let metrics = ctx.measureText(text);
  while (metrics.width > maxW && size > minFontSize) {
    size -= 1;
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
    metrics = ctx.measureText(text);
  }
  ctx.fillText(text, x, y);
  return size;
}

/**
 * [FASE 3: FRAMELESS CINEMATIC MOTION ENGINE]
 * Renders a full animated header video stream (1080x480 at 24 FPS with transparent alpha).
 * - Tanpa bingkai kotak hitam raksasa (Frameless floating motion)
 * - Tanpa teks kaku "1% PROGRESS" s/d "100% PROGRESS"
 * - Tanpa garis progress bar panjang di bawah
 * - Tanpa typewriter pemotong kata (Smooth Line Slide-Up + Opacity Fade menggunakan Bezier(0.16, 1, 0.3, 1))
 * - 4 Archetype Visual Dinamis: BIG_METRIC_BAR, FLOW_NODES, SPLIT_VERSUS, QUOTE_IMPACT
 */
export async function generateAnimatedHeaderTrack(
  options: AnimatedHeaderTrackOptions
): Promise<string> {
  const t0 = Date.now();
  ensureHeaderFontsLoaded();

  const width = 1080;
  const height = 580;
  const fps = options.fps || 24;
  const totalDurationSec = Math.max(5, options.totalDurationSec);
  const totalFrames = Math.max(1, Math.round(totalDurationSec * fps));
  const tHook = options.teaserDurationSec && options.teaserDurationSec > 0 ? options.teaserDurationSec : 4.0;
  const mainDur = Math.max(1, totalDurationSec - tHook);
  const beatDur = mainDur / 3;

  const tB1Start = tHook;
  const tB1End = tHook + beatDur;
  const tB2Start = tB1End;
  const tB2End = tHook + 2 * beatDur;
  const tB3Start = tB2End;
  const tB3End = totalDurationSec;

  const variant = options.styleVariant !== undefined
    ? Math.abs(options.styleVariant) % 8
    : options.clipIndex !== undefined
    ? Math.abs(options.clipIndex) % 8
    : 0;

  const variantDefaultAccents = [
    "#FF6B00", // 0: GLOWING_KINETIC_TYPOGRAPHY
    "#06B6D4", // 1: CYBER_GLASS_TIMELINE
    "#F59E0B", // 2: WARM_GOLD_METRIC_HUD
    "#38BDF8", // 3: MINIMAL_APPLE_CARDS
    "#E50914", // 4: CRIMSON_EDITORIAL_SPLIT
    "#8B5CF6", // 5: ELECTRIC_PURPLE_CREATOR
    "#10B981", // 6: EMERALD_INVESTIGATIVE_MATRIX
    "#FACC15", // 7: BOLD_SWISS_BRUTALIST
  ];

  const defaultAccent = variantDefaultAccents[variant] || "#FF6B00";
  const accentColor = options.accentColor && /^#[0-9A-Fa-f]{6}$/.test(options.accentColor)
    ? options.accentColor
    : defaultAccent;

  // Target path: ensure .mov extension for lossless QuickTime RLE with alpha channel
  const targetPath = options.destinationPath.replace(/\.mp4$/i, ".mov");
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const ffmpegExe = getFfmpegPath();

  const ffmpegProc = spawn(
    ffmpegExe,
    [
      "-y",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-s",
      `${width}x${height}`,
      "-r",
      String(fps),
      "-i",
      "pipe:0",
      "-threads",
      "0",
      "-c:v",
      "qtrle",
      targetPath,
    ],
    { stdio: ["pipe", "ignore", "inherit"] }
  );

  const beats = options.explanationBeats && options.explanationBeats.length >= 3
    ? options.explanationBeats
    : [];

  const hookCat = (cleanAscii(options.hookCategory) || "SOROTAN UTAMA // KLIMAKS").toUpperCase();
  const rawHeadline = cleanAscii(options.hookHeadline);
  const hookHead = (rawHeadline && rawHeadline.length >= 4 ? rawHeadline : "SOROTAN UTAMA TOPIK").toUpperCase();
  const hookSub = (cleanAscii(options.hookSubtext) || "").toUpperCase();

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const t = frameIndex / fps;

    // Clear frame to 100% transparent
    ctx.clearRect(0, 0, width, height);

    if (t < tHook) {
      // =============================================================
      // HOOK SCENE (0.0s s/d tHook) - SAFE-ZONE Y = 120 s/d 560
      // =============================================================
      const localTime = t;
      const easeEnter = easeOutExpo(Math.min(1, localTime / 0.45));
      const titleOffsetY = (1 - easeEnter) * 25; // 25px -> 0px

      const timeLeft = Math.max(0, tHook - t);
      let exitAlpha = 1.0;
      let exitOffsetY = 0;
      if (timeLeft < 0.35) {
        const exitP = 1 - timeLeft / 0.35;
        exitAlpha = Math.max(0, 1 - easeOutExpo(exitP));
        exitOffsetY = -25 * easeOutExpo(exitP);
      }
      const sceneAlpha = Math.min(easeEnter, exitAlpha);

      // Pulsing live indicator dot (green)
      const pulse = Math.abs(Math.sin(frameIndex * 0.15));
      const dotAlpha = 0.4 + 0.6 * pulse;
      const dotRadius = 5 + 1.5 * pulse;

      ctx.save();
      ctx.translate(0, exitOffsetY);
      ctx.globalAlpha = sceneAlpha;

      // 1. Kicker Pill (Center X=540, Y=120)
      ctx.save();
      ctx.translate(0, titleOffsetY);
      ctx.font = "bold 15px Montserrat, Arial, sans-serif";
      const badgeMetrics = ctx.measureText(hookCat);
      const badgeW = Math.max(220, badgeMetrics.width + 56);
      const badgeX = 540 - badgeW / 2;

      if (variant === 0) {
        // 0: GLOWING_KINETIC_TYPOGRAPHY - No rigid pill, glowing neon text
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = 24;
        ctx.fillStyle = accentColor;
        ctx.textAlign = "center";
        ctx.fillText(hookCat, 540, 142);
      } else if (variant === 2) {
        // 2: WARM_GOLD_METRIC_HUD - Sharp HUD brackets
        ctx.fillStyle = "#F59E0B";
        ctx.textAlign = "center";
        ctx.fillText(`[ ${hookCat} ]`, 540, 142);
      } else if (variant === 5) {
        // 5: ELECTRIC_PURPLE_CREATOR - Glowing violet pill with neon halo
        ctx.save();
        ctx.fillStyle = "rgba(139, 92, 246, 0.25)";
        ctx.beginPath();
        ctx.roundRect(badgeX, 120, badgeW, 36, 18);
        ctx.fill();
        ctx.strokeStyle = "#8B5CF6";
        ctx.lineWidth = 1.8;
        ctx.shadowColor = "#8B5CF6";
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.fillStyle = "#E9D5FF";
        ctx.textAlign = "center";
        ctx.fillText(hookCat, 540, 144);
        ctx.restore();
      } else if (variant === 6) {
        // 6: EMERALD_INVESTIGATIVE_MATRIX - Matrix radar pill
        ctx.fillStyle = "rgba(6, 26, 20, 0.9)";
        ctx.beginPath();
        ctx.roundRect(badgeX, 120, badgeW, 36, 10);
        ctx.fill();
        ctx.strokeStyle = "#10B981";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "#10B981";
        ctx.beginPath();
        ctx.arc(badgeX + 22, 138, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#A7F3D0";
        ctx.textAlign = "left";
        ctx.fillText(hookCat, badgeX + 38, 144);
      } else if (variant === 7) {
        // 7: BOLD_SWISS_BRUTALIST - High contrast solid yellow pill
        ctx.fillStyle = "#FACC15";
        ctx.beginPath();
        ctx.rect(badgeX, 120, badgeW, 36);
        ctx.fill();
        ctx.fillStyle = "#000000";
        ctx.font = "900 15px Montserrat, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(hookCat, 540, 144);
      } else {
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.roundRect(badgeX, 120, badgeW, 36, 18);
        ctx.fill();

        // Pulsing live dot
        ctx.fillStyle = `rgba(34, 197, 94, ${dotAlpha})`;
        ctx.beginPath();
        ctx.arc(badgeX + 22, 138, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "left";
        ctx.fillText(hookCat, badgeX + 38, 144);
      }
      ctx.restore();

      // 2. Huge Clean Hook Headline (Y=195 s/d 245)
      ctx.save();
      ctx.translate(0, titleOffsetY);
      if (variant === 0) {
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = 35;
      }
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 38px Cinzel, Arial, sans-serif";
      ctx.textAlign = "center";
      const hookLines = wrapText(ctx, hookHead, 920).slice(0, 2);
      if (hookLines.length === 1) {
        ctx.fillText(hookLines[0] || "", 540, 215);
      } else {
        ctx.fillText(hookLines[0] || "", 540, 195);
        ctx.fillText(hookLines[1] || "", 540, 245);
      }
      ctx.restore();

      // 3. Sub-caption Floating Glass Capsule (Y=290 s/d 342)
      if (hookSub && hookSub.length > 2) {
        const subP = easeOutExpo(Math.min(1, Math.max(0, (localTime - 0.25) / 0.4)));
        ctx.save();
        ctx.globalAlpha = sceneAlpha * subP;
        ctx.font = "bold 20px Montserrat, Arial, sans-serif";
        const subMetrics = ctx.measureText(hookSub);
        const subW = Math.min(940, Math.max(260, subMetrics.width + 48));
        const subX = 540 - subW / 2;

        if (variant === 0) {
          ctx.shadowColor = accentColor;
          ctx.shadowBlur = 18;
          ctx.fillStyle = "#FFEDD5";
          ctx.textAlign = "center";
          ctx.fillText(hookSub, 540, 323);
        } else {
          drawThemedCardBox(ctx, subX, 290, subW, 52, 26, variant, accentColor, true);
          ctx.fillStyle = "#CBD5E1";
          ctx.textAlign = "center";
          ctx.fillText(hookSub, 540, 323);
        }
        ctx.restore();
      }

      ctx.restore();
    } else {
      // =============================================================
      // EXPLANATION BEATS (t >= tHook) - SAFE-ZONE Y = 120 s/d 560
      // =============================================================
      let activeBeat: ExplanationBeat = beats[0]!;
      let sceneIndex = 0;
      let cardStart = tB1Start;
      let cardEnd = tB1End;

      if (t >= tB3Start && beats[2]) {
        activeBeat = beats[2];
        sceneIndex = 2;
        cardStart = tB3Start;
        cardEnd = tB3End;
      } else if (t >= tB2Start && beats[1]) {
        activeBeat = beats[1];
        sceneIndex = 1;
        cardStart = tB2Start;
        cardEnd = tB2End;
      } else {
        activeBeat = beats[0] || {
          beat_index: 1,
          start_sec: tB1Start,
          end_sec: tB1End,
          scene_type: "QUOTE_IMPACT",
          kicker_tag: "POIN 01 // SUBSTANSI",
          title: "SOROTAN UTAMA TOPIK",
          headline: "SOROTAN UTAMA TOPIK",
          highlight_metric: "SUBSTANSI TOPIK",
          progress_percent: 33,
          icon: "ShieldAlert",
          accent_hex: accentColor,
          step_badge: "POIN 01 // SUBSTANSI",
        };
        sceneIndex = 0;
        cardStart = tB1Start;
        cardEnd = tB1End;
      }

      const localTime = Math.max(0, t - cardStart);
      const cardDur = Math.max(0.5, cardEnd - cardStart);
      const localProgress = Math.min(1, localTime / cardDur);

      const easeFn = resolveEasing(activeBeat.motion_curve);
      const easeEnter = easeFn(Math.min(1, localTime / 0.45));
      const enterOffsetY = (1 - easeEnter) * 25; // 25px -> 0px

      const isLastScene = sceneIndex === 2;
      const exitThreshold = isLastScene ? 0.25 : 0.35;
      const timeLeft = Math.max(0, cardEnd - t);
      let exitAlpha = 1.0;
      let exitOffsetY = 0;
      if (timeLeft < exitThreshold) {
        const exitP = 1 - timeLeft / exitThreshold;
        exitAlpha = Math.max(0, 1 - easeFn(exitP));
        exitOffsetY = -25 * easeFn(exitP);
      }
      const sceneAlpha = Math.min(easeEnter, exitAlpha);

      const sceneType: VisualSceneType =
        activeBeat.scene_type ||
        (activeBeat.layout_type as VisualSceneType) ||
        (sceneIndex === 0 ? "FLOW_NODES" : sceneIndex === 1 ? "BIG_METRIC_BAR" : "KEY_TAKEAWAYS_LIST");
      const kicker = truncateAtWordBoundary(cleanAscii(activeBeat.kicker_tag || activeBeat.step_badge || activeBeat.step_label || `POIN 0${sceneIndex + 1}`).toUpperCase(), 24);
      const headline = truncateAtWordBoundary(cleanAscii(activeBeat.headline || activeBeat.title || "SOROTAN UTAMA TOPIK").toUpperCase(), 28);
      const payload: VisualSceneDataPayload = activeBeat.data_payload || {};

      const baseBeatAccent = activeBeat.accent_hex && /^#[0-9A-Fa-f]{6}$/.test(activeBeat.accent_hex)
        ? activeBeat.accent_hex
        : (sceneIndex === 0 ? accentColor : sceneIndex === 1 ? "#F59E0B" : "#20B2AA");

      const beatAccent = activeBeat.accent_tint && /^#[0-9A-Fa-f]{6}$/.test(activeBeat.accent_tint)
        ? interpolateRgb(baseBeatAccent, activeBeat.accent_tint)(0.75)
        : baseBeatAccent;

      ctx.save();
      ctx.translate(0, exitOffsetY);
      ctx.globalAlpha = sceneAlpha;

      if (sceneType === "BIG_METRIC_BAR") {
        // ============================================================
        // TIPE 1: BIG_METRIC_BAR (Angka Raksasa + 2 Bar Chart di Luar)
        // ============================================================
        ctx.save();
        ctx.translate(0, enterOffsetY);
        ctx.font = "bold 15px Montserrat, Arial, sans-serif";
        const kW = Math.max(200, ctx.measureText(kicker).width + 56);
        ctx.fillStyle = "rgba(245, 158, 11, 0.22)";
        ctx.beginPath();
        ctx.roundRect(540 - kW / 2, 120, kW, 32, 16);
        ctx.fill();
        ctx.strokeStyle = "#F59E0B";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        const metricIcon = getLucideIconImage(activeBeat.lucide_icon || "Coins", "#FACC15");
        if (metricIcon) {
          ctx.drawImage(metricIcon, 540 - kW / 2 + 10, 126, 20, 20);
        }

        ctx.fillStyle = "#FACC15";
        ctx.textAlign = "center";
        ctx.fillText(kicker, metricIcon ? 540 + 10 : 540, 141);
        ctx.restore();

        // Giant Rolling Counter (Y = 215)
        const targetVal = payload.metric_value || 260;
        const rollP = easeOutExpo(Math.min(1, Math.max(0, localTime / 0.9)));
        const currentVal = Math.round(targetVal * rollP);
        const prefix = payload.metric_prefix || (payload.metric_display?.startsWith("Rp") ? "Rp " : "");
        const suffix = payload.metric_suffix || (payload.metric_display?.includes("MILIAR") ? " MILIAR" : "");
        const bigNumberText = `${prefix}${currentVal}${suffix}`;

        ctx.save();
        ctx.translate(0, enterOffsetY);
        ctx.fillStyle = "#FACC15";
        ctx.font = "900 64px Montserrat, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(bigNumberText, 540, 215);
        ctx.restore();

        // Headline subtitle (Y = 258)
        ctx.save();
        ctx.translate(0, enterOffsetY);
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        drawFittedText(ctx, headline, 540, 258, 860, 24, 16, "Cinzel, Montserrat, sans-serif", "bold");
        ctx.restore();

        const maxBarW = 860;
        const bar1P = easeOutExpo(Math.min(1, Math.max(0, (localTime - 0.2) / 0.8)));
        const bar1Label = truncateAtWordBoundary(cleanAscii(payload.bar_1_label || "TOTAL ALOKASI PUSAT").toUpperCase(), 28);
        const bar1Val = typeof payload.bar_1_value === "number" ? payload.bar_1_value : 100;
        const bar1W = maxBarW * (Math.min(100, Math.max(5, bar1Val)) / 100) * bar1P;

        // Label Bar 1 (Y = 300)
        ctx.save();
        ctx.fillStyle = "#CBD5E1";
        ctx.textAlign = "left";
        drawFittedText(ctx, bar1Label, 110, 300, 600, 15, 11, "Montserrat, Arial, sans-serif", "bold");
        ctx.textAlign = "right";
        ctx.fillStyle = "#FACC15";
        ctx.fillText(`${prefix}${targetVal}${suffix}`, 970, 300);
        ctx.restore();

        // Bar Track 1 (Y = 312 - 328, height 16px)
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.beginPath();
        ctx.roundRect(110, 312, maxBarW, 16, 8);
        ctx.fill();

        if (bar1W > 6) {
          ctx.fillStyle = "#F59E0B";
          ctx.beginPath();
          ctx.roundRect(110, 312, bar1W, 16, 8);
          ctx.fill();
        }
        ctx.restore();

        // Bar 2
        const bar2P = easeOutExpo(Math.min(1, Math.max(0, (localTime - 0.35) / 0.8)));
        const bar2Label = truncateAtWordBoundary(cleanAscii(
          payload.bar_2_label || payload.metric_comparison_label || "DISTRIBUSI DAERAH"
        ).toUpperCase(), 28);
        const bar2Val = typeof payload.bar_2_value === "number" ? payload.bar_2_value : 40;
        const bar2W = maxBarW * (Math.min(100, Math.max(5, bar2Val)) / 100) * bar2P;

        // Label Bar 2 (Y = 348)
        ctx.save();
        ctx.fillStyle = "#CBD5E1";
        ctx.textAlign = "left";
        drawFittedText(ctx, bar2Label, 110, 348, 600, 15, 11, "Montserrat, Arial, sans-serif", "bold");
        ctx.textAlign = "right";
        ctx.fillStyle = "#20B2AA";
        ctx.fillText(`${bar2Val}%`, 970, 348);
        ctx.restore();

        // Bar Track 2 (Y = 360 - 376, height 16px)
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.beginPath();
        ctx.roundRect(110, 360, maxBarW, 16, 8);
        ctx.fill();

        if (bar2W > 6) {
          ctx.fillStyle = "#20B2AA";
          ctx.beginPath();
          ctx.roundRect(110, 360, bar2W, 16, 8);
          ctx.fill();
        }
        ctx.restore();

      } else if (sceneType === "FLOW_NODES") {
        // ============================================================
        // TIPE 2: FLOW_NODES (3 Kapsul 260x68px, Jarak 24px, Margin 126px)
        // ============================================================
        ctx.save();
        ctx.translate(0, enterOffsetY);
        ctx.font = "bold 15px Montserrat, Arial, sans-serif";
        const kW = Math.max(200, ctx.measureText(kicker).width + 56);
        ctx.fillStyle = "rgba(32, 178, 170, 0.22)";
        ctx.beginPath();
        ctx.roundRect(540 - kW / 2, 120, kW, 32, 16);
        ctx.fill();
        ctx.strokeStyle = "#20B2AA";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        const flowIcon = getLucideIconImage(activeBeat.lucide_icon || "Workflow", "#20B2AA");
        if (flowIcon) {
          ctx.drawImage(flowIcon, 540 - kW / 2 + 10, 126, 20, 20);
        }

        ctx.fillStyle = "#20B2AA";
        ctx.textAlign = "center";
        ctx.fillText(kicker, flowIcon ? 540 + 10 : 540, 141);
        ctx.restore();

        ctx.save();
        ctx.translate(0, enterOffsetY);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 32px Cinzel, Arial, sans-serif";
        ctx.textAlign = "center";
        const fLines = wrapText(ctx, headline, 880).slice(0, 2);
        if (fLines.length === 1) {
          ctx.fillText(fLines[0] || headline, 540, 190);
        } else {
          ctx.fillText(fLines[0] || "", 540, 180);
          ctx.fillText(fLines[1] || "", 540, 220);
        }
        ctx.restore();

        const rawNodes = payload.nodes && payload.nodes.length >= 3
          ? payload.nodes
          : ["PEMERINTAH PUSAT", "KEMENTERIAN", "PEMDA DAERAH"];
        const nodes = rawNodes.map((n) => truncateAtWordBoundary(cleanAscii(n).toUpperCase(), 18));

        const activeNodeIdx = localProgress < 0.33 ? 0 : localProgress < 0.66 ? 1 : 2;
        // 3 Kapsul Lebar 260px, Jarak 24px -> Total 828px, Margin Kiri/Kanan = (1080 - 828) / 2 = 126px
        const nodePositions = [
          { x: 126, startDelay: 0.2 },
          { x: 410, startDelay: 0.45 },
          { x: 694, startDelay: 0.7 },
        ];

        // Animated Connecting Lines & Flowing Dot (Y = 309)
        const yMid = 309;
        for (let i = 0; i < 2; i++) {
          const x1 = nodePositions[i]!.x + 260;
          const x2 = nodePositions[i + 1]!.x;

          ctx.save();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x1, yMid);
          ctx.lineTo(x2, yMid);
          ctx.stroke();

          const flowT = (localTime * 2.0 + (i * 0.5)) % 1.0;
          const dotX = x1 + (x2 - x1) * flowT;
          ctx.fillStyle = "#20B2AA";
          ctx.beginPath();
          ctx.arc(dotX, yMid, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        for (let i = 0; i < 3; i++) {
          const np = nodePositions[i]!;
          const nodeP = easeOutExpo(Math.min(1, Math.max(0, (localTime - np.startDelay) / 0.4)));
          if (nodeP <= 0) continue;

          const isActive = activeNodeIdx === i;
          const scale = isActive ? 1.06 : 1.0;

          ctx.save();
          ctx.globalAlpha = sceneAlpha * nodeP;
          ctx.translate(np.x + 130, yMid);
          ctx.scale(scale, scale);
          ctx.translate(-(np.x + 130), -yMid);

          if (isActive) {
            drawThemedCardBox(ctx, np.x, 275, 260, 68, 18, variant, beatAccent, true);
            ctx.fillStyle = "#FFFFFF";
            ctx.textAlign = "center";
            drawFittedText(ctx, nodes[i] || `PIHAK 0${i + 1}`, np.x + 130, 318, 230, 18, 12, "Montserrat, Arial, sans-serif", "bold");
          } else {
            drawThemedCardBox(ctx, np.x, 275, 260, 68, 18, variant, "rgba(255, 255, 255, 0.22)", false);
            ctx.fillStyle = "#94A3B8";
            ctx.textAlign = "center";
            drawFittedText(ctx, nodes[i] || `PIHAK 0${i + 1}`, np.x + 130, 318, 230, 16, 11, "Montserrat, Arial, sans-serif", "bold");
          }
          ctx.restore();
        }

      } else if (sceneType === "KEY_TAKEAWAYS_LIST") {
        // ============================================================
        // TIPE 3: KEY_TAKEAWAYS_LIST (Staggered Slide-In Cards)
        // ============================================================
        ctx.save();
        ctx.translate(0, enterOffsetY);
        ctx.font = "bold 15px Montserrat, Arial, sans-serif";
        const kW = Math.max(200, ctx.measureText(kicker).width + 56);
        ctx.fillStyle = "rgba(32, 178, 170, 0.22)";
        ctx.beginPath();
        ctx.roundRect(540 - kW / 2, 120, kW, 32, 16);
        ctx.fill();
        ctx.strokeStyle = "#20B2AA";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        const takeIcon = getLucideIconImage(activeBeat.lucide_icon || "CheckCircle2", "#20B2AA");
        if (takeIcon) {
          ctx.drawImage(takeIcon, 540 - kW / 2 + 10, 126, 20, 20);
        }

        ctx.fillStyle = "#20B2AA";
        ctx.textAlign = "center";
        ctx.fillText(kicker, takeIcon ? 540 + 10 : 540, 141);
        ctx.restore();

        // Headline at Y = 185
        ctx.save();
        ctx.translate(0, enterOffsetY);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 30px Cinzel, Arial, sans-serif";
        ctx.textAlign = "center";
        const kLines = wrapText(ctx, headline, 880).slice(0, 1);
        ctx.fillText(kLines[0] || headline, 540, 185);
        ctx.restore();

        const rawBullets = Array.isArray(payload.bullet_points) && payload.bullet_points.length > 0
          ? payload.bullet_points
          : [
              "Analisis substantif terhadap isu utama",
              "Transparansi dan akuntabilitas data publik",
            ];

        const bullet1 = cleanAscii(rawBullets[0] || "ANALISIS MENDALAM TERHADAP ISU UTAMA");
        const bullet2 = cleanAscii(rawBullets[1] || "SINKRONISASI DATA DAN TATA KELOLA ANGGARAN");

        // Card 1 at Y = 230
        const card1P = easeOutExpo(Math.min(1, Math.max(0, (localTime - 0.15) / 0.45)));
        const card1OffY = (1 - card1P) * 20;

        ctx.save();
        ctx.globalAlpha = sceneAlpha * card1P;
        ctx.translate(0, card1OffY);

        drawThemedCardBox(ctx, 110, 230, 860, 68, 16, variant, beatAccent, true);

        // Number badge 01
        ctx.fillStyle = beatAccent;
        ctx.beginPath();
        ctx.roundRect(132, 246, 38, 36, 10);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 16px Montserrat, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("01", 151, 270);

        // Bullet text 1
        ctx.fillStyle = "#F8FAFC";
        ctx.textAlign = "left";
        drawFittedText(ctx, bullet1, 190, 272, 740, 19, 13, "Montserrat, Arial, sans-serif", "bold");
        ctx.restore();

        // Card 2 at Y = 320
        const card2P = easeOutExpo(Math.min(1, Math.max(0, (localTime - 0.32) / 0.45)));
        const card2OffY = (1 - card2P) * 20;

        ctx.save();
        ctx.globalAlpha = sceneAlpha * card2P;
        ctx.translate(0, card2OffY);

        drawThemedCardBox(ctx, 110, 320, 860, 68, 16, variant, "#20B2AA", false);

        // Number badge 02
        ctx.fillStyle = "#20B2AA";
        ctx.beginPath();
        ctx.roundRect(132, 336, 38, 36, 10);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 16px Montserrat, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("02", 151, 360);

        // Bullet text 2
        ctx.fillStyle = "#F8FAFC";
        ctx.textAlign = "left";
        drawFittedText(ctx, bullet2, 190, 362, 740, 19, 13, "Montserrat, Arial, sans-serif", "bold");
        ctx.restore();

      } else if (sceneType === "SPLIT_VERSUS") {
        // ============================================================
        // TIPE 4: SPLIT_VERSUS (2 Kartu Meluncur Berlawanan + VS Glow)
        // ============================================================
        ctx.save();
        ctx.translate(0, enterOffsetY);
        ctx.font = "bold 15px Montserrat, Arial, sans-serif";
        const kW = Math.max(200, ctx.measureText(kicker).width + 56);
        ctx.fillStyle = "rgba(239, 68, 68, 0.22)";
        ctx.beginPath();
        ctx.roundRect(540 - kW / 2, 120, kW, 32, 16);
        ctx.fill();
        ctx.strokeStyle = "#EF4444";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        const vsIcon = getLucideIconImage(activeBeat.lucide_icon || "Zap", "#EF4444");
        if (vsIcon) {
          ctx.drawImage(vsIcon, 540 - kW / 2 + 10, 126, 20, 20);
        }

        ctx.fillStyle = "#EF4444";
        ctx.textAlign = "center";
        ctx.fillText(kicker, vsIcon ? 540 + 10 : 540, 141);
        ctx.restore();

        ctx.save();
        ctx.translate(0, enterOffsetY);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 32px Cinzel, Arial, sans-serif";
        ctx.textAlign = "center";
        const vLines = wrapText(ctx, headline, 880).slice(0, 1);
        ctx.fillText(vLines[0] || headline, 540, 185);
        ctx.restore();

        const leftP = easeOutExpo(Math.min(1, Math.max(0, (localTime - 0.2) / 0.5)));
        const leftOffX = -50 * (1 - leftP);

        const rightP = easeOutExpo(Math.min(1, Math.max(0, (localTime - 0.3) / 0.5)));
        const rightOffX = 50 * (1 - rightP);

        const vsP = easeOutExpo(Math.min(1, Math.max(0, (localTime - 0.4) / 0.4)));

        const leftText = cleanAscii(payload.left_pill || "REALITA KUNCI").toUpperCase();
        const rightText = cleanAscii(payload.right_pill || "TANTANGAN LAPANGAN").toUpperCase();

        // Left Card at Y = 240 (Fakta Kunci dengan aksen netral/silver slate yang selaras)
        const leftAccent = "#94A3B8";
        ctx.save();
        ctx.globalAlpha = sceneAlpha * leftP;
        drawThemedCardBox(ctx, 80 + leftOffX, 240, 410, 125, 20, variant, leftAccent, true);

        ctx.fillStyle = leftAccent;
        ctx.font = "bold 14px Montserrat, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("FAKTA KUNCI", 285 + leftOffX, 268);

        ctx.fillStyle = "#F8FAFC";
        ctx.textAlign = "center";
        drawFittedText(ctx, leftText, 285 + leftOffX, 314, 370, 20, 13, "Montserrat, Arial, sans-serif", "bold");
        ctx.restore();

        // Center VS Glow Badge
        if (vsP > 0) {
          ctx.save();
          const vsScale = vsP * (1.0 + 0.08 * Math.sin(frameIndex * 0.2));
          ctx.translate(540, 302);
          ctx.scale(vsScale, vsScale);

          ctx.fillStyle = accentColor;
          ctx.beginPath();
          ctx.arc(0, 0, 26, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2.0;
          ctx.stroke();

          ctx.fillStyle = "#FFFFFF";
          ctx.font = "900 18px Montserrat, Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("VS", 0, 7);
          ctx.restore();
        }

        // Right Card at Y = 240 (Mengikuti warna aksen preset, misal: Merah #E50914)
        ctx.save();
        ctx.globalAlpha = sceneAlpha * rightP;
        drawThemedCardBox(ctx, 590 + rightOffX, 240, 410, 125, 20, variant, accentColor, true);

        ctx.fillStyle = chroma(accentColor).brighten(0.7).hex();
        ctx.font = "bold 14px Montserrat, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("TANTANGAN / ISU", 795 + rightOffX, 268);

        ctx.fillStyle = "#F8FAFC";
        ctx.textAlign = "center";
        drawFittedText(ctx, rightText, 795 + rightOffX, 314, 370, 20, 13, "Montserrat, Arial, sans-serif", "bold");
        ctx.restore();

      } else {
        // ============================================================
        // TIPE 5: QUOTE_IMPACT (Pulsing Icon + Glowing Pill + Headline)
        // ============================================================
        const iconName = activeBeat.lucide_icon || activeBeat.icon || "ShieldAlert";
        const iconImg = getLucideIconImage(iconName, beatAccent);

        if (iconImg) {
          ctx.save();
          const iconPulse = 1.0 + 0.08 * Math.sin(frameIndex * 0.18);
          ctx.translate(540, 125 + enterOffsetY);
          ctx.scale(iconPulse, iconPulse);
          ctx.drawImage(iconImg, -18, -18, 36, 36);
          ctx.restore();
        }

        ctx.save();
        ctx.translate(0, enterOffsetY);
        ctx.font = "bold 15px Montserrat, Arial, sans-serif";
        const kW = Math.max(220, ctx.measureText(kicker).width + 48);
        ctx.fillStyle = beatAccent;
        ctx.beginPath();
        ctx.roundRect(540 - kW / 2, 160, kW, 32, 16);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText(kicker, 540, 181);
        ctx.restore();

        ctx.save();
        ctx.translate(0, enterOffsetY);
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        drawFittedText(ctx, headline, 540, 235, 880, 32, 18, "Cinzel, Montserrat, sans-serif", "bold");
        ctx.restore();

        const subtext = truncateAtWordBoundary(cleanAscii(payload.impact_subtext || activeBeat.highlight_metric || "").toUpperCase(), 40);
        if (subtext && subtext.length > 2) {
          const subP = easeOutExpo(Math.min(1, Math.max(0, (localTime - 0.25) / 0.4)));
          ctx.save();
          ctx.globalAlpha = sceneAlpha * subP;
          ctx.font = "bold 20px Montserrat, Arial, sans-serif";
          const sMetrics = ctx.measureText(subtext);
          const sW = Math.min(940, Math.max(300, sMetrics.width + 56));
          const sX = 540 - sW / 2;

          drawThemedCardBox(ctx, sX, 290, sW, 52, 26, variant, beatAccent, true);

          ctx.fillStyle = "#CBD5E1";
          ctx.textAlign = "center";
          drawFittedText(ctx, subtext, 540, 323, sW - 40, 20, 13, "Montserrat, Arial, sans-serif", "bold");
          ctx.restore();
        }
      }

      // ============================================================
      // KEY TAKEAWAY FOOTER PILL (Y = 470 s/d 516 di bawah seluruh diagram)
      // ============================================================
      const footerTakeaway = truncateAtWordBoundary(cleanAscii(
        payload.key_takeaway || activeBeat.key_takeaway || activeBeat.highlight_metric || ""
      ).toUpperCase(), 42);

      if (footerTakeaway && footerTakeaway.length > 2) {
        const footP = easeOutExpo(Math.min(1, Math.max(0, (localTime - 0.25) / 0.4)));
        ctx.save();
        ctx.globalAlpha = sceneAlpha * footP;
        ctx.font = "bold 18px Montserrat, Arial, sans-serif";
        const fMetrics = ctx.measureText(footerTakeaway);
        const fW = Math.min(960, Math.max(340, fMetrics.width + 64));
        const fX = 540 - fW / 2;

        drawThemedCardBox(ctx, fX, 470, fW, 46, 23, variant, accentColor, false);

        ctx.fillStyle = "#E2E8F0";
        ctx.textAlign = "center";
        drawFittedText(ctx, footerTakeaway, 540, 499, fW - 40, 18, 12, "Montserrat, Arial, sans-serif", "bold");
        ctx.restore();
      }

      ctx.restore();
    }

    // Pipe raw RGBA frame to FFmpeg
    const imgData = ctx.getImageData(0, 0, width, height);
    const buf = Buffer.from(imgData.data.buffer);

    const canWrite = ffmpegProc.stdin.write(buf);
    if (!canWrite) {
      await new Promise((resolve) => ffmpegProc.stdin.once("drain", resolve));
    }
  }

  ffmpegProc.stdin.end();

  await new Promise<void>((resolve, reject) => {
    ffmpegProc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg animated header failed with code ${code}`));
    });
    ffmpegProc.on("error", reject);
  });

  const elapsed = Date.now() - t0;
  const stat = fs.statSync(targetPath);
  console.log(
    `[AnimatedHeaderTrack] 100% Selesai: ${targetPath} (${(stat.size / 1024).toFixed(1)} KB) dalam ${elapsed}ms (${(
      totalFrames /
      (elapsed / 1000)
    ).toFixed(1)} FPS)!`
  );

  return targetPath;
}

export interface InSceneKineticHookOptions {
  destinationPath: string;
  durationSec?: number;
  headline?: string;
  subtext?: string;
  accentColor?: string;
  fps?: number;
  transcriptWords?: Array<{ word: string; start: number; end: number }>;
}

export interface HookSpokenBeat {
  startTime: number;
  endTime: number;
  setup: string;
  punch: string;
}

export function splitHookIntoSetupAndPunch(text: string): { setup: string; punch: string } {
  const clean = (text || "").replace(/[{}\\"]/g, "").trim().replace(/\s+/g, " ");
  const words = clean.split(" ").filter(Boolean);
  if (words.length <= 1) {
    return { setup: "", punch: (words[0] || "SOROTAN UTAMA").toUpperCase() };
  }
  if (words.length === 2) {
    return { setup: words[0]!.toUpperCase(), punch: words[1]!.toUpperCase() };
  }
  if (words.length === 3) {
    return { setup: words[0]!.toUpperCase(), punch: `${words[1]} ${words[2]}`.toUpperCase() };
  }
  const punch = words.slice(-2).join(" ").toUpperCase();
  const setup = words.slice(0, -2).join(" ").toUpperCase();
  return { setup, punch };
}

/**
 * [FASE 4: SINKRONISASI KATA HOOK DINAMIS (DETIK 0.0 - 5.0)]
 * Divides words from Groq Whisper transcript during first 0.0s to 5.0s into 2 or 3 dynamic beats
 * that shift in rhythm with the speaker's actual voice (e.g. Beat 1: setup + PUNCHWORD -> Beat 2: setup + PUNCHWORD).
 */
export function buildDynamicSpokenHookBeats(
  hookDurationSec: number,
  headline?: string,
  transcriptWords?: Array<{ word: string; start: number; end: number }>
): HookSpokenBeat[] {
  // Case A: Transcript words from Groq exist in the first 0.0 - 5.5s
  if (transcriptWords && transcriptWords.length >= 3) {
    const earlyWords = transcriptWords
      .filter((w) => w.start < Math.min(5.5, hookDurationSec))
      .sort((a, b) => a.start - b.start);

    if (earlyWords.length >= 3) {
      const beatCount = earlyWords.length >= 7 ? 3 : 2;
      const chunks: Array<Array<{ word: string; start: number; end: number }>> = [];

      if (beatCount === 2) {
        const mid = Math.ceil(earlyWords.length / 2);
        chunks.push(earlyWords.slice(0, mid));
        chunks.push(earlyWords.slice(mid));
      } else {
        const c1 = Math.ceil(earlyWords.length / 3);
        const c2 = Math.ceil((earlyWords.length * 2) / 3);
        chunks.push(earlyWords.slice(0, c1));
        chunks.push(earlyWords.slice(c1, c2));
        chunks.push(earlyWords.slice(c2));
      }

      const beats: HookSpokenBeat[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        if (chunk.length === 0) continue;
        const text = chunk.map((w) => w.word).join(" ");
        const { setup, punch } = splitHookIntoSetupAndPunch(text);

        const startTime = i === 0 ? 0.0 : chunk[0]!.start;
        const endTime = i === chunks.length - 1 ? hookDurationSec : chunk[chunk.length - 1]!.end;
        beats.push({
          startTime,
          endTime,
          setup,
          punch,
        });
      }

      if (beats.length > 0) {
        beats[0]!.startTime = 0.0;
        for (let i = 0; i < beats.length - 1; i++) {
          const cur = beats[i]!;
          const next = beats[i + 1]!;
          const boundary = (cur.endTime + next.startTime) / 2;
          cur.endTime = Math.max(cur.startTime + 0.8, boundary);
          next.startTime = cur.endTime;
        }
        beats[beats.length - 1]!.endTime = hookDurationSec;
        return beats;
      }
    }
  }

  // Case B: Fallback using headline split into 2 beats
  const cleanHead = (headline || "SOROTAN UTAMA FAKTA TERBARU").replace(/[{}\\"]/g, "").trim().replace(/\s+/g, " ");
  const headWords = cleanHead.split(" ").filter(Boolean);
  if (headWords.length >= 4) {
    const mid = Math.ceil(headWords.length / 2);
    const split1 = splitHookIntoSetupAndPunch(headWords.slice(0, mid).join(" "));
    const split2 = splitHookIntoSetupAndPunch(headWords.slice(mid).join(" "));
    const splitTime = parseFloat((hookDurationSec * 0.48).toFixed(2));
    return [
      { startTime: 0.0, endTime: splitTime, setup: split1.setup, punch: split1.punch },
      { startTime: splitTime, endTime: hookDurationSec, setup: split2.setup, punch: split2.punch },
    ];
  }

  const single = splitHookIntoSetupAndPunch(cleanHead);
  return [
    { startTime: 0.0, endTime: hookDurationSec, setup: single.setup, punch: single.punch },
  ];
}

/**
 * [FASE 4: KINETIC HOOK AWAL DI DETIK 00:00 - 00:05 DENGAN BEATS DINAMIS]
 * Renders in-scene kinetic hook typography (Setup text 44px white + Giant Punchword 84px in glowing accent #FF6B00)
 * at coordinates Y ~ 340-480 onto a transparent MOV track using QuickTime RLE.
 * Words change dynamically across 2-3 spoken beats following the speaker's voice.
 */
export async function generateInSceneKineticHookTrack(
  options: InSceneKineticHookOptions
): Promise<string> {
  const t0 = Date.now();
  ensureHeaderFontsLoaded();

  const width = 1080;
  const height = 600;
  const fps = options.fps || 24;
  const hookDurationSec = Math.min(7.0, Math.max(3.0, options.durationSec || 5.2));
  const totalFrames = Math.max(1, Math.round(hookDurationSec * fps));

  const accentColor = options.accentColor && /^#[0-9A-Fa-f]{6}$/.test(options.accentColor)
    ? options.accentColor
    : "#FF6B00";

  const targetPath = options.destinationPath.replace(/\.mp4$/i, ".mov");
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const beats = buildDynamicSpokenHookBeats(
    hookDurationSec,
    options.headline,
    options.transcriptWords
  );

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const ffmpegExe = getFfmpegPath();

  const ffmpegProc = spawn(
    ffmpegExe,
    [
      "-y",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-s",
      `${width}x${height}`,
      "-r",
      String(fps),
      "-i",
      "pipe:0",
      "-threads",
      "0",
      "-c:v",
      "qtrle",
      targetPath,
    ],
    { stdio: ["pipe", "ignore", "inherit"] }
  );

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const t = frameIndex / fps;
    ctx.clearRect(0, 0, width, height);

    // Identify active spoken beat
    let activeBeat = beats.find((b) => t >= b.startTime && t < b.endTime);
    if (!activeBeat) {
      activeBeat = t < beats[0]!.startTime ? beats[0]! : beats[beats.length - 1]!;
    }

    const beatLocalT = Math.max(0, t - activeBeat.startTime);
    const beatDur = Math.max(0.1, activeBeat.endTime - activeBeat.startTime);

    // Fast snappy entrance per beat (0.32s spring pop)
    const beatEnterDur = 0.32;
    const beatEase = easeOutExpo(Math.min(1, beatLocalT / beatEnterDur));

    // Crossfade exit per beat (0.20s before transition)
    const isLastBeat = activeBeat === beats[beats.length - 1];
    let beatAlpha = 1.0;
    if (!isLastBeat && beatDur - beatLocalT < 0.20) {
      beatAlpha = Math.max(0, (beatDur - beatLocalT) / 0.20);
    }

    // Overall hook scene exit (last 0.40s)
    const overallTimeLeft = Math.max(0, hookDurationSec - t);
    let overallExitAlpha = 1.0;
    let overallExitOffsetY = 0;
    if (overallTimeLeft < 0.40) {
      const p = 1 - overallTimeLeft / 0.40;
      overallExitAlpha = Math.max(0, 1 - easeOutExpo(p));
      overallExitOffsetY = -25 * easeOutExpo(p);
    }

    const currentAlpha = Math.min(beatEase, beatAlpha, overallExitAlpha);
    const enterOffsetY = (1 - beatEase) * 18; // 18px -> 0px pop

    ctx.save();
    ctx.translate(0, enterOffsetY + overallExitOffsetY);
    ctx.globalAlpha = currentAlpha;

    // Snappy scale pop on entrance (0.90 -> 1.00)
    const currentScale = 0.90 + 0.10 * beatEase;
    ctx.translate(540, 400);
    ctx.scale(currentScale, currentScale);
    ctx.translate(-540, -400);

    const setup = activeBeat.setup;
    const punch = activeBeat.punch;

    // Baris 1 (Setup text): Putih bersih Plus Jakarta Sans Bold 44px at Y ~ 340
    if (setup) {
      ctx.save();
      ctx.font = '900 44px "Plus Jakarta Sans", "Montserrat", Arial, sans-serif';
      ctx.textAlign = "center";
      const setupMetrics = ctx.measureText(setup);
      const setupFontSize = setupMetrics.width > 960 ? Math.max(26, Math.floor((960 / setupMetrics.width) * 44)) : 44;
      ctx.font = `900 ${setupFontSize}px "Plus Jakarta Sans", "Montserrat", Arial, sans-serif`;

      // Dark crisp shadow
      ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(setup, 540, 340);

      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.70)";
      ctx.strokeText(setup, 540, 340);
      ctx.fillText(setup, 540, 340);
      ctx.restore();
    }

    // Baris 2 (Giant Punchword): Poppins Black 84px in glowing accent (#FF6B00) with warm orange glow (#FF5500)
    ctx.save();
    ctx.font = '900 84px "Poppins", "Montserrat", Arial, sans-serif';
    ctx.textAlign = "center";
    const punchMetrics = ctx.measureText(punch);
    const punchFontSize = punchMetrics.width > 980 ? Math.max(42, Math.floor((980 / punchMetrics.width) * 84)) : 84;
    ctx.font = `900 ${punchFontSize}px "Poppins", "Montserrat", Arial, sans-serif`;
    const punchY = setup ? 450 : 405;

    // Pass 1: Warm soft orange glow (#FF5500 / accent)
    ctx.shadowColor = "#FF5500";
    ctx.shadowBlur = 45;
    ctx.fillStyle = accentColor;
    ctx.fillText(punch, 540, punchY);

    // Pass 2: Intense core glow + crisp dark stroke
    ctx.shadowBlur = 20;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    ctx.strokeText(punch, 540, punchY);
    ctx.fillText(punch, 540, punchY);
    ctx.restore();

    ctx.restore();

    // Pipe raw RGBA frame to FFmpeg
    const imgData = ctx.getImageData(0, 0, width, height);
    const buf = Buffer.from(imgData.data.buffer);

    const canWrite = ffmpegProc.stdin.write(buf);
    if (!canWrite) {
      await new Promise((resolve) => ffmpegProc.stdin.once("drain", resolve));
    }
  }

  ffmpegProc.stdin.end();

  await new Promise<void>((resolve, reject) => {
    ffmpegProc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg kinetic hook track failed with code ${code}`));
    });
    ffmpegProc.on("error", reject);
  });

  const elapsed = Date.now() - t0;
  console.log(`[KineticHook] Kinetic Hook Track berhasil dibuat: ${targetPath} (${elapsed}ms)`);
  return targetPath;
}
