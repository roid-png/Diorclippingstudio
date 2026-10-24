import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getFfmpegPath } from "../../utils/ffmpeg-path";
import { getOutputsDir, getTempDir } from "../downloader";
import { type RenderResult } from "../video-renderer.service";
import { getOrBuildBottomVignettePng } from "../satori_hook_builder";
import { getFontsDirPath } from "../ass-generator.service";
import type { UniversalParametricBlueprint } from "./universal_style_analyzer";
import type { UniversalStyleBlueprint } from "./universal_blueprint_schema";
import { trackParametricCamera } from "./parametric_camera_tracker";
import { renderParametricOpeningHook } from "./parametric_overlay_renderer";
import {
  generateParametricAssSubtitles,
  type WordTimestamp,
} from "./clone_subtitle_generator";
import {
  resolveBgmTrackPath,
  buildAudioDuckingFilterComplex,
} from "../audio_mixer";
import {
  buildFfmpegColorFilter,
  type ColorGradeParameters,
} from "../color_grade_service";

const execFileAsync = promisify(execFile);

function escapeFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}

export interface UniversalCloneClipInput {
  clipId: string;
  sourceVideoPath: string;
  durationSec: number;
  words: WordTimestamp[];
  headline?: string;
  speakerName?: string;
  blueprint: UniversalParametricBlueprint | UniversalStyleBlueprint | any;
  tempJobDir?: string;
  fontFamily?: string;
  enableTopMotion?: boolean;
  enableBottomMotion?: boolean;
  animatedHeaderTrackPath?: string;
  accentColor?: string;
  bgmTrackId?: string;
  bgmFilePath?: string;
  bgmBaseVolume?: number;
  duckingDepthDb?: number;
}

/**
 * [FASE 1 & 3: PERAKIT FFMPEG KHUSUS JALUR CLONE (ISOLATED CLONE COMPOSITOR)]
 * Menjalankan render 100% berdasarkan blueprint parametrik tanpa menyentuh modul reguler.
 */
export async function runUniversalCloneCompositor(
  input: UniversalCloneClipInput
): Promise<RenderResult> {
  const { clipId, sourceVideoPath, durationSec, words, blueprint } = input;
  const tempDir = input.tempJobDir || getTempDir(`temp/clone_job_${clipId}`);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const outputsDir = getOutputsDir();
  const finalOutputPath = path.join(outputsDir, `dior_${clipId}.mp4`);
  const ffmpegExe = getFfmpegPath();

  console.log(`[UniversalClone] Memulai perakitan video klip clone #${clipId} (${durationSec}s)...`);

  // 1. Jalankan Parametric Camera Tracking
  const transcriptText = words.map((w) => w.word).join(" ");
  const cameraResult = await trackParametricCamera({
    videoPath: sourceVideoPath,
    startTimeSec: 0,
    durationSec,
    blueprint,
    transcriptText,
  });

  // 2. Render Opening Hook jika diaktifkan di blueprint DAN top motion TIDAK aktif
  // [FASE 8 ANTI-COLLISION]: Jika Top Motion aktif, top motion track (1080x480) sudah memuat judul hook secara kinetik,
  // sehingga hook standalone tidak perlu di-render agar tidak terjadi penumpukan teks ganda di bagian atas.
  let hookMovPath: string | undefined = undefined;
  const hasHook =
    blueprint.opening_hook?.has_special_opening_text ??
    blueprint.opening_hook_engine?.enabled ??
    false;
  const hookDurationSec =
    blueprint.opening_hook?.active_end_sec ??
    blueprint.opening_hook_engine?.active_zone_end_sec ??
    6.0;

  const hasTopMotion = Boolean(
    input.enableTopMotion &&
    input.animatedHeaderTrackPath &&
    fs.existsSync(input.animatedHeaderTrackPath)
  );

  if (!hasTopMotion && hasHook) {
    const hookDest = path.join(tempDir, `hook_${clipId}.mov`);
    const hookDuration = Math.min(durationSec, hookDurationSec);
    const renderedHook = await renderParametricOpeningHook({
      destinationPath: hookDest,
      durationSec: hookDuration,
      spokenWords: words,
      summaryHeadline: input.headline,
      blueprint,
    });
    if (renderedHook && fs.existsSync(renderedHook)) {
      hookMovPath = renderedHook;
    }
  }

  // 3. Generate Subtitle Parametrik ASS (dengan proteksi bottom motion margin)
  const assPath = path.join(tempDir, `sub_${clipId}.ass`);
  generateParametricAssSubtitles({
    clipId,
    words,
    durationSec,
    blueprint,
    outputFilePath: assPath,
    fontFamily: input.fontFamily,
    enableBottomMotion: input.enableBottomMotion,
  });

  // 4. Bangun FFmpeg Command & Filter Graph
  const inputs: string[] = ["-y", "-i", sourceVideoPath];
  let nextInputIdx = 1;

  let bottomVignetteIdx = -1;
  const vignetteStrength =
    blueprint?.canvas_framing?.bottom_vignette_strength ??
    blueprint?.canvas_and_framing?.backdrop_composition?.bottom_ambient_vignette?.opacity ??
    0.65;
  if (vignetteStrength > 0) {
    const vignettePath = await getOrBuildBottomVignettePng();
    if (fs.existsSync(vignettePath)) {
      inputs.push("-i", vignettePath);
      bottomVignetteIdx = nextInputIdx++;
    }
  }

  let topMotionInputIdx = -1;
  if (hasTopMotion && input.animatedHeaderTrackPath) {
    inputs.push("-i", input.animatedHeaderTrackPath);
    topMotionInputIdx = nextInputIdx++;
  }

  let hookInputIdx = -1;
  if (hookMovPath && fs.existsSync(hookMovPath)) {
    inputs.push("-i", hookMovPath);
    hookInputIdx = nextInputIdx++;
  }

  // [FASE 1: AUTO-DUCKING BACKGROUND MUSIC COMPONENT]
  let bgmInputIdx = -1;
  const bgmTrack = input.bgmFilePath || input.bgmTrackId || blueprint?.audio?.bgm_track_id;
  const resolvedBgm = resolveBgmTrackPath(bgmTrack);
  if (resolvedBgm && fs.existsSync(resolvedBgm)) {
    inputs.push("-i", resolvedBgm);
    bgmInputIdx = nextInputIdx++;
  }

  // [FASE 3: ADAPTIVE COLOR GRADING ENGINE]
  const gradeParams: ColorGradeParameters = {
    contrast: Number(blueprint?.color_grade?.contrast ?? blueprint?.color_science_and_atmosphere?.lut_contrast ?? 1.04),
    brightness: Number(blueprint?.color_grade?.brightness ?? 0.02),
    saturation: Number(blueprint?.color_grade?.saturation ?? blueprint?.color_science_and_atmosphere?.lut_saturation ?? 1.08),
    gamma_r: Number(blueprint?.color_grade?.gamma_r ?? 1.02),
    gamma_g: Number(blueprint?.color_grade?.gamma_g ?? 1.00),
    gamma_b: Number(blueprint?.color_grade?.gamma_b ?? 0.98),
    filmGrainIntensity: Number(blueprint?.color_science_and_atmosphere?.texture_overlays?.film_grain_intensity ?? blueprint?.color_grade?.film_grain_intensity ?? 0),
    lutPath: blueprint?.color_grade?.lut_file_path || blueprint?.color_science_and_atmosphere?.lut_file_path,
  };
  const colorGradingFilter = buildFfmpegColorFilter(gradeParams);

  const filterParts: string[] = [];

  // Base canvas video filter
  filterParts.push(`[0:v]fps=30,${cameraResult.ffmpegCompositeFilter},${colorGradingFilter}[v_base]`);

  let lastNode = "v_base";

  // Overlay Vignette
  if (bottomVignetteIdx !== -1) {
    filterParts.push(`[${lastNode}][${bottomVignetteIdx}:v]overlay=x=0:y=0:format=auto[v_vignette]`);
    lastNode = "v_vignette";
  }

  // [FASE 8: Overlay Top Motion Animation Track (1080x480)]
  if (topMotionInputIdx !== -1) {
    filterParts.push(`[${lastNode}][${topMotionInputIdx}:v]overlay=x=0:y=0:format=auto[v_top_motion]`);
    lastNode = "v_top_motion";
  }

  // Overlay Opening Hook Track (hanya jika top motion tidak aktif)
  if (hookInputIdx !== -1) {
    const hookEnd =
      blueprint?.opening_hook?.active_end_sec ??
      blueprint?.opening_hook_engine?.active_zone_end_sec ??
      6.0;
    filterParts.push(
      `[${lastNode}][${hookInputIdx}:v]overlay=x=0:y=0:enable='between(t,0,${Number(hookEnd).toFixed(2)})':format=auto[v_hook]`
    );
    lastNode = "v_hook";
  }

  // [FASE 8: Overlay Bottom Motion Graphic (Dynamic Progress Bar & Ambient Glow)]
  if (input.enableBottomMotion) {
    const rawAccent = input.accentColor || blueprint?.color_grade?.accent_color || "#2cd3c6";
    const accentHex = rawAccent.startsWith("#") ? rawAccent : `#${rawAccent}`;
    filterParts.push(
      `[${lastNode}]drawbox=x=0:y=1896:w=1080:h=14:color=black@0.45:t=fill,drawbox=x=0:y=1896:w='min(1080,1080*(t/${durationSec}))':h=14:color=${accentHex}@0.95:t=fill,drawbox=x=0:y=1894:w='min(1080,1080*(t/${durationSec}))':h=2:color=white@0.6:t=fill[v_bottom_motion]`
    );
    lastNode = "v_bottom_motion";
  }

  // Overlay ASS Subtitle
  let finalVideoNode = `[${lastNode}]`;
  if (fs.existsSync(assPath)) {
    const fontsDir = getFontsDirPath();
    const safeFontsDir = fontsDir ? escapeFilterPath(fontsDir) : "";
    const safeAssPath = escapeFilterPath(assPath);
    const fontsDirParam = safeFontsDir && fs.existsSync(fontsDir) ? `:fontsdir='${safeFontsDir}'` : "";
    filterParts.push(`[${lastNode}]ass='${safeAssPath}'${fontsDirParam}[v_sub]`);
    finalVideoNode = "[v_sub]";
  }

  // [FASE 1: INTEGRASI AUDIO DUCKING & NORMALISASI LOUDNORM]
  let finalAudioMap: string[] = ["-map", "0:a?"];
  if (bgmInputIdx !== -1) {
    const ducking = buildAudioDuckingFilterComplex(
      "[0:a]",
      bgmInputIdx,
      {
        bgmBaseVolume: input.bgmBaseVolume ?? 0.15,
        duckingDepthDb: input.duckingDepthDb ?? -20,
        hookDelaySec: 4.5,
        enableLoudnorm: true,
      },
      "a_final"
    );
    filterParts.push(...ducking.filterParts);
    finalAudioMap = ["-map", `[${ducking.outputLabel}]`];
  }

  const filterComplex = filterParts.join(";");

  const ffmpegArgs = [
    ...inputs,
    "-filter_complex", filterComplex,
    "-map", finalVideoNode,
    ...finalAudioMap,
    "-threads", "0",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-tune", "fastdecode",
    "-crf", "22",
    "-c:a", "aac",
    "-b:a", "192k",
    "-t", String(durationSec),
    finalOutputPath,
  ];

  console.log(`[UniversalClone] Menjalankan FFmpeg compositor untuk klip #${clipId}...`);
  await execFileAsync(ffmpegExe, ffmpegArgs, { timeout: 180000 });

  if (!fs.existsSync(finalOutputPath)) {
    throw new Error(`FFmpeg Universal Clone gagal menghasilkan file output di ${finalOutputPath}`);
  }

  console.log(`[UniversalClone] Video klip clone 100% selesai dirender: ${finalOutputPath}`);

  const stats = fs.statSync(finalOutputPath);
  const fileSizeMb = Number((stats.size / (1024 * 1024)).toFixed(2));
  const fileName = path.basename(finalOutputPath);

  return {
    clipId,
    outputFilePath: finalOutputPath,
    fileName,
    fileSizeMb,
    durationSec,
    resolution: "1080x1920",
    publicUrl: `/api/video/${fileName}`,
  };
}
