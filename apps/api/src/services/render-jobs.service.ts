import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { clips, notifications, projects, renderJobs } from "../db/schema";
import { HttpError } from "../lib/http-error";
import { buildClipRenderPipelineSpec } from "./clip-render-pipeline.service";

export interface StartRenderJobOptions {
  speedMode?: "turbo-fast" | "cinema-hq";
  resolution?: "1080x1920" | "720x1280";
  fps?: 60 | 30;
  namingPattern?: "dior-viral-rank" | "tiktok-reels-seo" | "studio-timestamp";
  userId?: string;
}

export function generateDownloadFileName(
  clipTitle: string,
  rank: number | null,
  viralScore: string | number | null,
  pattern: "dior-viral-rank" | "tiktok-reels-seo" | "studio-timestamp" = "dior-viral-rank",
  resolution = "1080x1920",
  fps = 60
): string {
  const cleanTitle = (clipTitle || "Klip-Viral")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 42);
  const scoreNum = Math.round(Number(viralScore) || 90);
  const rankStr = String(rank || 1).padStart(2, "0");
  const resLabel = resolution === "1080x1920" ? "1080p" : "720p";

  if (pattern === "tiktok-reels-seo") {
    return `${cleanTitle}_ViralShorts_${resLabel}_${fps}fps.mp4`;
  }
  if (pattern === "studio-timestamp") {
    const ts = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
    return `DIOR_Studio_${ts}_Rank${rankStr}.mp4`;
  }
  return `DIOR-Viral-Rank${rankStr}_${cleanTitle}_Score${scoreNum}_${resLabel}_${fps}fps.mp4`;
}

/**
 * Starts a fast GPU-accelerated render job for a given clip.
 */
export async function startRenderJob(
  clipId: string,
  options: StartRenderJobOptions = {}
) {
  const [clip] = await db
    .select()
    .from(clips)
    .where(eq(clips.id, clipId))
    .limit(1);

  if (!clip) {
    throw new HttpError(404, "CLIP_NOT_FOUND", "Klip tidak ditemukan.");
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, clip.projectId))
    .limit(1);

  const speedMode = options.speedMode || "turbo-fast";
  const resolution = options.resolution || "1080x1920";
  const fps = options.fps || 60;
  const namingPattern = options.namingPattern || "dior-viral-rank";
  const userId = options.userId || project?.userId || "user-dev-demo";

  const pipelineSpec = await buildClipRenderPipelineSpec(clipId);
  const resolvedFileName = generateDownloadFileName(
    clip.title,
    clip.rank,
    clip.viralScore,
    namingPattern,
    resolution,
    fps
  );

  const [existingJob] = await db
    .select()
    .from(renderJobs)
    .where(eq(renderJobs.clipId, clipId))
    .orderBy(desc(renderJobs.createdAt))
    .limit(1);

  const jobPayload = {
    clipId,
    subtitleEnabled: pipelineSpec.activePillarSummary.subtitle.enabled,
    motionGraphicStyle: pipelineSpec.activePillarSummary.motionGraphic.id,
    editStyle: pipelineSpec.activePillarSummary.editingStyle.id,
    speedMode,
    resolution,
    fps,
    status: "rendering",
    progress: 15,
    activeStepId: "crop-9-16",
    activeStepLabel: "Auto-Reframe vertikal 9:16 (Smart Zoom & Pan)",
    outputUrl: `/api/clips/${clipId}/stream`,
    downloadFileName: resolvedFileName,
    fileSizeMb: "18.40",
    errorMessage: null,
    completedAt: null,
  };

  const [job] = existingJob
    ? await db
        .update(renderJobs)
        .set(jobPayload)
        .where(eq(renderJobs.id, existingJob.id))
        .returning()
    : await db.insert(renderJobs).values(jobPayload).returning();

  // Create initial starting notification
  if (userId) {
    await db.insert(notifications).values({
      userId,
      clipId,
      renderJobId: job.id,
      type: "info",
      title: clip.title,
      message: `Render MP4 9:16 dimulai (${resolution} ${fps}FPS • Mode ${speedMode}).`,
      fileName: resolvedFileName,
      isRead: false,
    });
  }

  return {
    job,
    pipelineSpec,
    fileName: resolvedFileName,
  };
}

/**
 * Gets the current render job status for a clip.
 */
export async function getRenderJobStatus(clipId: string) {
  const [clip] = await db
    .select()
    .from(clips)
    .where(eq(clips.id, clipId))
    .limit(1);

  if (!clip) {
    throw new HttpError(404, "CLIP_NOT_FOUND", "Klip tidak ditemukan.");
  }

  const [job] = await db
    .select()
    .from(renderJobs)
    .where(eq(renderJobs.clipId, clipId))
    .orderBy(desc(renderJobs.createdAt))
    .limit(1);

  if (!job) {
    return {
      clipId,
      hasJob: false,
      status: "idle",
      progress: 0,
      activeStepId: "crop-9-16",
      activeStepLabel: "Siap dirender dengan preset 3 pilar",
    };
  }

  return {
    clipId,
    hasJob: true,
    job,
  };
}

/**
 * Cancels an active render job.
 */
export async function cancelRenderJob(clipId: string) {
  const [job] = await db
    .select()
    .from(renderJobs)
    .where(eq(renderJobs.clipId, clipId))
    .orderBy(desc(renderJobs.createdAt))
    .limit(1);

  if (!job) {
    throw new HttpError(404, "JOB_NOT_FOUND", "Job render tidak ditemukan.");
  }

  const [updated] = await db
    .update(renderJobs)
    .set({
      status: "idle",
      progress: 0,
      activeStepLabel: "Render dibatalkan • Siap dirender ulang",
      errorMessage: null,
    })
    .where(eq(renderJobs.id, job.id))
    .returning();

  return updated;
}

/**
 * Retries a failed render job.
 */
export async function retryRenderJob(
  clipId: string,
  options: StartRenderJobOptions = {}
) {
  return startRenderJob(clipId, options);
}
