import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { clips, notifications, projects, renderJobs } from "../db/schema";
import { HttpError } from "../lib/http-error";
import { buildClipRenderPipelineSpec } from "./clip-render-pipeline.service";
import { getClipEditSettings } from "./clip-edit-settings.service";

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
      etaSeconds: 5,
      downloadUrl: null,
    };
  }

  const etaSeconds =
    job.status === "completed"
      ? 0
      : job.status === "failed"
      ? 0
      : Math.max(1, Math.ceil(((100 - job.progress) / 15) * 0.4));

  return {
    clipId,
    hasJob: true,
    job,
    progress: job.progress,
    status: job.status,
    activeStepId: job.activeStepId,
    activeStepLabel: job.activeStepLabel,
    etaSeconds,
    downloadUrl:
      job.status === "completed" ? `/api/clips/${clipId}/download` : null,
  };
}

/**
 * Updates render progress for a clip (simulated engine tick or worker update).
 */
export async function updateRenderJobProgress(
  clipId: string,
  update: {
    progress: number;
    activeStepId?: string;
    activeStepLabel?: string;
    status?: string;
    errorMessage?: string;
    fileSizeMb?: string;
  }
) {
  const [job] = await db
    .select()
    .from(renderJobs)
    .where(eq(renderJobs.clipId, clipId))
    .orderBy(desc(renderJobs.createdAt))
    .limit(1);

  if (!job) {
    throw new HttpError(404, "JOB_NOT_FOUND", "Job render tidak ditemukan.");
  }

  const [clip] = await db
    .select()
    .from(clips)
    .where(eq(clips.id, clipId))
    .limit(1);

  const [project] = clip
    ? await db
        .select()
        .from(projects)
        .where(eq(projects.id, clip.projectId))
        .limit(1)
    : [null];

  const userId = project?.userId || "user-dev-demo";
  const nextProgress = Math.min(100, Math.max(0, update.progress));
  const isNowCompleted = nextProgress >= 100 || update.status === "completed";
  const isFailed = update.status === "failed";

  const nextStatus = isFailed
    ? "failed"
    : isNowCompleted
    ? "completed"
    : update.status || "rendering";

  const [updated] = await db
    .update(renderJobs)
    .set({
      progress: isFailed ? update.progress : isNowCompleted ? 100 : nextProgress,
      status: nextStatus,
      activeStepId: update.activeStepId ?? job.activeStepId,
      activeStepLabel: isNowCompleted
        ? "Selesai dirender • Siap diunduh"
        : update.activeStepLabel ?? job.activeStepLabel,
      errorMessage: update.errorMessage ?? null,
      fileSizeMb: update.fileSizeMb ?? job.fileSizeMb,
      completedAt: isNowCompleted ? new Date() : job.completedAt,
    })
    .where(eq(renderJobs.id, job.id))
    .returning();

  // Create completion or error notification if status changed to terminal
  if (isNowCompleted && job.status !== "completed") {
    await db.insert(notifications).values({
      userId,
      clipId,
      renderJobId: job.id,
      type: "success",
      title: clip?.title || "Klip Viral",
      message: `Render MP4 9:16 selesai (${job.resolution} ${job.fps}FPS • ${job.fileSizeMb || 18.4} MB). Klip siap diunduh!`,
      fileName: job.downloadFileName,
      isRead: false,
    });
  } else if (isFailed && job.status !== "failed") {
    await db.insert(notifications).values({
      userId,
      clipId,
      renderJobId: job.id,
      type: "error",
      title: clip?.title || "Klip Viral",
      message:
        update.errorMessage ||
        "Gagal merender klip. Klik Coba Lagi untuk mengulang.",
      fileName: job.downloadFileName,
      isRead: false,
    });
  }

  return updated;
}

/**
 * Gets aggregated render telemetry for an entire project.
 */
export async function getProjectRenderTelemetry(projectId: string) {
  const projectClips = await db
    .select()
    .from(clips)
    .where(eq(clips.projectId, projectId));

  if (projectClips.length === 0) {
    return {
      projectId,
      totalClips: 0,
      completedClips: 0,
      renderingClips: 0,
      queuedClips: 0,
      failedClips: 0,
      overallProgress: 0,
      speedRateLabel: "~4.2 dtk/klip",
      clips: [],
    };
  }

  const clipIds = projectClips.map((c) => c.id);
  const jobs = await db
    .select()
    .from(renderJobs)
    .where(inArray(renderJobs.clipId, clipIds));

  const jobMap = new Map(jobs.map((j) => [j.clipId, j]));

  let totalProgressAcc = 0;
  let completedCount = 0;
  let renderingCount = 0;
  let queuedCount = 0;
  let failedCount = 0;

  const clipTelemetry = projectClips.map((clip) => {
    const job = jobMap.get(clip.id);
    const status = job ? job.status : "idle";
    const progress = job ? job.progress : 0;

    totalProgressAcc += status === "completed" ? 100 : progress;

    if (status === "completed") completedCount++;
    else if (status === "rendering") renderingCount++;
    else if (status === "queued") queuedCount++;
    else if (status === "failed") failedCount++;

    return {
      clipId: clip.id,
      title: clip.title,
      rank: clip.rank,
      viralScore: clip.viralScore,
      duration: clip.duration,
      status,
      progress,
      activeStepId: job?.activeStepId || "crop-9-16",
      activeStepLabel: job?.activeStepLabel || "Siap dirender",
      speedMode: job?.speedMode || "turbo-fast",
      resolution: job?.resolution || "1080x1920",
      fps: job?.fps || 60,
      outputUrl: job?.outputUrl || null,
      downloadFileName: job?.downloadFileName || null,
      fileSizeMb: job?.fileSizeMb || "18.40",
      errorMessage: job?.errorMessage || null,
    };
  });

  const overallProgress = Math.round(
    totalProgressAcc / Math.max(1, projectClips.length)
  );

  return {
    projectId,
    totalClips: projectClips.length,
    completedClips: completedCount,
    renderingClips: renderingCount,
    queuedClips: queuedCount,
    failedClips: failedCount,
    overallProgress,
    speedRateLabel: "~4.2 dtk/klip (Akselerasi NVENC)",
    clips: clipTelemetry,
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
 * Retries a failed or cancelled render job without losing custom edit settings (subtitles, motion graphics, edit style).
 */
export async function retryRenderJob(
  clipId: string,
  options: StartRenderJobOptions = {}
) {
  const [existingJob] = await db
    .select()
    .from(renderJobs)
    .where(eq(renderJobs.clipId, clipId))
    .orderBy(desc(renderJobs.createdAt))
    .limit(1);

  // Preserve custom 3-pillar settings configured by the user
  const preservedEditSettings = await getClipEditSettings(clipId);

  // Preserve existing configuration options if not explicitly overridden
  const mergedOptions: StartRenderJobOptions = {
    speedMode:
      options.speedMode ||
      (existingJob?.speedMode as "turbo-fast" | "cinema-hq") ||
      "turbo-fast",
    resolution:
      options.resolution ||
      (existingJob?.resolution as "1080x1920" | "720x1280") ||
      "1080x1920",
    fps: options.fps || (existingJob?.fps as 60 | 30) || 60,
    namingPattern: options.namingPattern || "dior-viral-rank",
    userId: options.userId,
  };

  const result = await startRenderJob(clipId, mergedOptions);

  // Send informational notification about retry preserving settings
  if (result.job && mergedOptions.userId) {
    await db.insert(notifications).values({
      userId: mergedOptions.userId,
      clipId,
      renderJobId: result.job.id,
      type: "info",
      title: "Mencoba Lagi Render",
      message: `Render diulang untuk klip ini dengan pengaturan 3 pilar tetap dipertahankan (${preservedEditSettings.editingStyleId} • ${preservedEditSettings.motionGraphicId} • ${preservedEditSettings.subtitleStyleId}).`,
      fileName: result.fileName,
      isRead: false,
    });
  }

  return {
    ...result,
    isRetry: true,
    preservedEditSettings,
  };
}

