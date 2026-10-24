import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "../db";
import { projects, clips, renderJobs } from "../db/schema";
import { getFfmpegPath, getVideoDurationSeconds } from "../utils/ffmpeg-path";
import {
  getYoutubeMetadata,
  downloadAudioOnly,
  downloadPrecisionSection,
  getTempDir,
  getOutputsDir,
  hasVideoStream,
} from "./downloader";
import {
  transcribeAudioWordLevel,
  curateViralMomentsWithGemini,
  curateViralMomentsFromFullAudioFile,
  type CuratedViralClip,
  type WordTimestamp,
} from "./ai-curator.service";
import { extractFullMasterAudio, extractOptimizedAudio } from "./transcriber";
import { getPresetById, listAllPresets, type VideoPreset } from "./presets.service";
import { generateAssSubtitleFile } from "./ass-generator.service";
import { renderVerticalClip, type RenderResult } from "./video-renderer.service";
import { extractAudioSliceAndTranscribe } from "./groq_transcriber";
import { generateInfographicMetadata, renderInfographicPng } from "./infographic_builder";
import {
  renderHookOverlayPng,
  renderTopHookBannerPng,
  renderExplanationBeatCardPng,
  renderAllFourInfographicCards,
  type GeneratedFourCardsResult,
} from "./satori_hook_builder";
import { generateAnimatedHeaderTrack, generateInSceneKineticHookTrack } from "./fast_canvas_motion";
import { trackActiveSpeaker } from "./speaker_tracker";
import { updateJobProgress } from "./job_progress_manager";
import {
  cleanTextForRender,
  extractClimaxHeadlineFromTranscript,
  analyzeClipMotionArchetype,
  batchAnalyzeMotionArchetypes,
  batchAnalyzeExecutiveHooks,
  renderMotionHeaderVideo,
  generateFallbackExplanationBeats,
  generateSequentialExplanationBeats,
  analyzeClipExplanationBeatsWithGemini,
  analyzeSegmentBeatsWithDualAI,
  type ExplanationBeat,
} from "./motion_director";
import {
  runUniversalCloneCompositor,
  getActiveTempCloneBlueprint,
  type UniversalParametricBlueprint,
} from "./clone_engine";
import { matchOptimalBgmOffsetWithGroq, sliceBgmForClip } from "./audio_mixer";
import { pLimit } from "../utils/p-limit";
import { cleanupTempFiles } from "./cleanup.service";
import { HttpError } from "../lib/http-error";
import { eq } from "drizzle-orm";

const execFileAsync = promisify(execFile);

// Concurrency Limiters for Phase 5 (Optimized for 8GB RAM / i5-8250U: single video render queue)
const groqTranscriptionLimit = pLimit(3);
const videoRenderLimit = pLimit(1);

function getJobClipDir(projectId: string, clipId: string): string {
  const dir = path.resolve(`backend/temp_jobs/job_${projectId}/clip_${clipId}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export type CompositionMode = "POTONG_MURNI" | "HOOK_ONLY" | "MOTION_ONLY" | "PAKET_LENGKAP";
export type PipelineMode = "raw_cut" | "clean_subtitle" | "netflix_editorial" | "clone_only";

export interface PipelineGenerateInput {
  youtubeUrl: string;
  clipCount?: number;
  maxClips?: number; // 1 to 10
  targetDuration?: number;
  clipDuration?: number; // 30, 45, or 60
  pipelineMode?: PipelineMode;
  presetId?: string; // e.g. "viral-motion", "netflix-cinematic"
  subtitleFont?: string;
  fontFamily?: string;
  enableHook?: boolean;
  enableCinematicHook?: boolean;
  enablePolish?: boolean;
  colorPolish?: boolean;
  enableMotionGraphic?: boolean;
  enableExplanationBeats?: boolean;
  compositionMode?: CompositionMode;
  hookFont?: string;
  userId?: string;
  tempCloneBlueprint?: UniversalParametricBlueprint;
  useTempCloneBlueprint?: boolean;
  enableCloneTopMotion?: boolean;
  enableCloneBottomMotion?: boolean;
  enableTopMotion?: boolean;
  enableBottomMotion?: boolean;
  jobId?: string;
  bgmAudioPath?: string;
  enableBgmDucking?: boolean;
  bgmBaseVolume?: number;
  duckingDepthDb?: number;
}

export interface GeneratedClipResult {
  id: string;
  rank: number;
  title: string;
  duration: number;
  viralScore: number;
  viralReason: string;
  hookDescription: string;
  videoUrl: string;
  downloadUrl: string;
  fileSizeMb: number;
  presetName: string;
  status: "completed" | "processing" | "failed";
  startTime?: number;
  endTime?: number;
}

export interface PipelineGenerateResponse {
  projectId: string;
  videoTitle: string;
  duration: number;
  thumbnail: string;
  youtubeUrl: string;
  preset: VideoPreset;
  clips: GeneratedClipResult[];
  processedAt: string;
}

/**
 * Executes the complete real pipeline:
 * 1. Metadata extraction (yt-dlp)
 * 2. Low-format audio stream extraction (yt-dlp)
 * 3. Word-level transcription (Groq Whisper-large-v3)
 * 4. Viral curation (Gemini 2.5 Flash)
 * 5. Precision section download & 9:16 vertical rendering (.ass subtitles, color grading, progress bar)
 * 6. Immediate audio/temp cleanup
 */
export async function executeRealPipeline(input: PipelineGenerateInput): Promise<PipelineGenerateResponse> {
  const userId = input.userId || "user-creator-demo";
  const youtubeUrl = input.youtubeUrl.trim();
  const rawClipCount = input.clipCount ?? input.maxClips;
  const clipCount = Math.min(Math.max(1, Number(rawClipCount) || 5), 10);
  const maxClips = clipCount;

  const rawTargetDuration = input.targetDuration ?? input.clipDuration;
  const clipDuration = [30, 45, 60].includes(Number(rawTargetDuration))
    ? Number(rawTargetDuration)
    : 45;
  const targetDuration = clipDuration;

  const rawPipelineMode = input.pipelineMode;
  let pipelineMode: PipelineMode = "netflix_editorial";
  if (
    rawPipelineMode === "raw_cut" ||
    rawPipelineMode === "clean_subtitle" ||
    rawPipelineMode === "netflix_editorial" ||
    rawPipelineMode === "clone_only"
  ) {
    pipelineMode = rawPipelineMode;
  } else if (input.compositionMode === "POTONG_MURNI") {
    pipelineMode = "raw_cut";
  }

  // 1. Resolve preset (supporting Clone Saja mode)
  let preset: VideoPreset | null = null;
  if (input.presetId && input.presetId !== "clone_only") {
    preset = await getPresetById(input.presetId);
  }
  if (!preset && (input.presetId === "clone_only" || pipelineMode === "clone_only")) {
    preset = (await getPresetById("ai-cloned")) || (await listAllPresets()).find((p) => p.isCloned) || null;
  }
  if (!preset) {
    const all = await listAllPresets();
    preset = all[0] || (await getPresetById("viral-motion"))!;
  }

  const presetId = preset.id;
  const subtitleFont = input.subtitleFont || input.fontFamily || preset.subtitleStyle?.fontName || "Montserrat ExtraBold";

  const enableHook = input.enableHook !== undefined
    ? input.enableHook
    : input.enableCinematicHook !== undefined
    ? input.enableCinematicHook
    : (preset.enableHook !== false);

  const enablePolish = input.enablePolish !== undefined
    ? input.enablePolish
    : input.colorPolish !== undefined
    ? input.colorPolish
    : (preset.enablePolish !== false);

  const isRawCut = pipelineMode === "raw_cut";
  const isCleanSubtitle = pipelineMode === "clean_subtitle";
  const isNetflixEditorial = pipelineMode === "netflix_editorial";
  const isCloneOnly = pipelineMode === "clone_only";

  const isCloneTopMotion =
    input.enableCloneTopMotion !== undefined
      ? input.enableCloneTopMotion
      : input.enableTopMotion !== undefined
      ? input.enableTopMotion
      : Boolean(preset.enableTopMotion);

  const isCloneBottomMotion =
    input.enableCloneBottomMotion !== undefined
      ? input.enableCloneBottomMotion
      : input.enableBottomMotion !== undefined
      ? input.enableBottomMotion
      : false;

  const isColdOpenTeaser = (isNetflixEditorial || isCloneOnly) && enableHook && (preset.enableHook !== false);
  const shouldGenerateMotionHeader =
    isNetflixEditorial ||
    (isCloneOnly && isCloneTopMotion) ||
    Boolean(input.enableTopMotion);
  const shouldGenerateSubtitle = !isRawCut;
  const shouldEnableSfx = (isNetflixEditorial || isCloneOnly) && enablePolish;
  const shouldEnableCinemaFrame = enablePolish;
  const shouldColorPolish = enablePolish;

  // 2. Extract metadata
  console.log(`[Pipeline] 1/5: Mengekstrak metadata YouTube untuk ${youtubeUrl}...`);
  updateJobProgress(input.jobId, {
    status: "downloading",
    step: 1,
    stepName: "Unduh Sumber",
    percent: 10,
    message: "Langkah 1/3: Mengekstrak metadata & audio YouTube...",
  });
  const meta = await getYoutubeMetadata(youtubeUrl);

  const projectId = randomUUID();

  // Create project in DB
  try {
    await db.insert(projects).values({
      id: projectId,
      userId,
      youtubeUrl,
      videoTitle: meta.title,
      videoDuration: meta.duration,
      clipDuration,
      maxClips,
      editStyle: preset.id,
      stage: "processing",
      status: "processing",
    });
  } catch {}

  // 3. Download full master audio stream
  console.log(`[Pipeline] [1/4] Mengekstrak audio penuh (durasi: ${(meta.duration / 60).toFixed(1)} menit)...`);
  updateJobProgress(input.jobId, {
    status: "downloading",
    step: 1,
    stepName: "Unduh Sumber",
    percent: 20,
    message: `Langkah 1/3: Mengunduh audio YouTube (${(meta.duration / 60).toFixed(1)} menit)...`,
  });
  const audioPath = await downloadAudioOnly(youtubeUrl, `audio_${projectId}`);

  // 4. Single-Call Full Audio Viral Curation (Google Gemini Curator)
  console.log(`[Pipeline] [2/4] Menganalisis momen viral dengan Gemini AI...`);
  updateJobProgress(input.jobId, {
    status: "analyzing",
    step: 2,
    stepName: "Analisis Momen Viral",
    percent: 35,
    message: "Langkah 2/3: Mentranskripsi kata & mengkurasi momen viral (Gemini 3.8 Flash)...",
  });
  let curatedMoments: CuratedViralClip[] = [];
  try {
    curatedMoments = await curateViralMomentsFromFullAudioFile({
      audioFilePath: audioPath,
      totalDurationSeconds: meta.duration,
      targetDurationSec: clipDuration,
      maxClips,
      videoTitle: meta.title,
    });
  } finally {
    // Clean up temporary audio file after transcription
    try {
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    } catch {}
  }

  // 6. Sequential Isolated Processing & 9:16 vertical render (Ultra-light, Zero RAM Freeze)
  console.log(`[Pipeline] [3/4] Menghasilkan subtitle presisi kata-per-kata via Groq Whisper...`);
  console.log(`[Pipeline] [4/4] Merender video klip 9:16 secara sekuensial (hemat RAM & CPU)...`);

  const generatedClips: GeneratedClipResult[] = [];

  for (let i = 0; i < curatedMoments.length; i++) {
    const moment = curatedMoments[i]!;
    const clipPct = Math.round(35 + (i / curatedMoments.length) * 60);
    updateJobProgress(input.jobId, {
      status: "rendering",
      step: 3,
      stepName: "Auto-Cut 9:16",
      percent: clipPct,
      currentClipIndex: i + 1,
      totalClips: curatedMoments.length,
      clipTitle: moment.title,
      message: `Langkah 3/3: Merender Klip ${i + 1} dari ${curatedMoments.length}: "${moment.title}"...`,
    });
    console.log(`[Pipeline] === [Klip ${i + 1}/${curatedMoments.length}] Memproses: "${moment.title}" ===`);
    try {
      const clipId = randomUUID();
      const clipDir = getJobClipDir(projectId, clipId);
      const sectionPath = path.join(clipDir, `section_${clipId}.mp4`);

      // 1. Precision section download via yt-dlp
      const downloadedPath = await downloadPrecisionSection({
        youtubeUrl,
        startTimeSec: moment.start_time,
        endTimeSec: moment.end_time,
        outputFilePath: sectionPath,
      });

      // 2. Groq Acoustic Sliced Transcription
      let clipWords = moment.words || [];
      let fullClipTranscript = "";
      try {
        const groqRes = await groqTranscriptionLimit(() =>
          extractAudioSliceAndTranscribe({
            videoPath: downloadedPath,
            startTimeSec: 0,
            endTimeSec: moment.duration,
            outputDir: clipDir,
            clipId,
          })
        );
        if (groqRes.words && groqRes.words.length > 0) {
          clipWords = groqRes.words;
        }
        if (groqRes.text) {
          fullClipTranscript = groqRes.text.trim();
        }
      } catch (groqErr: any) {
        console.warn(`[Pipeline] Groq slice transcription fallback ke kata kurasi:`, groqErr?.message);
      }

      // Pastikan fullClipTranscript tidak boleh kosong
      if (!fullClipTranscript && clipWords.length > 0) {
        fullClipTranscript = clipWords.map((w) => w.word).join(" ").trim();
      }
      if (!fullClipTranscript) {
        fullClipTranscript = cleanTextForRender(moment.hook_description || moment.title);
      }

      // [FASE 2: PIPELINE SINKRONISASI SEGMENTASI WAKTU KE DUAL-AI ENGINE]
      // Slicing 4 segmen waktu:
      // - Segmen 0 (Hook): 00:00 - 00:04 (4 detik pertama)
      // - Segmen 1 (Poin 1): 00:04 - 00:18
      // - Segmen 2 (Poin 2): 00:18 - 00:33
      // - Segmen 3 (Poin 3): 00:33 - selesai
      const hookWords = clipWords.filter((w) => w.end <= 4.2 || (w.start < 4.0 && w.end <= 5.0));
      const p1Words = clipWords.filter((w) => w.start >= 3.8 && w.start < 18.2);
      const p2Words = clipWords.filter((w) => w.start >= 17.8 && w.start < 33.2);
      const p3Words = clipWords.filter((w) => w.start >= 32.8);

      let seg0Text = hookWords.map((w) => w.word).join(" ").trim();
      let seg1Text = p1Words.map((w) => w.word).join(" ").trim();
      let seg2Text = p2Words.map((w) => w.word).join(" ").trim();
      let seg3Text = p3Words.map((w) => w.word).join(" ").trim();

      const allTokens = fullClipTranscript.split(/\s+/).filter(Boolean);
      if (!seg0Text) seg0Text = allTokens.slice(0, Math.min(10, allTokens.length)).join(" ");
      if (!seg1Text) seg1Text = allTokens.slice(10, Math.min(30, allTokens.length)).join(" ");
      if (!seg2Text) seg2Text = allTokens.slice(30, Math.min(50, allTokens.length)).join(" ");
      if (!seg3Text) seg3Text = allTokens.slice(50).join(" ") || allTokens.slice(20).join(" ");

      // [FASE 3: DUAL-AI ENGINE PADA MOTION DIRECTOR - DYNAMIC ART VARIATION]
      let cleanHeadline = cleanTextForRender(moment.title) || "SOROTAN UTAMA TOPIK";
      let rawBeats: ExplanationBeat[] = [];
      let hookKicker = moment.top_banner_tag || "VIRAL CLIP";
      let hookSubtext = cleanTextForRender(moment.hook_description) || "DATA TERVERIFIKASI";
      let detectedStyleVariant: number | undefined = undefined;
      let detectedAccentHex: string = preset.accentColor || "#E50914";
      let detectedLucideIcon: string = "Flame";
      let detectedVibe: string = "Cinematic Motion";

      if (shouldGenerateMotionHeader) {
        try {
          const dualAIResult = await analyzeSegmentBeatsWithDualAI({
            clipId,
            title: moment.title,
            duration: moment.duration,
            segments: {
              hook: seg0Text,
              part1: seg1Text,
              part2: seg2Text,
              part3: seg3Text,
            },
            accentHex: preset.accentColor || "#E50914",
          });
          cleanHeadline = dualAIResult.hook.headline || cleanHeadline;
          hookKicker = dualAIResult.hook.kicker || hookKicker;
          hookSubtext = dualAIResult.hook.subtext || hookSubtext;
          rawBeats = dualAIResult.beats;
          detectedStyleVariant = dualAIResult.style_variant;
          if (dualAIResult.accent_hex) detectedAccentHex = dualAIResult.accent_hex;
          if (dualAIResult.hook.lucide_icon) detectedLucideIcon = dualAIResult.hook.lucide_icon;
          if (dualAIResult.vibe_description) detectedVibe = dualAIResult.vibe_description;
        } catch {
          rawBeats = generateFallbackExplanationBeats(
            moment.duration,
            moment.top_banner_steps,
            moment.top_banner_tag,
            preset.accentColor || "#E50914"
          );
          detectedStyleVariant = (i % 8);
        }
      }

      moment.hook_category = hookKicker;
      moment.hook_headline = cleanHeadline;
      moment.top_banner_tag = hookKicker;
      moment.top_banner_title = cleanHeadline;
      moment.title = cleanHeadline;
      moment.hook_subtext = hookSubtext;

      // 3. Fast Synchronous Motion & Hook Config from curated metadata (Zero API Latency)
      const motionConfig = {
        clipId,
        archetype: "AUDIO_RADAR" as const,
        headline: cleanHeadline,
        accent_color: detectedAccentHex,
        motion_values: {
          lucideIcon: detectedLucideIcon,
        },
        tag: hookKicker,
        title: cleanHeadline,
        hookMetadata: {
          clip_id: clipId,
          speaker_name: cleanTextForRender(moment.speaker_name) || "NARASUMBER",
          hook_category: hookKicker,
          hook_headline: cleanHeadline,
          hook_sub_metric: hookSubtext,
          lucide_icon: detectedLucideIcon,
          style_variant: detectedStyleVariant,
          accent_hex: detectedAccentHex,
          vibe_description: detectedVibe,
          explanation_beats: rawBeats,
        },
        hookQuote: cleanTextForRender(moment.hook_description) || cleanHeadline,
        speakerName: cleanTextForRender(moment.speaker_name) || "NARASUMBER",
      };

      // [FASE 1, 2, 3 & 6: MODULAR COMPOSITION MODE]
      const compositionMode = input.compositionMode || "PAKET_LENGKAP";
      const enableCinematicHook =
        compositionMode === "POTONG_MURNI" || compositionMode === "MOTION_ONLY"
          ? false
          : input.enableCinematicHook !== false;
      const enableExplanationBeats =
        compositionMode === "POTONG_MURNI" || compositionMode === "HOOK_ONLY"
          ? false
          : input.enableExplanationBeats !== false;

      let teaserVideoPath: string | undefined = undefined;
      let topHookBannerPngPath: string | undefined = undefined;
      let teaserDuration = 0;
      let teaserWords: WordTimestamp[] = [];

      if (isColdOpenTeaser) {
        // 1. Safe extraction of 3.5 - 4.5s climax teaser from downloaded segment
        const teaserStartAbs = moment.teaser_start ?? moment.start_time;
        const relTeaserStart = Math.max(0, teaserStartAbs - moment.start_time);
        teaserDuration = Math.min(
          4.5,
          Math.max(
            3.5,
            moment.teaser_duration ||
              (moment.teaser_end ? moment.teaser_end - teaserStartAbs : 4.0)
          )
        );

        const teaserFile = path.join(clipDir, `teaser_${clipId}.mp4`);
        try {
          const ffmpegExe = getFfmpegPath();
          await execFileAsync(
            ffmpegExe,
            [
              "-y",
              "-ss",
              relTeaserStart.toFixed(2),
              "-t",
              teaserDuration.toFixed(2),
              "-accurate_seek",
              "-i",
              downloadedPath,
              "-threads",
              "0",
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
              teaserFile,
            ],
            { timeout: 60000 }
          );

          if (fs.existsSync(teaserFile)) {
            teaserVideoPath = teaserFile;
            console.log(
              `[Pipeline] Teaser Hook diekstrak (${teaserDuration}s, relStart: ${relTeaserStart}s): ${teaserFile}`
            );
          }
        } catch (tErr: any) {
          console.warn(`[Pipeline] Gagal ekstrak teaser klip #${i + 1}:`, tErr?.message);
        }

        // 3. Filter spoken words within the teaser timeframe
        teaserWords = clipWords.filter(
          (w) =>
            w.end >= relTeaserStart &&
            w.start <= relTeaserStart + teaserDuration
        );
      }

      // [FASE 2: GENERATOR 4 KARTU INFOGRAFIS PASTI JADI (1 HOOK + 3 EXPLANATION BEATS)]
      let fourCards: GeneratedFourCardsResult | undefined = undefined;
      let animatedHeaderTrackPath: string | undefined = undefined;
      let motionHeaderPath: string | undefined = undefined;

      if (shouldGenerateMotionHeader) {
        const rawBeats: ExplanationBeat[] =
          motionConfig?.hookMetadata?.explanation_beats && motionConfig.hookMetadata.explanation_beats.length >= 3
            ? motionConfig.hookMetadata.explanation_beats
            : generateFallbackExplanationBeats(
                moment.duration,
                moment.top_banner_steps,
                moment.top_banner_tag,
                motionConfig?.accent_color || "#E50914"
              );

        // [FASE 3 & 4: TRUE ANIMATED HEADER TRACK GENERATOR (1080x480 - 8 DIVERSE STYLES)]
        try {
          const trackMov = path.join(clipDir, `animated_header_${clipId}.mov`);
          const isColdOpenTeaser = Boolean(moment.teaser_start !== undefined && moment.teaser_end !== undefined);
          const totalDurationSec = isColdOpenTeaser ? (teaserDuration + moment.duration) : moment.duration;
          const chosenStyleVariant =
            preset?.styleVariant !== undefined
              ? preset.styleVariant
              : detectedStyleVariant !== undefined
              ? detectedStyleVariant
              : (i % 8);
          const chosenAccent =
            (preset?.id !== "viral-motion" && preset?.accentColor && preset.accentColor !== "#E50914")
              ? preset.accentColor
              : detectedAccentHex;

          await generateAnimatedHeaderTrack({
            destinationPath: trackMov,
            totalDurationSec,
            teaserDurationSec: teaserDuration,
            hookCategory: moment.hook_category,
            hookHeadline: cleanHeadline,
            hookSubtext: cleanTextForRender(moment.hook_subtext || moment.hook_description || "DATA KUNCI TERVERIFIKASI"),
            accentColor: chosenAccent,
            explanationBeats: rawBeats,
            topBannerSteps: moment.top_banner_steps,
            styleVariant: chosenStyleVariant,
            clipIndex: i,
          });
          if (fs.existsSync(trackMov)) {
            animatedHeaderTrackPath = trackMov;
            console.log(`[Pipeline] Animated header track siap di klip #${i + 1} (Style: ${chosenStyleVariant}, Aksen: ${chosenAccent}): ${trackMov}`);
          }
        } catch (animErr: any) {
          console.warn(`[Pipeline] Animated header track notice:`, animErr?.message);
        }

        // Skip heavy card rendering if animated header track already exists
        if (!animatedHeaderTrackPath) {
          try {
            fourCards = await renderAllFourInfographicCards({
              clipDir,
              clipId,
              durationSec: moment.duration,
              teaserDurationSec: teaserDuration,
              hookCategory: moment.hook_category,
              hookHeadline: cleanHeadline,
              hookSubtext: cleanTextForRender(moment.hook_subtext || moment.hook_description || "DATA KUNCI TERVERIFIKASI"),
              accentColor: motionConfig?.accent_color || "#E50914",
              explanationBeats: rawBeats,
              topBannerSteps: moment.top_banner_steps,
              transcriptText: fullClipTranscript,
            });
            if (fourCards && fourCards.card0Path) {
              topHookBannerPngPath = fourCards.card0Path;
            }
          } catch (cardErr: any) {
            console.warn(`[Pipeline] Gagal render 4 kartu infografis klip #${i + 1}:`, cardErr?.message);
          }
        }
      }

      // 4. Generate .ass subtitle with multi-segment synchronization & zero collision clamping
      let assPath: string | undefined = undefined;
      if (shouldGenerateSubtitle) {
        assPath = path.join(clipDir, `subtitles_${clipId}.ass`);
        generateAssSubtitleFile({
          clipId,
          clipStartTimeSec: 0,
          clipEndTimeSec: moment.duration,
          words: clipWords,
          teaserWords: isColdOpenTeaser && teaserVideoPath ? teaserWords : undefined,
          teaserDurationSec: isColdOpenTeaser && teaserVideoPath ? teaserDuration : undefined,
          preset,
          speakerName: moment.speaker_name,
          topBannerTag: moment.top_banner_tag,
          topBannerTitle: moment.top_banner_title,
          topBannerSteps: moment.top_banner_steps,
          clipTitle: moment.title,
          fontFamily: subtitleFont,
          outputFilePath: assPath,
        });
      }

      // [FASE 2: DETEKSI PEMBICARA AKTIF & SMART CROP UNTUK FULL VERTICAL 9:16]
      let speakerCropFilter: string | undefined = undefined;
      const isFullVerticalTrack =
        preset.layoutArchitecture === "IN_SCENE_KINETIC_CLIPPER" ||
        preset.cameraFraming === "FULL_9_16_SPEAKER_TRACK";

      if (isFullVerticalTrack && downloadedPath) {
        try {
          const trackRes = await trackActiveSpeaker({
            videoPath: downloadedPath,
            startTimeSec: 0,
            durationSec: moment.duration,
            transcriptText: moment.hook_description || clipWords.map((w) => w.word).join(" "),
            speakerName: moment.speaker_name,
          });
          speakerCropFilter = trackRes.cropFilter;
        } catch (trackErr: any) {
          console.warn(`[Pipeline] Speaker tracking notice klip #${i + 1}:`, trackErr?.message);
        }
      }

      // [FASE 4: KINETIC HOOK AWAL 0-6 DETIK UNTUK IN_SCENE_KINETIC_CLIPPER]
      let inSceneKineticHookTrackPath: string | undefined = undefined;
      if (
        (isFullVerticalTrack ||
          preset.hookVisualType === "IN_SCENE_KINETIC_HOOK" ||
          preset.hookVisualType === "IN_SCENE_GLOW_TYPOGRAPHY") &&
        preset.enableHook !== false
      ) {
        try {
          const hookMovPath = path.join(clipDir, `kinetic_hook_${clipId}.mov`);
          await generateInSceneKineticHookTrack({
            destinationPath: hookMovPath,
            durationSec: Math.min(6.0, moment.duration),
            headline: moment.top_banner_title || moment.title,
            accentColor: preset.accentColor || "#FF6B00",
            transcriptWords: clipWords.filter((w) => w.start < 6.0),
          });
          if (fs.existsSync(hookMovPath)) {
            inSceneKineticHookTrackPath = hookMovPath;
          }
        } catch (hookErr: any) {
          console.warn(`[Pipeline] Kinetic hook render notice klip #${i + 1}:`, hookErr?.message);
        }
      }

      // [FASE 1: BGM PREPARATION & GROQ AI BACKSOUND MOMENT MATCHER]
      let clipBgmPath: string | undefined = undefined;
      const userBgm = input.bgmAudioPath;
      if (userBgm && fs.existsSync(userBgm)) {
        try {
          const matchResult = await matchOptimalBgmOffsetWithGroq({
            bgmPath: userBgm,
            clipDurationSec: moment.duration,
            clipTitle: moment.title,
            clipTranscript: fullClipTranscript || moment.hook_description,
          });
          const destCutBgm = path.join(clipDir, `bgm_cut_${clipId}.wav`);
          await sliceBgmForClip({
            inputBgmPath: userBgm,
            outputBgmPath: destCutBgm,
            startOffsetSec: matchResult.startOffsetSec,
            durationSec: moment.duration,
          });
          if (fs.existsSync(destCutBgm)) {
            clipBgmPath = destCutBgm;
            console.log(`[AudioMixer] Klip #${i + 1} BGM siap (offset: ${matchResult.startOffsetSec}s, durasi: ${moment.duration}s): ${matchResult.reason}`);
          }
        } catch (bgmErr: any) {
          console.warn(`[AudioMixer] BGM matching notice klip #${i + 1}:`, bgmErr?.message);
        }
      }

      // 5. Render Vertical 9:16 Video (Router: Universal Clone Engine vs Regular Pipeline)
      const activeBlueprint = input.tempCloneBlueprint || getActiveTempCloneBlueprint();
      const isUniversalCloneMode =
        Boolean(input.useTempCloneBlueprint) ||
        Boolean(preset.isUniversalClone) ||
        (Boolean(activeBlueprint) && (pipelineMode === "clone_only" || preset.isCloned || preset.id.startsWith("cloned-") || preset.id === "ai-cloned"));

      let renderRes: RenderResult;
      try {
        if (isUniversalCloneMode && activeBlueprint) {
          console.log(`[Pipeline] Menggunakan Pintu 2 (Universal Clone Pipeline) untuk klip #${i + 1}...`);
          renderRes = await videoRenderLimit(() =>
            runUniversalCloneCompositor({
              clipId,
              sourceVideoPath: downloadedPath,
              durationSec: moment.duration,
              words: clipWords,
              headline: moment.top_banner_title || moment.title,
              speakerName: moment.speaker_name,
              blueprint: activeBlueprint,
              tempJobDir: clipDir,
              fontFamily: subtitleFont,
              enableTopMotion: isCloneTopMotion,
              enableBottomMotion: isCloneBottomMotion,
              animatedHeaderTrackPath: isCloneTopMotion ? animatedHeaderTrackPath : undefined,
              accentColor: preset.accentColor || "#2cd3c6",
              bgmFilePath: clipBgmPath,
              bgmBaseVolume: input.bgmBaseVolume ?? 0.15,
              duckingDepthDb: input.duckingDepthDb ?? -20,
            })
          );
        } else {
          renderRes = await videoRenderLimit(() =>
            renderVerticalClip({
              clipId,
              sourceVideoPath: downloadedPath,
              teaserVideoPath,
              teaserDurationSec: teaserDuration,
              topHookBannerPngPath: fourCards?.card0Path || topHookBannerPngPath,
              fourCards,
              animatedHeaderTrackPath,
              inSceneKineticHookTrackPath,
              speakerCropFilter,
              enableExplanationBeats: shouldGenerateMotionHeader,
              assSubtitlePath: assPath,
              motionHeaderVideoPath: motionHeaderPath,
              enableHookOverlay: isColdOpenTeaser,
              enableCinemaFrame: shouldEnableCinemaFrame,
              enableSfx: shouldEnableSfx,
              colorPolish: shouldColorPolish,
              durationSec: moment.duration,
              preset,
              tempJobDir: clipDir, // auto-cleanup clipDir when done
              enableMotionGraphic: shouldGenerateMotionHeader,
              bgmFilePath: clipBgmPath,
              bgmBaseVolume: input.bgmBaseVolume ?? 0.15,
              duckingDepthDb: input.duckingDepthDb ?? -20,
            })
          );
        }
      } catch (mainRenderErr: any) {
        console.warn(
          `[Pipeline] Render utama klip #${i + 1} mengalami kendala (${mainRenderErr?.message}). Menjalankan emergency fallback render agar klip tidak hilang...`
        );
        renderRes = await videoRenderLimit(() =>
          renderVerticalClip({
            clipId,
            sourceVideoPath: downloadedPath,
            preset: { ...preset, layoutArchitecture: "FULL_VERTICAL_CROP", pipelineMode: "raw_cut", hookVisualType: "NONE" },
            tempJobDir: clipDir,
            durationSec: moment.duration,
            enableMotionGraphic: false,
            enableExplanationBeats: false,
            enableCinemaFrame: false,
            enableSfx: false,
            colorPolish: false,
          })
        );
      }

      // Save metadata for instant re-style
      try {
        const metaDir = getTempDir("temp/metadata");
        const metaPath = path.join(metaDir, `${clipId}.json`);
        fs.writeFileSync(
          metaPath,
          JSON.stringify(
            {
              clipId,
              projectId,
              youtubeUrl,
              startTime: moment.start_time,
              endTime: moment.end_time,
              duration: moment.duration,
              words: clipWords.length > 0 ? clipWords : moment.words,
              rank: moment.rank,
              title: moment.title,
              speakerName: moment.speaker_name,
              topBannerTag: moment.top_banner_tag,
              topBannerTitle: moment.top_banner_title,
              topBannerSteps: moment.top_banner_steps,
              viralScore: moment.viral_score,
              viralReason: moment.viral_reason,
              hookDescription: moment.hook_description,
              presetId: preset.id,
              presetName: preset.name,
              fontFamily: input.fontFamily,
            },
            null,
            2
          ),
          "utf-8"
        );
      } catch {}

      // Record in DB
      try {
        await db.insert(clips).values({
          projectId,
          title: moment.title,
          startTime: Math.round(moment.start_time),
          endTime: Math.round(moment.end_time),
          duration: moment.duration,
          rank: moment.rank,
          viralScore: String(moment.viral_score),
          whyViral: moment.viral_reason,
          isSelected: true,
        });

        await db.insert(renderJobs).values({
          clipId,
          outputUrl: renderRes.publicUrl,
          fileSizeMb: String(renderRes.fileSizeMb),
          status: "completed",
          progress: 100,
        });
      } catch {}

      const timestamp = Date.now();
      generatedClips.push({
        id: clipId,
        rank: moment.rank,
        title: moment.title,
        duration: renderRes.durationSec,
        viralScore: moment.viral_score,
        viralReason: moment.viral_reason,
        hookDescription: moment.hook_description,
        videoUrl: `${renderRes.publicUrl}?t=${timestamp}`,
        downloadUrl: `${renderRes.publicUrl}?download=true&t=${timestamp}`,
        fileSizeMb: renderRes.fileSizeMb,
        presetName: preset.name,
        status: "completed" as const,
        startTime: moment.start_time,
        endTime: moment.end_time,
      });

      console.log(`[Pipeline] [Klip ${i + 1}/${curatedMoments.length}] Selesai dirender: ${renderRes.publicUrl}`);
      const finishPct = Math.round(35 + ((i + 1) / curatedMoments.length) * 60);
      updateJobProgress(input.jobId, {
        percent: finishPct,
        currentClipIndex: i + 1,
        totalClips: curatedMoments.length,
        message: `Langkah 3/3: Klip ${i + 1} dari ${curatedMoments.length} selesai dirender (${finishPct}%)...`,
      });
    } catch (clipErr: any) {
      console.error(`[Pipeline] Gagal merender klip #${i + 1} (${moment.title}):`, clipErr?.message || clipErr);
    }
  }

  if (generatedClips.length === 0) {
    throw new HttpError(500, "RENDER_FAILED", "Semua klip video gagal dirender.");
  }

  // Update project status to completed
  try {
    await db
      .update(projects)
      .set({
        stage: "completed",
        stageLabel: "Render Selesai",
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));
  } catch {}

  // Immediate cleanup of raw audio file as requested in FASE 5
  if (audioPath && fs.existsSync(audioPath)) {
    try {
      fs.unlinkSync(audioPath);
    } catch {}
  }
  cleanupTempFiles(1);

  console.log(`[Pipeline] Selesai! Berhasil memproses ${generatedClips.length} klip untuk ${meta.title}`);
  const pipelineResult: PipelineGenerateResponse = {
    projectId,
    videoTitle: meta.title,
    duration: meta.duration,
    thumbnail: meta.thumbnail,
    youtubeUrl,
    preset,
    clips: generatedClips,
    processedAt: new Date().toISOString(),
  };

  updateJobProgress(input.jobId, {
    status: "completed",
    step: 3,
    stepName: "Auto-Cut 9:16",
    percent: 100,
    message: `Selesai! Berhasil memproses ${generatedClips.length} klip video 9:16 siap unduh.`,
    result: pipelineResult,
  });

  return pipelineResult;
}

export interface DirectUploadPipelineInput {
  videoFilePath: string;
  originalFileName: string;
  clipCount?: number;
  maxClips?: number; // 1 to 10
  targetDuration?: number;
  clipDuration?: number; // 30, 45, or 60
  pipelineMode?: PipelineMode;
  presetId?: string;
  subtitleFont?: string;
  fontFamily?: string;
  enableHook?: boolean;
  enableCinematicHook?: boolean;
  enablePolish?: boolean;
  colorPolish?: boolean;
  enableMotionGraphic?: boolean;
  enableExplanationBeats?: boolean;
  compositionMode?: CompositionMode;
  hookFont?: string;
  userId?: string;
  tempCloneBlueprint?: UniversalParametricBlueprint;
  useTempCloneBlueprint?: boolean;
  enableCloneTopMotion?: boolean;
  enableCloneBottomMotion?: boolean;
  enableTopMotion?: boolean;
  enableBottomMotion?: boolean;
  jobId?: string;
  bgmAudioPath?: string;
  enableBgmDucking?: boolean;
  bgmBaseVolume?: number;
  duckingDepthDb?: number;
}

/**
 * Executes direct video upload pipeline:
 * 1. Takes uploaded MP4/MOV from temp_uploads/
 * 2. Extracts audio locally: ffmpeg -i {input_video} -vn -ar 16000 -ac 1 -c:a libmp3lame {temp_audio.mp3}
 * 3. Transcribes word-level audio with Groq Whisper
 * 4. Curates viral moments with Gemini 2.5 Flash
 * 5. Cuts sections & renders vertical 9:16 clips with FFmpeg & .ass subtitles
 * 6. Automatically deletes raw upload in temp_uploads/ upon completion
 */
export async function executeDirectVideoUploadPipeline(
  input: DirectUploadPipelineInput
): Promise<PipelineGenerateResponse> {
  const userId = input.userId || "user-creator-demo";
  const rawClipCount = input.clipCount ?? input.maxClips;
  const clipCount = Math.min(Math.max(1, Number(rawClipCount) || 5), 10);
  const maxClips = clipCount;

  const rawTargetDuration = input.targetDuration ?? input.clipDuration;
  const clipDuration = [30, 45, 60].includes(Number(rawTargetDuration))
    ? Number(rawTargetDuration)
    : 45;
  const targetDuration = clipDuration;

  const rawPipelineMode = input.pipelineMode;
  let pipelineMode: PipelineMode = "netflix_editorial";
  if (
    rawPipelineMode === "raw_cut" ||
    rawPipelineMode === "clean_subtitle" ||
    rawPipelineMode === "netflix_editorial" ||
    rawPipelineMode === "clone_only"
  ) {
    pipelineMode = rawPipelineMode;
  } else if (input.compositionMode === "POTONG_MURNI") {
    pipelineMode = "raw_cut";
  }

  // 1. Resolve preset (supporting Clone Saja mode)
  let preset: VideoPreset | null = null;
  if (input.presetId && input.presetId !== "clone_only") {
    preset = await getPresetById(input.presetId);
  }
  if (!preset && (input.presetId === "clone_only" || pipelineMode === "clone_only")) {
    preset = (await getPresetById("ai-cloned")) || (await listAllPresets()).find((p) => p.isCloned) || null;
  }
  if (!preset) {
    const all = await listAllPresets();
    preset = all[0] || (await getPresetById("viral-motion"))!;
  }

  const presetId = preset.id;
  const subtitleFont = input.subtitleFont || input.fontFamily || preset.subtitleStyle?.fontName || "Montserrat ExtraBold";

  const enableHook = input.enableHook !== undefined
    ? input.enableHook
    : input.enableCinematicHook !== undefined
    ? input.enableCinematicHook
    : (preset.enableHook !== false);

  const enablePolish = input.enablePolish !== undefined
    ? input.enablePolish
    : input.colorPolish !== undefined
    ? input.colorPolish
    : (preset.enablePolish !== false);

  const isRawCut = pipelineMode === "raw_cut";
  const isCleanSubtitle = pipelineMode === "clean_subtitle";
  const isNetflixEditorial = pipelineMode === "netflix_editorial";
  const isCloneOnly = pipelineMode === "clone_only";

  const isCloneTopMotion =
    input.enableCloneTopMotion !== undefined
      ? input.enableCloneTopMotion
      : input.enableTopMotion !== undefined
      ? input.enableTopMotion
      : Boolean(preset.enableTopMotion);

  const isCloneBottomMotion =
    input.enableCloneBottomMotion !== undefined
      ? input.enableCloneBottomMotion
      : input.enableBottomMotion !== undefined
      ? input.enableBottomMotion
      : false;

  const isColdOpenTeaser = (isNetflixEditorial || isCloneOnly) && enableHook && (preset.enableHook !== false);
  const shouldGenerateMotionHeader =
    isNetflixEditorial ||
    (isCloneOnly && isCloneTopMotion) ||
    Boolean(input.enableTopMotion);
  const shouldGenerateSubtitle = !isRawCut;
  const shouldEnableSfx = (isNetflixEditorial || isCloneOnly) && enablePolish;
  const shouldEnableCinemaFrame = enablePolish;
  const shouldColorPolish = enablePolish;

  const rawTitle = input.originalFileName.replace(/\.[^/.]+$/, "");
  const videoTitle = cleanTextForRender(rawTitle) || "Video Unggahan";
  const projectId = randomUUID();
  const ffmpegExe = getFfmpegPath();

  // 2. Dynamic Video Duration Detection via ffprobe (Fase 1: Anti-Hardcode)
  const totalDurationSeconds = await getVideoDurationSeconds(input.videoFilePath);
  const detectedDur = totalDurationSeconds > 0 ? Math.round(totalDurationSeconds) : 600;
  console.log(`[UploadPipeline] [1/4] Mengekstrak audio penuh (durasi: ${(detectedDur / 60).toFixed(1)} menit / ${detectedDur}s)...`);
  updateJobProgress(input.jobId, {
    status: "downloading",
    step: 1,
    stepName: "Unduh Sumber",
    percent: 15,
    message: `Langkah 1/3: Memvalidasi video & mengekstrak audio lokal (${(detectedDur / 60).toFixed(1)} menit)...`,
  });

  // Record project in DB
  try {
    await db.insert(projects).values({
      id: projectId,
      userId,
      youtubeUrl: `upload://${input.originalFileName}`,
      videoTitle,
      videoDuration: detectedDur,
      clipDuration,
      maxClips,
      editStyle: preset.id,
      stage: "processing",
      status: "processing",
    });
  } catch {}

  // 3. Extract 1 Single Full-Length Speech Audio (Fase 2: 16kHz mono 32kbps - ~14MB/hour)
  const audioDir = getTempDir("temp/audio");
  const tempAudioPath = path.join(audioDir, `upload_master_${projectId}.mp3`);
  const audioExtractTimeout = Math.max(1800000, Math.ceil(detectedDur * 1000 * 1.5));
  try {
    await extractFullMasterAudio(input.videoFilePath, tempAudioPath, audioExtractTimeout);
  } catch (err: any) {
    try {
      if (fs.existsSync(input.videoFilePath)) fs.unlinkSync(input.videoFilePath);
    } catch {}
    throw new HttpError(
      400,
      "AUDIO_EXTRACTION_FAILED",
      `Gagal mengekstrak audio penuh dari video: ${err?.message}`
    );
  }

  const audioStat = fs.statSync(tempAudioPath);
  console.log(
    `[UploadPipeline] Audio master 24kbps berhasil diekstrak: ${(audioStat.size / (1024 * 1024)).toFixed(2)} MB`
  );

  // 4. Single-Call Full Audio Viral Curation via Google File API (Fase 3: Account Curator)
  console.log(`[UploadPipeline] [2/4] Menganalisis momen viral dengan Gemini AI...`);
  updateJobProgress(input.jobId, {
    status: "analyzing",
    step: 2,
    stepName: "Analisis Momen Viral",
    percent: 35,
    message: "Langkah 2/3: Mentranskripsi kata & mengkurasi momen viral (Gemini 3.8 Flash)...",
  });
  let curatedMoments: CuratedViralClip[] = [];
  try {
    curatedMoments = await curateViralMomentsFromFullAudioFile({
      audioFilePath: tempAudioPath,
      totalDurationSeconds: detectedDur,
      targetDurationSec: clipDuration,
      maxClips,
      videoTitle,
    });
  } finally {
    try {
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
    } catch {}
  }

  // 6. Sequential Isolated Processing & 9:16 vertical render (Ultra-light, Zero RAM Freeze)
  console.log(`[UploadPipeline] [3/4] Menghasilkan subtitle presisi kata-per-kata via Groq Whisper...`);
  console.log(`[UploadPipeline] [4/4] Merender video klip 9:16 secara sekuensial (hemat RAM & CPU)...`);

  const generatedClips: GeneratedClipResult[] = [];

  for (let i = 0; i < curatedMoments.length; i++) {
    const moment = curatedMoments[i]!;
    const clipPct = Math.round(35 + (i / curatedMoments.length) * 60);
    updateJobProgress(input.jobId, {
      status: "rendering",
      step: 3,
      stepName: "Auto-Cut 9:16",
      percent: clipPct,
      currentClipIndex: i + 1,
      totalClips: curatedMoments.length,
      clipTitle: moment.title,
      message: `Langkah 3/3: Merender Klip ${i + 1} dari ${curatedMoments.length}: "${moment.title}"...`,
    });
    console.log(`[UploadPipeline] === [Klip ${i + 1}/${curatedMoments.length}] Memproses: "${moment.title}" ===`);
    try {
      const clipId = randomUUID();
      const clipDir = getJobClipDir(projectId, clipId);
      const sectionPath = path.join(clipDir, `section_${clipId}.mp4`);

      // Bulletproof section extraction: use -ss & -t (NEVER -to to prevent start > end aborts)
      const safeStart = Math.max(0, moment.start_time);
      const safeDuration = Math.max(5, moment.duration || 45);

      try {
        // Fast seek cut section locally from input.videoFilePath with thread guard
        await execFileAsync(
          ffmpegExe,
          [
            "-y",
            "-ss",
            String(safeStart),
            "-t",
            String(safeDuration),
            "-accurate_seek",
            "-i",
            input.videoFilePath,
            "-threads",
            "0",
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
            sectionPath,
          ],
          { timeout: 120000 }
        );
      } catch (fastCutErr: any) {
        console.warn(
          `[UploadPipeline] Fast cut klip #${i + 1} kendala (${fastCutErr?.message?.slice(0, 100)}), mencoba fallback decode seek...`
        );
        await execFileAsync(
          ffmpegExe,
          [
            "-y",
            "-i",
            input.videoFilePath,
            "-ss",
            String(safeStart),
            "-t",
            String(safeDuration),
            "-threads",
            "0",
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
            sectionPath,
          ],
          { timeout: 180000 }
        );
      }

      // Groq Acoustic Sliced Transcription
      let clipWords = moment.words || [];
      let fullClipTranscript = "";
      try {
        const groqRes = await groqTranscriptionLimit(() =>
          extractAudioSliceAndTranscribe({
            videoPath: sectionPath,
            startTimeSec: 0,
            endTimeSec: moment.duration,
            outputDir: clipDir,
            clipId,
          })
        );
        if (groqRes.words && groqRes.words.length > 0) {
          clipWords = groqRes.words;
        }
        if (groqRes.text) {
          fullClipTranscript = groqRes.text.trim();
        }
      } catch (groqErr: any) {
        console.warn(`[UploadPipeline] Groq slice transcription fallback ke kata kurasi:`, groqErr?.message);
      }

      // Pastikan fullClipTranscript tidak boleh kosong
      if (!fullClipTranscript && clipWords.length > 0) {
        fullClipTranscript = clipWords.map((w) => w.word).join(" ").trim();
      }
      if (!fullClipTranscript) {
        fullClipTranscript = cleanTextForRender(moment.hook_description || moment.title);
      }

      // [FASE 2: PIPELINE SINKRONISASI SEGMENTASI WAKTU KE DUAL-AI ENGINE]
      // Slicing 4 segmen waktu:
      // - Segmen 0 (Hook): 00:00 - 00:04 (4 detik pertama)
      // - Segmen 1 (Poin 1): 00:04 - 00:18
      // - Segmen 2 (Poin 2): 00:18 - 00:33
      // - Segmen 3 (Poin 3): 00:33 - selesai
      const hookWords = clipWords.filter((w) => w.end <= 4.2 || (w.start < 4.0 && w.end <= 5.0));
      const p1Words = clipWords.filter((w) => w.start >= 3.8 && w.start < 18.2);
      const p2Words = clipWords.filter((w) => w.start >= 17.8 && w.start < 33.2);
      const p3Words = clipWords.filter((w) => w.start >= 32.8);

      let seg0Text = hookWords.map((w) => w.word).join(" ").trim();
      let seg1Text = p1Words.map((w) => w.word).join(" ").trim();
      let seg2Text = p2Words.map((w) => w.word).join(" ").trim();
      let seg3Text = p3Words.map((w) => w.word).join(" ").trim();

      const allTokens = fullClipTranscript.split(/\s+/).filter(Boolean);
      if (!seg0Text) seg0Text = allTokens.slice(0, Math.min(10, allTokens.length)).join(" ");
      if (!seg1Text) seg1Text = allTokens.slice(10, Math.min(30, allTokens.length)).join(" ");
      if (!seg2Text) seg2Text = allTokens.slice(30, Math.min(50, allTokens.length)).join(" ");
      if (!seg3Text) seg3Text = allTokens.slice(50).join(" ") || allTokens.slice(20).join(" ");

      // [FASE 3: DUAL-AI ENGINE PADA MOTION DIRECTOR - DYNAMIC ART VARIATION]
      let cleanHeadline = cleanTextForRender(moment.title) || "SOROTAN UTAMA TOPIK";
      let rawBeats: ExplanationBeat[] = [];
      let hookKicker = moment.top_banner_tag || "VIRAL CLIP";
      let hookSubtext = cleanTextForRender(moment.hook_description) || "DATA TERVERIFIKASI";
      let detectedStyleVariant: number | undefined = undefined;
      let detectedAccentHex: string = preset.accentColor || "#E50914";
      let detectedLucideIcon: string = "Flame";
      let detectedVibe: string = "Cinematic Motion";

      if (shouldGenerateMotionHeader) {
        try {
          const dualAIResult = await analyzeSegmentBeatsWithDualAI({
            clipId,
            title: moment.title,
            duration: moment.duration,
            segments: {
              hook: seg0Text,
              part1: seg1Text,
              part2: seg2Text,
              part3: seg3Text,
            },
            accentHex: preset.accentColor || "#E50914",
          });
          cleanHeadline = dualAIResult.hook.headline || cleanHeadline;
          hookKicker = dualAIResult.hook.kicker || hookKicker;
          hookSubtext = dualAIResult.hook.subtext || hookSubtext;
          rawBeats = dualAIResult.beats;
          detectedStyleVariant = dualAIResult.style_variant;
          if (dualAIResult.accent_hex) detectedAccentHex = dualAIResult.accent_hex;
          if (dualAIResult.hook.lucide_icon) detectedLucideIcon = dualAIResult.hook.lucide_icon;
          if (dualAIResult.vibe_description) detectedVibe = dualAIResult.vibe_description;
        } catch {
          rawBeats = generateFallbackExplanationBeats(
            moment.duration,
            moment.top_banner_steps,
            moment.top_banner_tag,
            preset.accentColor || "#E50914"
          );
          detectedStyleVariant = (i % 8);
        }
      }

      moment.hook_category = hookKicker;
      moment.hook_headline = cleanHeadline;
      moment.top_banner_tag = hookKicker;
      moment.top_banner_title = cleanHeadline;
      moment.title = cleanHeadline;
      moment.hook_subtext = hookSubtext;

      // Fast Synchronous Motion & Hook Config from curated metadata (Zero API Latency)
      const motionConfig = {
        clipId,
        archetype: "AUDIO_RADAR" as const,
        headline: cleanHeadline,
        accent_color: detectedAccentHex,
        motion_values: {
          lucideIcon: detectedLucideIcon,
        },
        tag: hookKicker,
        title: cleanHeadline,
        hookMetadata: {
          clip_id: clipId,
          speaker_name: cleanTextForRender(moment.speaker_name) || "NARASUMBER",
          hook_category: hookKicker,
          hook_headline: cleanHeadline,
          hook_sub_metric: hookSubtext,
          lucide_icon: detectedLucideIcon,
          style_variant: detectedStyleVariant,
          accent_hex: detectedAccentHex,
          vibe_description: detectedVibe,
          explanation_beats: rawBeats,
        },
        hookQuote: cleanTextForRender(moment.hook_description) || cleanHeadline,
        speakerName: cleanTextForRender(moment.speaker_name) || "NARASUMBER",
      };

      // [FASE 1, 2, 3 & 6: MODULAR COMPOSITION MODE]
      const compositionMode = input.compositionMode || "PAKET_LENGKAP";
      const enableCinematicHook =
        compositionMode === "POTONG_MURNI" || compositionMode === "MOTION_ONLY"
          ? false
          : input.enableCinematicHook !== false;
      const enableExplanationBeats =
        compositionMode === "POTONG_MURNI" || compositionMode === "HOOK_ONLY"
          ? false
          : input.enableExplanationBeats !== false;

      let teaserVideoPath: string | undefined = undefined;
      let topHookBannerPngPath: string | undefined = undefined;
      let teaserDuration = 0;
      let teaserWords: WordTimestamp[] = [];

      if (isColdOpenTeaser) {
        // 1. Safe extraction of 3.5 - 4.5s climax teaser from cut section
        const teaserStartAbs = moment.teaser_start ?? moment.start_time;
        const relTeaserStart = Math.max(0, teaserStartAbs - moment.start_time);
        teaserDuration = Math.min(
          4.5,
          Math.max(
            3.5,
            moment.teaser_duration ||
              (moment.teaser_end ? moment.teaser_end - teaserStartAbs : 4.0)
          )
        );

        const teaserFile = path.join(clipDir, `teaser_${clipId}.mp4`);
        try {
          await execFileAsync(
            ffmpegExe,
            [
              "-y",
              "-ss",
              relTeaserStart.toFixed(2),
              "-t",
              teaserDuration.toFixed(2),
              "-accurate_seek",
              "-i",
              sectionPath,
              "-threads",
              "0",
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
              teaserFile,
            ],
            { timeout: 60000 }
          );

          if (fs.existsSync(teaserFile)) {
            teaserVideoPath = teaserFile;
            console.log(
              `[UploadPipeline] Teaser Hook diekstrak (${teaserDuration}s, relStart: ${relTeaserStart}s): ${teaserFile}`
            );
          }
        } catch (tErr: any) {
          console.warn(`[UploadPipeline] Gagal ekstrak teaser klip #${i + 1}:`, tErr?.message);
        }

        // 3. Filter spoken words within the teaser timeframe
        teaserWords = clipWords.filter(
          (w) =>
            w.end >= relTeaserStart &&
            w.start <= relTeaserStart + teaserDuration
        );
      }

      // [FASE 2: GENERATOR 4 KARTU INFOGRAFIS PASTI JADI (1 HOOK + 3 EXPLANATION BEATS)]
      let fourCards: GeneratedFourCardsResult | undefined = undefined;
      let animatedHeaderTrackPath: string | undefined = undefined;
      let motionHeaderPath: string | undefined = undefined;

      if (shouldGenerateMotionHeader) {
        const rawBeats: ExplanationBeat[] =
          motionConfig?.hookMetadata?.explanation_beats && motionConfig.hookMetadata.explanation_beats.length >= 3
            ? motionConfig.hookMetadata.explanation_beats
            : generateFallbackExplanationBeats(
                moment.duration,
                moment.top_banner_steps,
                moment.top_banner_tag,
                motionConfig?.accent_color || "#E50914"
              );

        // [FASE 3 & 4: TRUE ANIMATED HEADER TRACK GENERATOR (1080x480 - 8 DIVERSE STYLES)]
        try {
          const trackMov = path.join(clipDir, `animated_header_${clipId}.mov`);
          const isColdOpenTeaser = Boolean(moment.teaser_start !== undefined && moment.teaser_end !== undefined);
          const totalDurationSec = isColdOpenTeaser ? (teaserDuration + moment.duration) : moment.duration;
          const chosenStyleVariant =
            preset?.styleVariant !== undefined
              ? preset.styleVariant
              : detectedStyleVariant !== undefined
              ? detectedStyleVariant
              : (i % 8);
          const chosenAccent =
            (preset?.id !== "viral-motion" && preset?.accentColor && preset.accentColor !== "#E50914")
              ? preset.accentColor
              : detectedAccentHex;

          await generateAnimatedHeaderTrack({
            destinationPath: trackMov,
            totalDurationSec,
            teaserDurationSec: teaserDuration,
            hookCategory: moment.hook_category,
            hookHeadline: cleanHeadline,
            hookSubtext: cleanTextForRender(moment.hook_subtext || moment.hook_description || "DATA KUNCI TERVERIFIKASI"),
            accentColor: chosenAccent,
            explanationBeats: rawBeats,
            topBannerSteps: moment.top_banner_steps,
            styleVariant: chosenStyleVariant,
            clipIndex: i,
          });
          if (fs.existsSync(trackMov)) {
            animatedHeaderTrackPath = trackMov;
            console.log(`[UploadPipeline] Animated header track siap di klip #${i + 1} (Style: ${chosenStyleVariant}, Aksen: ${chosenAccent}): ${trackMov}`);
          }
        } catch (animErr: any) {
          console.warn(`[UploadPipeline] Animated header track notice:`, animErr?.message);
        }

        // Skip heavy card rendering if animated header track already exists
        if (!animatedHeaderTrackPath) {
          try {
            fourCards = await renderAllFourInfographicCards({
              clipDir,
              clipId,
              durationSec: moment.duration,
              teaserDurationSec: teaserDuration,
              hookCategory: moment.hook_category,
              hookHeadline: cleanHeadline,
              hookSubtext: cleanTextForRender(moment.hook_subtext || moment.hook_description || "DATA KUNCI TERVERIFIKASI"),
              accentColor: motionConfig?.accent_color || "#E50914",
              explanationBeats: rawBeats,
              topBannerSteps: moment.top_banner_steps,
              transcriptText: fullClipTranscript,
            });
            if (fourCards && fourCards.card0Path) {
              topHookBannerPngPath = fourCards.card0Path;
            }
          } catch (cardErr: any) {
            console.warn(`[UploadPipeline] Gagal render 4 kartu infografis klip #${i + 1}:`, cardErr?.message);
          }
        }
      }

      // Generate .ass subtitle with non-overlapping anti-collision & selected font
      let assPath: string | undefined = undefined;
      if (shouldGenerateSubtitle) {
        assPath = path.join(clipDir, `subtitles_${clipId}.ass`);
        generateAssSubtitleFile({
          clipId,
          clipStartTimeSec: 0,
          clipEndTimeSec: moment.duration,
          words: clipWords,
          teaserWords: isColdOpenTeaser && teaserVideoPath ? teaserWords : undefined,
          teaserDurationSec: isColdOpenTeaser && teaserVideoPath ? teaserDuration : undefined,
          preset,
          speakerName: moment.speaker_name,
          topBannerTag: moment.top_banner_tag,
          topBannerTitle: moment.top_banner_title,
          topBannerSteps: moment.top_banner_steps,
          clipTitle: moment.title,
          fontFamily: subtitleFont,
          outputFilePath: assPath,
        });
      }

      // [FASE 2: DETEKSI PEMBICARA AKTIF & SMART CROP UNTUK FULL VERTICAL 9:16]
      let speakerCropFilter: string | undefined = undefined;
      const isFullVerticalTrack =
        preset.layoutArchitecture === "IN_SCENE_KINETIC_CLIPPER" ||
        preset.cameraFraming === "FULL_9_16_SPEAKER_TRACK";

      if (isFullVerticalTrack && sectionPath) {
        try {
          const trackRes = await trackActiveSpeaker({
            videoPath: sectionPath,
            startTimeSec: 0,
            durationSec: moment.duration,
            transcriptText: moment.hook_description || clipWords.map((w) => w.word).join(" "),
            speakerName: moment.speaker_name,
          });
          speakerCropFilter = trackRes.cropFilter;
        } catch (trackErr: any) {
          console.warn(`[Pipeline] Speaker tracking notice klip #${i + 1}:`, trackErr?.message);
        }
      }

      // [FASE 4: KINETIC HOOK AWAL 0-6 DETIK UNTUK IN_SCENE_KINETIC_CLIPPER]
      let inSceneKineticHookTrackPath: string | undefined = undefined;
      if (
        (isFullVerticalTrack ||
          preset.hookVisualType === "IN_SCENE_KINETIC_HOOK" ||
          preset.hookVisualType === "IN_SCENE_GLOW_TYPOGRAPHY") &&
        preset.enableHook !== false
      ) {
        try {
          const hookMovPath = path.join(clipDir, `kinetic_hook_${clipId}.mov`);
          await generateInSceneKineticHookTrack({
            destinationPath: hookMovPath,
            durationSec: Math.min(6.0, moment.duration),
            headline: moment.top_banner_title || moment.title,
            accentColor: preset.accentColor || "#FF6B00",
            transcriptWords: clipWords.filter((w) => w.start < 6.0),
          });
          if (fs.existsSync(hookMovPath)) {
            inSceneKineticHookTrackPath = hookMovPath;
          }
        } catch (hookErr: any) {
          console.warn(`[Pipeline] Kinetic hook render notice klip #${i + 1}:`, hookErr?.message);
        }
      }

      // [FASE 1: BGM PREPARATION & GROQ AI BACKSOUND MOMENT MATCHER]
      let clipBgmPath: string | undefined = undefined;
      const userBgm = input.bgmAudioPath;
      if (userBgm && fs.existsSync(userBgm)) {
        try {
          const matchResult = await matchOptimalBgmOffsetWithGroq({
            bgmPath: userBgm,
            clipDurationSec: moment.duration,
            clipTitle: moment.title,
            clipTranscript: fullClipTranscript || moment.hook_description,
          });
          const destCutBgm = path.join(clipDir, `bgm_cut_${clipId}.wav`);
          await sliceBgmForClip({
            inputBgmPath: userBgm,
            outputBgmPath: destCutBgm,
            startOffsetSec: matchResult.startOffsetSec,
            durationSec: moment.duration,
          });
          if (fs.existsSync(destCutBgm)) {
            clipBgmPath = destCutBgm;
            console.log(`[AudioMixer] Klip #${i + 1} BGM siap (offset: ${matchResult.startOffsetSec}s, durasi: ${moment.duration}s): ${matchResult.reason}`);
          }
        } catch (bgmErr: any) {
          console.warn(`[AudioMixer] BGM matching notice klip #${i + 1}:`, bgmErr?.message);
        }
      }

      // Render 9:16 vertical clip (Router: Universal Clone Engine vs Regular Pipeline)
      const activeBlueprint = input.tempCloneBlueprint || getActiveTempCloneBlueprint();
      const isUniversalCloneMode =
        Boolean(input.useTempCloneBlueprint) ||
        Boolean(preset.isUniversalClone) ||
        (Boolean(activeBlueprint) && (pipelineMode === "clone_only" || preset.isCloned || preset.id.startsWith("cloned-") || preset.id === "ai-cloned"));

      let renderRes: RenderResult;
      try {
        if (isUniversalCloneMode && activeBlueprint) {
          console.log(`[DirectUpload] Menggunakan Pintu 2 (Universal Clone Pipeline) untuk klip #${i + 1}...`);
          renderRes = await videoRenderLimit(() =>
            runUniversalCloneCompositor({
              clipId,
              sourceVideoPath: sectionPath,
              durationSec: moment.duration,
              words: clipWords,
              headline: moment.top_banner_title || moment.title,
              speakerName: moment.speaker_name,
              blueprint: activeBlueprint,
              tempJobDir: clipDir,
              fontFamily: subtitleFont,
              enableTopMotion: isCloneTopMotion,
              enableBottomMotion: isCloneBottomMotion,
              animatedHeaderTrackPath: isCloneTopMotion ? animatedHeaderTrackPath : undefined,
              accentColor: preset.accentColor || "#2cd3c6",
              bgmFilePath: clipBgmPath,
              bgmBaseVolume: input.bgmBaseVolume ?? 0.15,
              duckingDepthDb: input.duckingDepthDb ?? -20,
            })
          );
        } else {
          renderRes = await videoRenderLimit(() =>
            renderVerticalClip({
              clipId,
              sourceVideoPath: sectionPath,
              teaserVideoPath,
              teaserDurationSec: teaserDuration,
              topHookBannerPngPath: fourCards?.card0Path || topHookBannerPngPath,
              fourCards,
              animatedHeaderTrackPath,
              inSceneKineticHookTrackPath,
              speakerCropFilter,
              enableExplanationBeats: shouldGenerateMotionHeader,
              assSubtitlePath: assPath,
              motionHeaderVideoPath: motionHeaderPath,
              enableHookOverlay: isColdOpenTeaser,
              enableCinemaFrame: shouldEnableCinemaFrame,
              enableSfx: shouldEnableSfx,
              colorPolish: shouldColorPolish,
              durationSec: moment.duration,
              preset,
              tempJobDir: clipDir, // auto-cleanup clipDir when done
              enableMotionGraphic: shouldGenerateMotionHeader,
              bgmFilePath: clipBgmPath,
              bgmBaseVolume: input.bgmBaseVolume ?? 0.15,
              duckingDepthDb: input.duckingDepthDb ?? -20,
            })
          );
        }
      } catch (mainRenderErr: any) {
        console.warn(
          `[UploadPipeline] Render utama klip #${i + 1} mengalami kendala (${mainRenderErr?.message}). Menjalankan emergency fallback render agar klip tidak hilang...`
        );
        renderRes = await videoRenderLimit(() =>
          renderVerticalClip({
            clipId,
            sourceVideoPath: sectionPath,
            preset: { ...preset, layoutArchitecture: "FULL_VERTICAL_CROP", pipelineMode: "raw_cut", hookVisualType: "NONE" },
            tempJobDir: clipDir,
            durationSec: moment.duration,
            enableMotionGraphic: false,
            enableExplanationBeats: false,
            enableCinemaFrame: false,
            enableSfx: false,
            colorPolish: false,
          })
        );
      }

      // Save metadata for instant Re-Style
      try {
        const metaDir = getTempDir("temp/metadata");
        const metaPath = path.join(metaDir, `${clipId}.json`);
        fs.writeFileSync(
          metaPath,
          JSON.stringify(
            {
              clipId,
              projectId,
              originalFileName: input.originalFileName,
              startTime: moment.start_time,
              endTime: moment.end_time,
              duration: moment.duration,
              words: clipWords.length > 0 ? clipWords : moment.words,
              rank: moment.rank,
              title: moment.title,
              speakerName: moment.speaker_name,
              topBannerTag: moment.top_banner_tag,
              topBannerTitle: moment.top_banner_title,
              topBannerSteps: moment.top_banner_steps,
              viralScore: moment.viral_score,
              viralReason: moment.viral_reason,
              hookDescription: moment.hook_description,
              presetId: preset.id,
              presetName: preset.name,
              fontFamily: input.fontFamily,
            },
            null,
            2
          ),
          "utf-8"
        );
      } catch {}

      // Record clip in DB
      try {
        await db.insert(clips).values({
          projectId,
          title: moment.title,
          startTime: Math.round(moment.start_time),
          endTime: Math.round(moment.end_time),
          duration: moment.duration,
          rank: moment.rank,
          viralScore: String(moment.viral_score),
          whyViral: moment.viral_reason,
          isSelected: true,
        });

        await db.insert(renderJobs).values({
          clipId,
          outputUrl: renderRes.publicUrl,
          fileSizeMb: String(renderRes.fileSizeMb),
          status: "completed",
          progress: 100,
        });
      } catch {}

      const timestamp = Date.now();
      generatedClips.push({
        id: clipId,
        rank: moment.rank,
        title: moment.title,
        duration: renderRes.durationSec,
        viralScore: moment.viral_score,
        viralReason: moment.viral_reason,
        hookDescription: moment.hook_description,
        videoUrl: `${renderRes.publicUrl}?t=${timestamp}`,
        downloadUrl: `${renderRes.publicUrl}?download=true&t=${timestamp}`,
        fileSizeMb: renderRes.fileSizeMb,
        presetName: preset.name,
        status: "completed" as const,
        startTime: moment.start_time,
        endTime: moment.end_time,
      });

      console.log(`[UploadPipeline] [Klip ${i + 1}/${curatedMoments.length}] Selesai dirender: ${renderRes.publicUrl}`);
      const finishPct = Math.round(35 + ((i + 1) / curatedMoments.length) * 60);
      updateJobProgress(input.jobId, {
        percent: finishPct,
        currentClipIndex: i + 1,
        totalClips: curatedMoments.length,
        message: `Langkah 3/3: Klip ${i + 1} dari ${curatedMoments.length} selesai dirender (${finishPct}%)...`,
      });
    } catch (clipErr: any) {
      console.error(`[UploadPipeline] Gagal merender klip #${i + 1} (${moment.title}):`, clipErr?.message || clipErr);
    }
  }

  if (generatedClips.length === 0) {
    throw new HttpError(500, "RENDER_FAILED", "Semua klip video gagal dirender.");
  }

  // Update DB project status
  try {
    await db
      .update(projects)
      .set({
        stage: "ready",
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));
  } catch {}

  // "Hapus otomatis file mentah di temp_uploads/ segera setelah klip selesai diproses"
  try {
    if (fs.existsSync(input.videoFilePath)) {
      fs.unlinkSync(input.videoFilePath);
      console.log(`[UploadPipeline] File unggahan mentah ${input.videoFilePath} berhasil dibersihkan.`);
    }
  } catch (cleanErr: any) {
    console.warn("[UploadPipeline] Gagal menghapus file unggahan:", cleanErr?.message);
  }

  const pipelineResult: PipelineGenerateResponse = {
    projectId,
    videoTitle,
    duration: detectedDur,
    thumbnail: "/images/video_preview.jpg",
    youtubeUrl: `upload://${input.originalFileName}`,
    preset,
    clips: generatedClips,
    processedAt: new Date().toISOString(),
  };

  updateJobProgress(input.jobId, {
    status: "completed",
    step: 3,
    stepName: "Auto-Cut 9:16",
    percent: 100,
    message: `Selesai! Berhasil memproses ${generatedClips.length} klip video 9:16 siap unduh.`,
    result: pipelineResult,
  });

  return pipelineResult;
}

/**
 * Re-renders an existing clip instantly with a new preset style
 * WITHOUT re-downloading the whole video or re-transcribing audio.
 */
export async function reStyleClip(input: {
  clipId: string;
  presetId: string;
  enableMotionGraphic?: boolean;
  fontFamily?: string;
}): Promise<GeneratedClipResult> {
  // 1. Find metadata
  const metaDir = getTempDir("temp/metadata");
  const metaPath = path.join(metaDir, `${input.clipId}.json`);
  let meta: any = null;
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    } catch {}
  }

  // 2. Find target preset
  const preset = await getPresetById(input.presetId);
  if (!preset) {
    throw new HttpError(404, "PRESET_NOT_FOUND", `Preset "${input.presetId}" tidak ditemukan.`);
  }

  // 3. Locate source video segment
  const tempSectionDir = getTempDir("temp/sections");
  let sectionPath = path.join(tempSectionDir, `section_${input.clipId}.mp4`);

  if (!fs.existsSync(sectionPath) || !hasVideoStream(sectionPath)) {
    // Check if we can re-download using saved meta
    if (meta?.youtubeUrl && typeof meta?.startTime === "number" && typeof meta?.endTime === "number") {
      sectionPath = await downloadPrecisionSection({
        youtubeUrl: meta.youtubeUrl,
        startTimeSec: meta.startTime,
        endTimeSec: meta.endTime,
        outputFilePath: sectionPath,
      });
    } else {
      // Check if previous output exists in outputs/
      const prevOut = path.join(getOutputsDir(), `dior_${input.clipId}.mp4`);
      if (fs.existsSync(prevOut) && hasVideoStream(prevOut)) {
        sectionPath = prevOut;
      } else {
        throw new HttpError(
          404,
          "CLIP_SOURCE_NOT_FOUND",
          "File segmen video asli tidak ditemukan untuk dirender ulang. Silakan proses kembali video dari URL."
        );
      }
    }
  }

  // 4. Generate new .ass subtitle file with target preset styling
  const words = meta?.words || [];
  const startTime = meta?.startTime ?? 0;
  const endTime = meta?.endTime ?? (meta?.duration ?? 45);
  const duration = meta?.duration ?? Math.max(5, endTime - startTime);

  const assPath = generateAssSubtitleFile({
    clipId: input.clipId,
    clipStartTimeSec: startTime,
    clipEndTimeSec: endTime,
    words,
    preset,
    speakerName: meta?.speakerName,
    topBannerTag: meta?.topBannerTag,
    topBannerTitle: meta?.topBannerTitle,
    topBannerSteps: meta?.topBannerSteps,
    clipTitle: meta?.title,
    fontFamily: input.fontFamily,
  });

  // 5. Render vertical clip with FFmpeg using new preset
  let reStyleSpeakerCrop: string | undefined = undefined;
  const isFullVerticalTrack =
    preset.layoutArchitecture === "IN_SCENE_KINETIC_CLIPPER" ||
    preset.cameraFraming === "FULL_9_16_SPEAKER_TRACK";

  if (isFullVerticalTrack && sectionPath) {
    try {
      const trackRes = await trackActiveSpeaker({
        videoPath: sectionPath,
        startTimeSec: 0,
        durationSec: duration,
        transcriptText: meta?.transcript || words.map((w: any) => w.word).join(" "),
        speakerName: meta?.speakerName,
      });
      reStyleSpeakerCrop = trackRes.cropFilter;
    } catch {}
  }

  let reStyleKineticHookPath: string | undefined = undefined;
  if (
    (isFullVerticalTrack ||
      preset.hookVisualType === "IN_SCENE_KINETIC_HOOK" ||
      preset.hookVisualType === "IN_SCENE_GLOW_TYPOGRAPHY") &&
    preset.enableHook !== false
  ) {
    try {
      const hookMovPath = path.join(getTempDir("temp/sections"), `restyle_hook_${input.clipId}.mov`);
      await generateInSceneKineticHookTrack({
        destinationPath: hookMovPath,
        durationSec: Math.min(6.0, duration),
        headline: meta?.topBannerTitle || meta?.title || "SOROTAN UTAMA",
        accentColor: preset.accentColor || "#FF6B00",
        transcriptWords: Array.isArray(words) ? words.filter((w: any) => w.start < 6.0) : undefined,
      });
      if (fs.existsSync(hookMovPath)) {
        reStyleKineticHookPath = hookMovPath;
      }
    } catch {}
  }

  const activeBlueprint = getActiveTempCloneBlueprint();
  const isUniversalClone =
    Boolean(preset.isUniversalClone) ||
    (Boolean(activeBlueprint) && (preset.isCloned || preset.id.startsWith("cloned-") || preset.id === "ai-cloned"));

  let renderRes: RenderResult;
  if (isUniversalClone && activeBlueprint) {
    renderRes = await runUniversalCloneCompositor({
      clipId: input.clipId,
      sourceVideoPath: sectionPath,
      durationSec: duration,
      words: Array.isArray(words) ? words : [],
      headline: meta?.topBannerTitle || meta?.title,
      speakerName: meta?.speakerName,
      blueprint: activeBlueprint,
      fontFamily: input.fontFamily,
    });
  } else {
    renderRes = await renderVerticalClip({
      clipId: input.clipId,
      sourceVideoPath: sectionPath,
      assSubtitlePath: assPath,
      speakerCropFilter: reStyleSpeakerCrop,
      inSceneKineticHookTrackPath: reStyleKineticHookPath,
      durationSec: duration,
      preset,
      enableMotionGraphic: input.enableMotionGraphic ?? preset.motionGraphic.progressBar,
    });
  }

  // Update metadata
  if (meta) {
    meta.presetId = preset.id;
    meta.presetName = preset.name;
    try {
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
    } catch {}
  }

  const timestamp = Date.now();
  return {
    id: input.clipId,
    rank: meta?.rank || 1,
    title: meta?.title || "Klip Viral",
    duration: renderRes.durationSec,
    viralScore: meta?.viralScore || 95,
    viralReason: meta?.viralReason || "",
    hookDescription: meta?.hookDescription || "",
    videoUrl: `${renderRes.publicUrl}?t=${timestamp}`,
    downloadUrl: `${renderRes.publicUrl}?download=true&t=${timestamp}`,
    fileSizeMb: renderRes.fileSizeMb,
    presetName: preset.name,
    status: "completed",
    startTime,
    endTime,
  };
}
