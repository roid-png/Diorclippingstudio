import { execFile, execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import pLimit from "p-limit";
import { getFfmpegPath } from "../utils/ffmpeg-path";
import { getOutputsDir, getTempDir } from "./downloader";
import type { VideoPreset } from "./presets.service";
import { HttpError } from "../lib/http-error";
import { getFontsDirPath } from "./ass-generator.service";
import { getOrBuildCinemaFramePng, getOrBuildBottomVignettePng } from "./satori_hook_builder";
import { getOrBuildSfxFiles } from "./sfx_generator";

const execFileAsync = promisify(execFile);

// Guard CPU: Strict sequential rendering (1 clip at a time) for Intel Core i5 8GB RAM
const videoRenderQueue = pLimit(1);

let cachedEncoderArgs: string[] | null = null;

/**
 * Checks if the media file contains an active audio stream.
 */
export function hasAudioStream(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    const ffmpegExe = getFfmpegPath();
    const res = spawnSync(ffmpegExe, ["-i", filePath], { encoding: "utf-8" });
    const output = (res.stdout || "") + (res.stderr || "");
    return output.includes("Audio:");
  } catch {
    return false;
  }
}

/**
 * [FASE 4 & 5: CPU GUARD & FAST ENCODER ARGUMENTS]
 * Gunakan parameter: -threads 3 -c:v libx264 -preset ultrafast -tune fastdecode -crf 24 -r 30 -pix_fmt yuv420p -movflags +faststart
 * Attempt Intel QuickSync (h264_qsv) first if supported; fallback to CPU ultrafast guard.
 */
export function getFastEncoderArgs(): string[] {
  if (cachedEncoderArgs) return cachedEncoderArgs;
  const ffmpegPath = getFfmpegPath();
  try {
    execFileSync(
      ffmpegPath,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=64x64:d=0.04",
        "-c:v",
        "h264_qsv",
        "-global_quality",
        "24",
        "-f",
        "null",
        "-",
      ],
      { stdio: "ignore", timeout: 3000 }
    );
    console.log("[Renderer] QuickSync Hardware Encoder (h264_qsv) AKTIF.");
    cachedEncoderArgs = [
      "-c:v",
      "h264_qsv",
      "-global_quality",
      "24",
      "-threads",
      "3",
    ];
  } catch {
    console.log(
      "[Renderer] QuickSync fallback, menggunakan CPU ultrafast full multi-threading (-threads 0 -c:v libx264 -preset ultrafast -tune fastdecode -crf 23)."
    );
    cachedEncoderArgs = [
      "-threads",
      "0",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-tune",
      "fastdecode",
      "-crf",
      "23",
    ];
  }
  return cachedEncoderArgs;
}

export interface ExplanationBeatCardInput {
  pngPath: string;
  startSec: number;
  durationSec: number;
}

export interface FourCardsMetadata {
  card0Path: string;
  card1Path: string;
  card2Path: string;
  card3Path: string;
  tHook: number;
  tB1Start: number;
  tB1End: number;
  tB2Start: number;
  tB2End: number;
  tB3Start: number;
  tB3End: number;
}

export interface RenderClipParams {
  clipId: string;
  sourceVideoPath?: string;
  teaserVideoPath?: string;
  teaserDurationSec?: number;
  topHookBannerPngPath?: string;
  fourCards?: FourCardsMetadata;
  explanationBeatCards?: ExplanationBeatCardInput[];
  enableExplanationBeats?: boolean;
  assSubtitlePath?: string;
  infographicPngPath?: string;
  motionHeaderVideoPath?: string;
  animatedHeaderTrackPath?: string;
  hookOverlayPngPath?: string;
  enableHookOverlay?: boolean;
  enableCinemaFrame?: boolean;
  enableSfx?: boolean;
  colorPolish?: boolean;
  durationSec: number;
  preset: VideoPreset;
  speakerCropFilter?: string;
  inSceneKineticHookTrackPath?: string;
  tempJobDir?: string;
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
 * [FASE 2: NATURAL BRIGHTNESS & COLOR GRADING]
 * Resolves color grading strings ensuring positive natural brightness and clean contrast.
 * Strictly prevents negative brightness to eliminate crushed blacks.
 */
export function resolveFfmpegColorGrading(grading?: string): string {
  if (grading) {
    const trimmed = grading.trim();
    if (trimmed.includes("=")) {
      return trimmed
        .replace(/brightness=-0\.\d+/g, "brightness=0.02")
        .replace(/contrast=1\.[2-9]\d*/g, "contrast=1.03");
    }
    const lower = trimmed.toLowerCase();
    if (lower.includes("warm") || lower.includes("cinematic")) {
      return "eq=brightness=0.02:contrast=1.04:saturation=1.08,colorbalance=rs=0.03:gs=0.01:bs=-0.02";
    }
  }
  return "eq=brightness=0.02:contrast=1.03:saturation=1.05";
}

/**
 * [FASE 4 & 5: BEAUTIFIER PIPELINE, SMOOTH HOOK TRANSITIONS & DOWNSCALE-BLUR ENGINE]
 * Renders a full 9:16 vertical MP4 clip (1080x1920, 30 FPS):
 * - Layer 1 (Background): Downscale-Blur + Dynamic Background Breathing
 *   [0:v]scale=180:320,boxblur=10:2,scale=1080:1920:flags=fast_bilinear,eq=brightness='if(lt(t,3.9),-0.18,if(lt(t,4.6),-0.18+0.06*(t-3.9)/0.7,-0.12))':saturation=1.35[bg_blur]
 * - Layer 2 (Main Video Center 16:9): Y=656 (1080x608) with eq=contrast=1.05:saturation=1.08
 * - Layer 3 (Cinema Frame & Subtle Vignette): cinema_frame.png (1080x1920)
 * - Layer 4 (The Smooth Hook): hook_overlay.png with smooth upward slide & fade-out (0.0s - 4.6s)
 * - Layer 5 (High-Legibility Subtitle): Subtitle .ass at Y=1580
 * - Audio Mixing: Original audio + boom.wav (0s, vol 0.22) + whoosh.wav (3.9s, vol 0.18) via amix
 * - Execution Guard: pLimit(1), threads 3, crf 24, ultrafast preset
 */
export async function renderVerticalClip(params: RenderClipParams): Promise<RenderResult> {
  return await videoRenderQueue(async () => {
    const ffmpegPath = getFfmpegPath();
    const outputsDir = getOutputsDir();
    const outputFileName = `dior_${params.clipId}.mp4`;
    const outputFilePath = path.join(outputsDir, outputFileName);

    const duration = Math.max(3, Math.round(params.durationSec));

    const hasSource = params.sourceVideoPath && fs.existsSync(params.sourceVideoPath);
    if (!hasSource) {
      throw new HttpError(
        400,
        "SOURCE_VIDEO_NOT_FOUND",
        "File video sumber segmen tidak ditemukan. Gagal melanjutkan proses rendering."
      );
    }

    // 1. Foreground video filter: lock to 1080x608 (16:9), 30 FPS, lightweight hardware-friendly color polish
    const resolvedGrading = resolveFfmpegColorGrading(params.preset?.colorGrading);
    const fgFilters = [
      "fps=30",
      "scale=1080:608:force_original_aspect_ratio=decrease",
      "pad=1080:608:(1080-iw)/2:(608-ih)/2:color=black",
    ];
    if (params.colorPolish !== false) {
      fgFilters.push("hue=s=1.06");
    }
    if (resolvedGrading) {
      fgFilters.push(resolvedGrading);
    }

    const isColdOpenTeaser =
      Boolean(params.teaserVideoPath) &&
      params.enableHookOverlay !== false &&
      fs.existsSync(params.teaserVideoPath!);

    const encoderArgs = getFastEncoderArgs();
    const targetTmp = path.join(outputsDir, `render_tmp_${Date.now()}_${outputFileName}`);

    let ffmpegArgs: string[] = [];
    let finalDuration = duration;

    // Resolve 4 Cards
    const fourCards = params.fourCards;
    const card0Path = fourCards?.card0Path || params.topHookBannerPngPath || params.hookOverlayPngPath;
    const card1Path = fourCards?.card1Path || params.explanationBeatCards?.[0]?.pngPath;
    const card2Path = fourCards?.card2Path || params.explanationBeatCards?.[1]?.pngPath;
    const card3Path = fourCards?.card3Path || params.explanationBeatCards?.[2]?.pngPath;

    const hasAnimatedHeader = Boolean(
      params.animatedHeaderTrackPath && fs.existsSync(params.animatedHeaderTrackPath)
    );

    const hasFourCards = Boolean(
      card0Path && fs.existsSync(card0Path) &&
      card1Path && fs.existsSync(card1Path) &&
      card2Path && fs.existsSync(card2Path) &&
      card3Path && fs.existsSync(card3Path)
    );

    const teaserDuration =
      params.teaserDurationSec && params.teaserDurationSec > 0
        ? params.teaserDurationSec
        : 4.0;

    const tHook = fourCards?.tHook ?? (isColdOpenTeaser ? teaserDuration : 4.0);
    const tB1Start = fourCards?.tB1Start ?? (tHook + 0.2);
    const tB1End = fourCards?.tB1End ?? (tHook + Math.round(duration * 0.33));
    const tB2Start = fourCards?.tB2Start ?? (tB1End + 0.2);
    const tB2End = fourCards?.tB2End ?? (tHook + Math.round(duration * 0.66));
    const tB3Start = fourCards?.tB3Start ?? (tB2End + 0.2);
    const tB3End = fourCards?.tB3End ?? (tHook + duration);

    const fontsDir = getFontsDirPath();
    const escapedFontsDir = escapeFilterPath(fontsDir);
    const hasSubtitle = Boolean(params.assSubtitlePath && fs.existsSync(params.assSubtitlePath));
    const escapedAss = hasSubtitle ? escapeFilterPath(params.assSubtitlePath!) : "";

    const cinemaFramePath = await getOrBuildCinemaFramePng();
    const { boomWavPath, whooshWavPath } = getOrBuildSfxFiles();

    const isKineticClipper =
      params.preset?.layoutArchitecture === "IN_SCENE_KINETIC_CLIPPER" ||
      params.preset?.cameraFraming === "FULL_9_16_SPEAKER_TRACK" ||
      params.preset?.enableTopMotion === false;

    if (isColdOpenTeaser) {
      // ==============================================================
      // [FASE 3 & 4: 2-SEGMEN COLD-OPEN TEASER + ANIMATED HEADER TRACK]
      // ==============================================================
      finalDuration = teaserDuration + duration;
      const fadeDuration = 0.14;
      const fadeStart = Math.max(0, teaserDuration - fadeDuration);
      const whooshDelayMs = Math.round(fadeStart * 1000);

      const inputs: string[] = [
        "-y",
        "-i", params.teaserVideoPath!, // Input 0
        "-i", params.sourceVideoPath!, // Input 1
      ];

      let cinemaFrameIdx = -1;
      let bottomVignetteIdx = -1;
      let nextColdInputIdx = 2;

      // [FASE 3: MATIKAN CINEMA FRAME PADA FULL VERTICAL, GUNAKAN BOTTOM VIGNETTE GRADIENT]
      if (
        !isKineticClipper &&
        params.preset?.cameraFraming !== "FULL_9_16_SPEAKER_TRACK" &&
        params.enableCinemaFrame !== false &&
        fs.existsSync(cinemaFramePath)
      ) {
        inputs.push("-i", cinemaFramePath);
        cinemaFrameIdx = nextColdInputIdx++;
      } else if (isKineticClipper || params.preset?.cameraFraming === "FULL_9_16_SPEAKER_TRACK") {
        const bottomVignettePath = await getOrBuildBottomVignettePng();
        if (fs.existsSync(bottomVignettePath)) {
          inputs.push("-i", bottomVignettePath);
          bottomVignetteIdx = nextColdInputIdx++;
        }
      }

      let kineticHookIdx = -1;
      if (
        params.inSceneKineticHookTrackPath &&
        fs.existsSync(params.inSceneKineticHookTrackPath) &&
        (isKineticClipper ||
          params.preset?.hookVisualType === "IN_SCENE_KINETIC_HOOK" ||
          params.preset?.hookVisualType === "IN_SCENE_GLOW_TYPOGRAPHY")
      ) {
        inputs.push("-i", params.inSceneKineticHookTrackPath);
        kineticHookIdx = nextColdInputIdx++;
      }

      let animatedHeaderIdx = -1;
      let card0Idx = -1;
      let card1Idx = -1;
      let card2Idx = -1;
      let card3Idx = -1;

      if (!isKineticClipper) {
        if (hasAnimatedHeader && params.enableMotionGraphic !== false) {
          inputs.push("-i", params.animatedHeaderTrackPath!);
          animatedHeaderIdx = nextColdInputIdx++;
        } else if (hasFourCards && params.enableMotionGraphic !== false) {
          inputs.push("-loop", "1", "-t", String(Math.ceil(tHook + 5)), "-i", card0Path!);
          card0Idx = nextColdInputIdx++;
          inputs.push("-loop", "1", "-t", String(Math.ceil(tB1End + 5)), "-i", card1Path!);
          card1Idx = nextColdInputIdx++;
          inputs.push("-loop", "1", "-t", String(Math.ceil(tB2End + 5)), "-i", card2Path!);
          card2Idx = nextColdInputIdx++;
          inputs.push("-loop", "1", "-t", String(Math.ceil(tB3End + 5)), "-i", card3Path!);
          card3Idx = nextColdInputIdx++;
        } else if (card0Path && fs.existsSync(card0Path) && params.enableHookOverlay !== false) {
          inputs.push("-loop", "1", "-t", String(Math.ceil(tHook + 5)), "-i", card0Path);
          card0Idx = nextColdInputIdx++;
        }
      }

      let boomIdx = -1;
      let whooshIdx = -1;
      if (params.enableSfx !== false && fs.existsSync(boomWavPath) && fs.existsSync(whooshWavPath)) {
        inputs.push("-i", boomWavPath);
        boomIdx = nextColdInputIdx++;
        inputs.push("-i", whooshWavPath);
        whooshIdx = nextColdInputIdx++;
      }

      const gradingTag = resolvedGrading ? `,${resolvedGrading}` : "";
      const polishTag = params.colorPolish !== false ? ",hue=s=1.06" : "";
      const fgExtra = `${polishTag}${gradingTag}`;

      let filterParts: string[] = [];

      const defaultCrop = `scale=-2:1920,crop=1080:1920:x='(in_w-out_w)*0.82':y=0`;
      const activeCrop = params.speakerCropFilter || defaultCrop;

      if (isKineticClipper) {
        filterParts = [
          // Segmen A: Full vertical 9:16 crop with active speaker focus + zoompan + fast dark dissolve
          `[0:v]fps=30,${activeCrop}${fgExtra},zoompan=z='min(zoom+0.0005,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30[v_a_base]`,
          `[v_a_base]fade=t=out:st=${fadeStart.toFixed(2)}:d=${fadeDuration}:c=black[v_a_final]`,

          // Segmen B: Full vertical 9:16 crop with active speaker focus + slow Ken Burns zoom-in (1.00x -> 1.05x) + fast dark dissolve
          `[1:v]fps=30,${activeCrop}${fgExtra},zoompan=z='min(1.000+0.000037*on,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30[v_b_base]`,
          `[v_b_base]fade=t=in:st=0:d=${fadeDuration}:c=black[v_b_final]`,

          // Join segments
          `[v_a_final][v_b_final]concat=n=2:v=1:a=0[v_joined]`,
        ];
      } else {
        filterParts = [
          // Segmen A: Background blur + foreground zoompan (1.00x -> 1.06x) + fast cinematic dark dissolve
          `[0:v]fps=30,scale=180:320,boxblur=10:2,eq=brightness=-0.18:saturation=1.35,scale=1080:1920:flags=fast_bilinear[bg_a]`,
          `[0:v]fps=30,scale=1080:608:force_original_aspect_ratio=decrease,pad=1080:608:(1080-iw)/2:(608-ih)/2:color=black${fgExtra},zoompan=z='min(zoom+0.0005,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x608:fps=30[fg_a]`,
          `[bg_a][fg_a]overlay=x=0:y=656[v_a_base]`,
          `[v_a_base]fade=t=out:st=${fadeStart.toFixed(2)}:d=${fadeDuration}:c=black[v_a_final]`,

          // Segmen B: Background blur + foreground center + fast cinematic dark dissolve
          `[1:v]fps=30,scale=180:320,boxblur=10:2,eq=brightness=-0.12:saturation=1.35,scale=1080:1920:flags=fast_bilinear[bg_b]`,
          `[1:v]fps=30,scale=1080:608:force_original_aspect_ratio=decrease,pad=1080:608:(1080-iw)/2:(608-ih)/2:color=black${fgExtra}[fg_b]`,
          `[bg_b][fg_b]overlay=x=0:y=656[v_b_base]`,
          `[v_b_base]fade=t=in:st=0:d=${fadeDuration}:c=black[v_b_final]`,

          // [FASE 4: SMOOTH DARK CROSS-DISSOLVE - TANPA LAYAR PUTIH SILAU]
          `[v_a_final][v_b_final]concat=n=2:v=1:a=0[v_joined]`,
        ];
      }

      // Overlay Cinema Frame OR Bottom Vignette
      if (cinemaFrameIdx !== -1) {
        filterParts.push(`[v_joined][${cinemaFrameIdx}:v]overlay=0:0[base_canvas]`);
      } else if (bottomVignetteIdx !== -1) {
        filterParts.push(`[v_joined][${bottomVignetteIdx}:v]overlay=0:0[base_canvas]`);
      } else {
        filterParts.push(`[v_joined]null[base_canvas]`);
      }

      let lastVideoNode = "base_canvas";

      // [FASE 4: IN-SCENE KINETIC HOOK OVERLAY]
      if (kineticHookIdx !== -1) {
        console.log(`[Renderer] Menempelkan in_scene_kinetic_hook_track di koordinat X=0, Y=0`);
        filterParts.push(`[${lastVideoNode}][${kineticHookIdx}:v]overlay=x=0:y=0:eof_action=pass[v_with_hook]`);
        lastVideoNode = "v_with_hook";
      }

      // [FASE 4: ANIMATED HEADER OVERLAY AT X=0, Y=0]
      if (animatedHeaderIdx !== -1) {
        console.log(`[Renderer] Menempelkan animated_header_track di koordinat X=0, Y=0 sepanjang video`);
        filterParts.push(`[${lastVideoNode}][${animatedHeaderIdx}:v]overlay=x=0:y=0[v_with_header]`);
        lastVideoNode = "v_with_header";
      } else if (hasFourCards && params.enableMotionGraphic !== false) {
        console.log("Berhasil merender 4 kartu infografis (Hook + 3 Explanation Beats) dan menggabungkannya ke FFmpeg");
        filterParts.push(
          `[${card0Idx}:v]format=rgba,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=${(tHook - 0.4).toFixed(2)}:d=0.35:alpha=1[c0]`,
          `[${card1Idx}:v]format=rgba,fade=t=in:st=${tB1Start.toFixed(2)}:d=0.4:alpha=1,fade=t=out:st=${(tB1End - 0.4).toFixed(2)}:d=0.4:alpha=1[c1]`,
          `[${card2Idx}:v]format=rgba,fade=t=in:st=${tB2Start.toFixed(2)}:d=0.4:alpha=1,fade=t=out:st=${(tB2End - 0.4).toFixed(2)}:d=0.4:alpha=1[c2]`,
          `[${card3Idx}:v]format=rgba,fade=t=in:st=${tB3Start.toFixed(2)}:d=0.4:alpha=1,fade=t=out:st=${(tB3End - 0.4).toFixed(2)}:d=0.4:alpha=1[c3]`,
          `[${lastVideoNode}][c0]overlay=x=0:y='if(lt(t,0.35), 140-(t*110), 100)':enable='between(t,0,${tHook.toFixed(2)})'[v0]`,
          `[v0][c1]overlay=x=0:y='if(lt(t-${tB1Start.toFixed(2)},0.35), 140-((t-${tB1Start.toFixed(2)})*110), 100)':enable='between(t,${tB1Start.toFixed(2)},${tB1End.toFixed(2)})'[v1]`,
          `[v1][c2]overlay=x=0:y='if(lt(t-${tB2Start.toFixed(2)},0.35), 140-((t-${tB2Start.toFixed(2)})*110), 100)':enable='between(t,${tB2Start.toFixed(2)},${tB2End.toFixed(2)})'[v2]`,
          `[v2][c3]overlay=x=0:y='if(lt(t-${tB3Start.toFixed(2)},0.35), 140-((t-${tB3Start.toFixed(2)})*110), 100)':enable='between(t,${tB3Start.toFixed(2)},${tB3End.toFixed(2)})'[v_with_cards]`
        );
        lastVideoNode = "v_with_cards";
      } else if (card0Idx !== -1) {
        filterParts.push(
          `[${card0Idx}:v]format=rgba,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=${(tHook - 0.4).toFixed(2)}:d=0.35:alpha=1[c0]`,
          `[${lastVideoNode}][c0]overlay=x=0:y='if(lt(t,0.35), 140-(t*110), 100)':enable='between(t,0,${tHook.toFixed(2)})'[v0]`
        );
        lastVideoNode = "v0";
      }

      // Subtitle .ass
      if (hasSubtitle) {
        filterParts.push(`[${lastVideoNode}]ass='${escapedAss}':fontsdir='${escapedFontsDir}'[v_out]`);
      } else {
        filterParts.push(`[${lastVideoNode}]null[v_out]`);
      }

      // Audio Mixing with SFX
      const hasAaudio = hasAudioStream(params.teaserVideoPath!);
      const hasBaudio = hasAudioStream(params.sourceVideoPath!);
      let hasAudioOut = false;

      if (hasAaudio && hasBaudio) {
        filterParts.push(
          `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,afade=t=out:st=${fadeStart.toFixed(2)}:d=${fadeDuration}[a_a]`,
          `[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,afade=t=in:st=0:d=${fadeDuration}[a_b]`,
          `[a_a][a_b]concat=n=2:v=0:a=1[a_dialog]`
        );

        if (boomIdx !== -1 && whooshIdx !== -1) {
          const amixInputs: string[] = ["[a_dialog]", "[sfx_boom]", "[sfx_whoosh]"];
          filterParts.push(
            `[${boomIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=0|0,volume=0.22[sfx_boom]`,
            `[${whooshIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=${whooshDelayMs}|${whooshDelayMs},volume=0.20[sfx_whoosh]`
          );

          if (hasFourCards && params.enableMotionGraphic !== false) {
            const b1DelayMs = Math.round(tB1Start * 1000);
            const b2DelayMs = Math.round(tB2Start * 1000);
            const b3DelayMs = Math.round(tB3Start * 1000);
            filterParts.push(
              `[${whooshIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=${b1DelayMs}|${b1DelayMs},volume=0.15[sfx_b1]`,
              `[${whooshIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=${b2DelayMs}|${b2DelayMs},volume=0.15[sfx_b2]`,
              `[${whooshIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=${b3DelayMs}|${b3DelayMs},volume=0.15[sfx_b3]`
            );
            amixInputs.push("[sfx_b1]", "[sfx_b2]", "[sfx_b3]");
          }

          filterParts.push(
            `${amixInputs.join("")}amix=inputs=${amixInputs.length}:duration=first:dropout_transition=2[a_out]`
          );
        } else {
          filterParts.push(`[a_dialog]anull[a_out]`);
        }
        hasAudioOut = true;
      }

      const audioArgs = hasAudioOut
        ? ["-map", "[a_out]"]
        : (hasBaudio ? ["-map", "1:a"] : []);

      ffmpegArgs = [
        ...inputs,
        "-filter_complex",
        filterParts.join(";"),
        "-map",
        "[v_out]",
        ...audioArgs,
        ...encoderArgs,
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        "-t",
        String(finalDuration),
        targetTmp,
      ];
    } else {
      // ==============================================================
      // [SINGLE SEGMENT: STANDARD STRAIGHT POD-FRAMING RENDER]
      // ==============================================================
      const inputs: string[] = ["-y", "-i", params.sourceVideoPath!]; // Input 0
      let cinemaFrameIdx = -1;
      let bottomVignetteIdx = -1;
      let nextInputIdx = 1;

      // [FASE 3: MATIKAN CINEMA FRAME PADA FULL VERTICAL, GUNAKAN BOTTOM VIGNETTE GRADIENT]
      if (
        !isKineticClipper &&
        params.preset?.cameraFraming !== "FULL_9_16_SPEAKER_TRACK" &&
        params.enableCinemaFrame !== false &&
        fs.existsSync(cinemaFramePath)
      ) {
        inputs.push("-i", cinemaFramePath);
        cinemaFrameIdx = nextInputIdx++;
      } else if (isKineticClipper || params.preset?.cameraFraming === "FULL_9_16_SPEAKER_TRACK") {
        const bottomVignettePath = await getOrBuildBottomVignettePng();
        if (fs.existsSync(bottomVignettePath)) {
          inputs.push("-i", bottomVignettePath);
          bottomVignetteIdx = nextInputIdx++;
        }
      }

      let kineticHookIdx = -1;
      if (
        params.inSceneKineticHookTrackPath &&
        fs.existsSync(params.inSceneKineticHookTrackPath) &&
        (isKineticClipper ||
          params.preset?.hookVisualType === "IN_SCENE_KINETIC_HOOK" ||
          params.preset?.hookVisualType === "IN_SCENE_GLOW_TYPOGRAPHY")
      ) {
        inputs.push("-i", params.inSceneKineticHookTrackPath);
        kineticHookIdx = nextInputIdx++;
      }

      let animatedHeaderIdx = -1;
      let card0Idx = -1;
      let card1Idx = -1;
      let card2Idx = -1;
      let card3Idx = -1;

      if (!isKineticClipper) {
        if (hasAnimatedHeader && params.enableMotionGraphic !== false) {
          inputs.push("-i", params.animatedHeaderTrackPath!);
          animatedHeaderIdx = nextInputIdx++;
        } else if (hasFourCards && params.enableMotionGraphic !== false) {
          inputs.push("-loop", "1", "-t", String(Math.ceil(tHook + 5)), "-i", card0Path!);
          card0Idx = nextInputIdx++;
          inputs.push("-loop", "1", "-t", String(Math.ceil(tB1End + 5)), "-i", card1Path!);
          card1Idx = nextInputIdx++;
          inputs.push("-loop", "1", "-t", String(Math.ceil(tB2End + 5)), "-i", card2Path!);
          card2Idx = nextInputIdx++;
          inputs.push("-loop", "1", "-t", String(Math.ceil(tB3End + 5)), "-i", card3Path!);
          card3Idx = nextInputIdx++;
        } else if (card0Path && fs.existsSync(card0Path) && params.enableHookOverlay !== false) {
          inputs.push("-loop", "1", "-t", String(Math.ceil(tHook + 5)), "-i", card0Path);
          card0Idx = nextInputIdx++;
        }
      }

      let boomIdx = -1;
      let whooshIdx = -1;
      if (params.enableSfx !== false && fs.existsSync(boomWavPath) && fs.existsSync(whooshWavPath)) {
        inputs.push("-i", boomWavPath);
        boomIdx = nextInputIdx++;
        inputs.push("-i", whooshWavPath);
        whooshIdx = nextInputIdx++;
      }

      const gradingTag = resolvedGrading ? `,${resolvedGrading}` : "";
      const polishTag = params.colorPolish !== false ? ",hue=s=1.06" : "";
      const fgExtra = `${polishTag}${gradingTag}`;

      let filterParts: string[] = [];

      const defaultCrop = `scale=-2:1920,crop=1080:1920:x='(in_w-out_w)*0.82':y=0`;
      const activeCrop = params.speakerCropFilter || defaultCrop;

      if (isKineticClipper) {
        filterParts = [
          // Full vertical 9:16 crop with active speaker focus + slow Ken Burns zoom-in (1.00x -> 1.05x)
          `[0:v]fps=30,${activeCrop}${fgExtra},zoompan=z='min(1.000+0.000037*on,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30[v_base]`,
        ];
      } else {
        const bgFilters = [
          "scale=180:320",
          "boxblur=10:2",
          "eq=brightness=-0.14:saturation=1.35",
          "scale=1080:1920:flags=fast_bilinear",
        ].join(",");

        filterParts = [
          `[0:v]${bgFilters}[bg_blur]`,
          `[0:v]${fgFilters.join(",")}[fg]`,
          `[bg_blur][fg]overlay=x=0:y=656[v_base]`,
        ];
      }

      // Overlay Cinema Frame OR Bottom Vignette
      if (cinemaFrameIdx !== -1) {
        filterParts.push(`[v_base][${cinemaFrameIdx}:v]overlay=0:0[base_canvas]`);
      } else if (bottomVignetteIdx !== -1) {
        filterParts.push(`[v_base][${bottomVignetteIdx}:v]overlay=0:0[base_canvas]`);
      } else {
        filterParts.push(`[v_base]null[base_canvas]`);
      }

      let lastVideoNode = "base_canvas";

      // [FASE 4: IN-SCENE KINETIC HOOK OVERLAY]
      if (kineticHookIdx !== -1) {
        console.log(`[Renderer] Menempelkan in_scene_kinetic_hook_track di koordinat X=0, Y=0`);
        filterParts.push(`[${lastVideoNode}][${kineticHookIdx}:v]overlay=x=0:y=0:eof_action=pass[v_with_hook]`);
        lastVideoNode = "v_with_hook";
      }

      if (animatedHeaderIdx !== -1) {
        console.log(`[Renderer] Menempelkan animated_header_track di koordinat X=0, Y=0 sepanjang video`);
        filterParts.push(`[${lastVideoNode}][${animatedHeaderIdx}:v]overlay=x=0:y=0[v_with_header]`);
        lastVideoNode = "v_with_header";
      } else if (hasFourCards && params.enableMotionGraphic !== false) {
        console.log("Berhasil merender 4 kartu infografis (Hook + 3 Explanation Beats) dan menggabungkannya ke FFmpeg");
        filterParts.push(
          `[${card0Idx}:v]format=rgba,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=${(tHook - 0.4).toFixed(2)}:d=0.35:alpha=1[c0]`,
          `[${card1Idx}:v]format=rgba,fade=t=in:st=${tB1Start.toFixed(2)}:d=0.4:alpha=1,fade=t=out:st=${(tB1End - 0.4).toFixed(2)}:d=0.4:alpha=1[c1]`,
          `[${card2Idx}:v]format=rgba,fade=t=in:st=${tB2Start.toFixed(2)}:d=0.4:alpha=1,fade=t=out:st=${(tB2End - 0.4).toFixed(2)}:d=0.4:alpha=1[c2]`,
          `[${card3Idx}:v]format=rgba,fade=t=in:st=${tB3Start.toFixed(2)}:d=0.4:alpha=1,fade=t=out:st=${(tB3End - 0.4).toFixed(2)}:d=0.4:alpha=1[c3]`,
          `[${lastVideoNode}][c0]overlay=x=0:y='if(lt(t,0.35), 140-(t*110), 100)':enable='between(t,0,${tHook.toFixed(2)})'[v0]`,
          `[v0][c1]overlay=x=0:y='if(lt(t-${tB1Start.toFixed(2)},0.35), 140-((t-${tB1Start.toFixed(2)})*110), 100)':enable='between(t,${tB1Start.toFixed(2)},${tB1End.toFixed(2)})'[v1]`,
          `[v1][c2]overlay=x=0:y='if(lt(t-${tB2Start.toFixed(2)},0.35), 140-((t-${tB2Start.toFixed(2)})*110), 100)':enable='between(t,${tB2Start.toFixed(2)},${tB2End.toFixed(2)})'[v2]`,
          `[v2][c3]overlay=x=0:y='if(lt(t-${tB3Start.toFixed(2)},0.35), 140-((t-${tB3Start.toFixed(2)})*110), 100)':enable='between(t,${tB3Start.toFixed(2)},${tB3End.toFixed(2)})'[v_with_cards]`
        );
        lastVideoNode = "v_with_cards";
      } else if (card0Idx !== -1) {
        filterParts.push(
          `[${card0Idx}:v]format=rgba,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=${(tHook - 0.4).toFixed(2)}:d=0.35:alpha=1[c0]`,
          `[${lastVideoNode}][c0]overlay=x=0:y='if(lt(t,0.35), 140-(t*110), 100)':enable='between(t,0,${tHook.toFixed(2)})'[v0]`
        );
        lastVideoNode = "v0";
      }

      if (hasSubtitle) {
        filterParts.push(`[${lastVideoNode}]ass='${escapedAss}':fontsdir='${escapedFontsDir}'[v_out]`);
      } else {
        filterParts.push(`[${lastVideoNode}]null[v_out]`);
      }

      // Audio
      const hasAudio = hasAudioStream(params.sourceVideoPath!);
      let hasAudioOut = false;

      if (hasAudio && boomIdx !== -1 && whooshIdx !== -1) {
        const amixInputs: string[] = ["[a_orig]", "[sfx_boom]", "[sfx_whoosh]"];
        filterParts.push(
          `[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a_orig]`,
          `[${boomIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=0|0,volume=0.22[sfx_boom]`,
          `[${whooshIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=3600|3600,volume=0.18[sfx_whoosh]`
        );

        if (hasFourCards && params.enableMotionGraphic !== false) {
          const b1DelayMs = Math.round(tB1Start * 1000);
          const b2DelayMs = Math.round(tB2Start * 1000);
          const b3DelayMs = Math.round(tB3Start * 1000);
          filterParts.push(
            `[${whooshIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=${b1DelayMs}|${b1DelayMs},volume=0.15[sfx_b1]`,
            `[${whooshIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=${b2DelayMs}|${b2DelayMs},volume=0.15[sfx_b2]`,
            `[${whooshIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=${b3DelayMs}|${b3DelayMs},volume=0.15[sfx_b3]`
          );
          amixInputs.push("[sfx_b1]", "[sfx_b2]", "[sfx_b3]");
        }

        filterParts.push(
          `${amixInputs.join("")}amix=inputs=${amixInputs.length}:duration=first:dropout_transition=2[a_out]`
        );
        hasAudioOut = true;
      }

      const audioArgs = hasAudioOut
        ? ["-map", "[a_out]"]
        : (hasAudio ? ["-map", "0:a"] : []);

      ffmpegArgs = [
        ...inputs,
        "-filter_complex",
        filterParts.join(";"),
        "-map",
        "[v_out]",
        ...audioArgs,
        ...encoderArgs,
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        "-t",
        String(duration),
        targetTmp,
      ];
    }

    try {
      console.log(`[Renderer] Memulai rendering video 9:16 Pod-Framing (-threads 3) untuk ${params.clipId}...`);
      await execFileAsync(ffmpegPath, ffmpegArgs, { timeout: 600000 });

      if (fs.existsSync(targetTmp)) {
        if (fs.existsSync(outputFilePath)) {
          try {
            fs.unlinkSync(outputFilePath);
          } catch {}
        }
        fs.renameSync(targetTmp, outputFilePath);

        // Mirror to backend/outputs/
        try {
          const backendOutputsDir = path.resolve(process.cwd(), "../../backend/outputs");
          if (!fs.existsSync(backendOutputsDir)) {
            fs.mkdirSync(backendOutputsDir, { recursive: true });
          }
          fs.copyFileSync(outputFilePath, path.join(backendOutputsDir, outputFileName));
        } catch {}
      }
    } catch (err: any) {
      if (fs.existsSync(targetTmp)) {
        try {
          fs.unlinkSync(targetTmp);
        } catch {}
      }
      console.error("[Renderer] FFmpeg rendering gagal:", err?.message);
      throw new HttpError(
        500,
        "RENDER_FAILED",
        `FFmpeg gagal merender klip video vertikal podcast: ${err?.message}`
      );
    }

    if (!fs.existsSync(outputFilePath)) {
      throw new HttpError(
        500,
        "RENDER_OUTPUT_NOT_FOUND",
        "File hasil render video vertikal tidak ditemukan di direktori output."
      );
    }

    // [FASE 5: AUTO-CLEANUP FILE SEMENTARA SETELAH MP4 FINAL SELESAI]
    if (params.teaserVideoPath && fs.existsSync(params.teaserVideoPath)) {
      try {
        fs.unlinkSync(params.teaserVideoPath);
        console.log(`[Renderer] Auto-cleanup teaser video: ${params.teaserVideoPath}`);
      } catch {}
    }

    if (params.topHookBannerPngPath && fs.existsSync(params.topHookBannerPngPath)) {
      try {
        fs.unlinkSync(params.topHookBannerPngPath);
        console.log(`[Renderer] Auto-cleanup top hook banner: ${params.topHookBannerPngPath}`);
      } catch {}
    }

    if (params.fourCards) {
      for (const p of [
        params.fourCards.card0Path,
        params.fourCards.card1Path,
        params.fourCards.card2Path,
        params.fourCards.card3Path,
      ]) {
        try {
          if (p && fs.existsSync(p)) {
            fs.unlinkSync(p);
            console.log(`[Renderer] Auto-cleanup infographic card: ${p}`);
          }
        } catch {}
      }
    }

    if (params.motionHeaderVideoPath && fs.existsSync(params.motionHeaderVideoPath)) {
      try {
        fs.unlinkSync(params.motionHeaderVideoPath);
        console.log(`[Renderer] Auto-cleanup motion header: ${params.motionHeaderVideoPath}`);
      } catch {}
    }

    if (params.animatedHeaderTrackPath && fs.existsSync(params.animatedHeaderTrackPath)) {
      try {
        fs.unlinkSync(params.animatedHeaderTrackPath);
        console.log(`[Renderer] Auto-cleanup animated header track: ${params.animatedHeaderTrackPath}`);
      } catch {}
    }

    if (params.assSubtitlePath && fs.existsSync(params.assSubtitlePath)) {
      try {
        fs.unlinkSync(params.assSubtitlePath);
        console.log(`[Renderer] Auto-cleanup subtitle .ass: ${params.assSubtitlePath}`);
      } catch {}
    }

    if (params.tempJobDir && fs.existsSync(params.tempJobDir)) {
      try {
        fs.rmSync(params.tempJobDir, { recursive: true, force: true });
        console.log(`[Renderer] Auto-cleanup direktori sementara job: ${params.tempJobDir}`);
      } catch {}
    }

    const stat = fs.statSync(outputFilePath);
    const fileSizeMb = Math.round((stat.size / (1024 * 1024)) * 10) / 10;

    console.log(`[Renderer] Render selesai: ${outputFileName} (${fileSizeMb} MB, ${duration}s, 30 FPS)`);

    return {
      clipId: params.clipId,
      outputFilePath,
      fileName: outputFileName,
      fileSizeMb: Math.max(0.5, fileSizeMb),
      durationSec: duration,
      resolution: "1080x1920 (9:16)",
      publicUrl: `/api/video/${outputFileName}`,
    };
  });
}
