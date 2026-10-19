import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { projects, clips, renderJobs } from "../db/schema";
import { getYoutubeMetadata, downloadAudioOnly, downloadPrecisionSection, getTempDir } from "./downloader";
import { transcribeAudioWordLevel, curateViralMomentsWithGemini, type CuratedViralClip } from "./ai-curator.service";
import { getPresetById, listAllPresets, type VideoPreset } from "./presets.service";
import { generateAssSubtitleFile } from "./ass-generator.service";
import { renderVerticalClip, type RenderResult } from "./video-renderer.service";
import { cleanupTempFiles } from "./cleanup.service";
import { eq } from "drizzle-orm";

export interface PipelineGenerateInput {
  youtubeUrl: string;
  maxClips?: number; // 1 to 10
  clipDuration?: number; // 30, 45, or 60
  presetId?: string; // e.g. "viral-motion", "netflix-cinematic"
  enableMotionGraphic?: boolean;
  userId?: string;
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
  const maxClips = Math.min(Math.max(1, Number(input.maxClips) || 5), 10);
  const clipDuration = [30, 45, 60].includes(Number(input.clipDuration))
    ? Number(input.clipDuration)
    : 45;

  // 1. Resolve preset
  let preset: VideoPreset | null = null;
  if (input.presetId) {
    preset = await getPresetById(input.presetId);
  }
  if (!preset) {
    const all = await listAllPresets();
    preset = all[0] || (await getPresetById("viral-motion"))!;
  }

  // 2. Extract metadata
  console.log(`[Pipeline] 1/5: Mengekstrak metadata YouTube untuk ${youtubeUrl}...`);
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

  // 3. Download audio
  console.log(`[Pipeline] 2/5: Mengunduh stream audio untuk transkripsi...`);
  const audioPath = await downloadAudioOnly(youtubeUrl, `audio_${projectId}`);

  // 4. Word-Level Transcription (Groq Whisper)
  console.log(`[Pipeline] 3/5: Mengirim audio ke Groq Whisper-large-v3 untuk word-level timing...`);
  const transcription = await transcribeAudioWordLevel(audioPath);

  // Clean up temporary audio file after transcription
  try {
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
  } catch {}

  // 5. Viral Curation (Google Gemini)
  console.log(`[Pipeline] 4/5: Mengkurasi ${maxClips} momen terbaik dengan Gemini...`);
  const curatedMoments = await curateViralMomentsWithGemini({
    transcription,
    targetDurationSec: clipDuration,
    maxClips,
    videoTitle: meta.title,
  });

  // 6. Precision video download & 9:16 vertical render (FFmpeg + ASS)
  console.log(`[Pipeline] 5/5: Merender ${curatedMoments.length} klip vertikal 9:16 dengan FFmpeg...`);
  const generatedClips: GeneratedClipResult[] = [];

  for (let i = 0; i < curatedMoments.length; i++) {
    const moment = curatedMoments[i]!;
    const clipId = randomUUID();

    // 1. Precision section download via yt-dlp (video + audio merged into mp4)
    const tempSectionDir = getTempDir("temp/sections");
    const sectionPath = path.join(tempSectionDir, `section_${clipId}.mp4`);

    const downloadedPath = await downloadPrecisionSection({
      youtubeUrl,
      startTimeSec: moment.start_time,
      endTimeSec: moment.end_time,
      outputFilePath: sectionPath,
    });

    // 2. Generate .ass subtitle with normalized offset (starts at 0.00s)
    const assPath = generateAssSubtitleFile({
      clipId,
      clipStartTimeSec: moment.start_time,
      clipEndTimeSec: moment.end_time,
      words: moment.words && moment.words.length > 0 ? moment.words : transcription.words,
      preset,
    });

    // 3. Render with FFmpeg (crop 9:16, preserve audio -map 0:a? -c:a aac -b:a 192k, burn-in subtitle)
    const renderRes: RenderResult = await renderVerticalClip({
      clipId,
      sourceVideoPath: downloadedPath,
      assSubtitlePath: assPath,
      durationSec: moment.duration,
      preset,
      enableMotionGraphic: input.enableMotionGraphic ?? preset.motionGraphic.progressBar,
    });

    // Clean up temporary precision section immediately after render
    try {
      if (downloadedPath && fs.existsSync(downloadedPath)) {
        fs.unlinkSync(downloadedPath);
      }
      if (fs.existsSync(assPath)) {
        fs.unlinkSync(assPath);
      }
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

    generatedClips.push({
      id: clipId,
      rank: moment.rank,
      title: moment.title,
      duration: moment.duration,
      viralScore: moment.viral_score,
      viralReason: moment.viral_reason,
      hookDescription: moment.hook_description,
      videoUrl: renderRes.publicUrl,
      downloadUrl: `${renderRes.publicUrl}?download=true`,
      fileSizeMb: renderRes.fileSizeMb,
      presetName: preset.name,
      status: "completed",
    });
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

  return {
    projectId,
    videoTitle: meta.title,
    duration: meta.duration,
    thumbnail: meta.thumbnail,
    youtubeUrl,
    preset,
    clips: generatedClips,
    processedAt: new Date().toISOString(),
  };
}
