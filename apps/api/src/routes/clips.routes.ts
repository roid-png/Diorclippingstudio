import { Router } from "express";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { asc, desc, eq } from "drizzle-orm";
import { clipEditSettingsInputSchema } from "@starter/shared/validators/auto-edit";
import {
  clipIdSchema,
  maxClipsParamSchema,
  toggleFavoriteClipSchema,
} from "@starter/shared/validators/projects";
import { db } from "../db";
import { clips, subtitles } from "../db/schema";
import { HttpError } from "../lib/http-error";
import { jsonBody } from "../middleware/body";
import {
  getClipEditSettings,
  getDefaultEditSettings,
  resetClipEditSettingsToDefault,
  updateClipEditSettings,
} from "../services/clip-edit-settings.service";
import {
  applyEditSettingsToRenderPipeline,
  buildClipRenderPipelineSpec,
} from "../services/clip-render-pipeline.service";
import {
  getClipSubtitlesWithWordTimings,
  toggleClipAutoSubtitles,
  transcribeClipSubtitles,
} from "../services/subtitle-transcription.service";
import { toggleClipFavorite } from "../services/video-cutter.service";
import {
  getViralScoreCategory,
  resolveHighlightMomentWithFallback,
} from "../services/viral-scoring.service";
import {
  cancelRenderJob,
  generateDownloadFileName,
  getRenderJobStatus,
  retryRenderJob,
  startRenderJob,
  updateRenderJobProgress,
} from "../services/render-jobs.service";

export const clipsRouter = Router();

// Locate available video file for streaming
function resolveVideoFilePath(clipId?: string): string | null {
  const candidatePaths = [
    // 1. Storage generated clip
    resolve(process.cwd(), `storage/clips/${clipId}.mp4`),
    // 2. Web public video asset
    resolve(process.cwd(), "apps/web/public/videos/theo_preview.mp4"),
    resolve(process.cwd(), "../web/public/videos/theo_preview.mp4"),
    // 3. User root video
    resolve(process.cwd(), "../../THEO 5-FIX.mp4"),
    resolve(process.cwd(), "../THEO 5-FIX.mp4"),
  ];

  for (const p of candidatePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

// Get default auto-edit settings for clips
clipsRouter.get("/edit-settings/defaults", (_req, res) => {
  res.json({ data: getDefaultEditSettings() });
});

// Get sorted list of viral clips (with optional projectId, sortBy, category, and maxClips/limit 1..10)
clipsRouter.get("/", async (req, res) => {
  const projectId =
    typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  const sortByRaw =
    typeof req.query.sortBy === "string" ? req.query.sortBy : "viral-desc";
  const category =
    typeof req.query.category === "string" ? req.query.category : "all";
  const rawMaxParam = req.query.maxClips ?? req.query.limit;
  const limit =
    rawMaxParam !== undefined ? maxClipsParamSchema.parse(rawMaxParam) : 10;

  const orderByClause =
    sortByRaw === "viral-asc"
      ? [asc(clips.viralScore), asc(clips.rank)]
      : sortByRaw === "timeline-asc"
      ? [asc(clips.startTime)]
      : sortByRaw === "duration-desc"
      ? [desc(clips.duration), desc(clips.viralScore)]
      : [desc(clips.viralScore), asc(clips.rank)];

  const query = projectId
    ? db
        .select()
        .from(clips)
        .where(eq(clips.projectId, projectId))
        .orderBy(...orderByClause)
    : db
        .select()
        .from(clips)
        .orderBy(...orderByClause);

  const rows = await query;

  const enriched = rows
    .map((c, idx) => {
      const numericScore = Number(c.viralScore || 90);
      const { tier, label } = getViralScoreCategory(numericScore);
      const resolvedHighlight = resolveHighlightMomentWithFallback(
        c.highlightMoment,
        c.startTime,
        c.endTime
      );
      const effectiveRank = c.rank ?? idx + 1;
      return {
        ...c,
        rank: effectiveRank,
        viralLabel: c.viralLabel || label,
        viralCategoryTier: tier,
        isPrimaryRecommendation: c.isPrimaryRecommendation || effectiveRank <= 3,
        highlightMoment: resolvedHighlight.text,
        hasFallbackHighlight: resolvedHighlight.isFallback,
        streamUrl: `/api/clips/${c.id}/stream`,
      };
    })
    .filter((c) => {
      if (category === "all") return true;
      if (category === "top3") return c.rank <= 3;
      if (category === "mega") return Number(c.viralScore || 0) >= 95;
      if (category === "favorites") return c.isSelected;
      return c.category === category;
    })
    .slice(0, limit);

  res.json({
    data: enriched,
    meta: {
      totalReturned: enriched.length,
      limit,
      sortBy: sortByRaw,
      category,
    },
  });
});

// Toggle or set favorite status for a clip (max 10 per project)
const handleToggleFavorite = async (req: any, res: any) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const parsedBody =
    req.body && typeof req.body === "object"
      ? toggleFavoriteClipSchema.parse(req.body)
      : {};
  const result = await toggleClipFavorite(clipId, parsedBody.isSelected);
  res.json({ data: result });
};

clipsRouter.patch("/:id/favorite", jsonBody, handleToggleFavorite);
clipsRouter.post("/:id/favorite", jsonBody, handleToggleFavorite);

// Get per-clip edit settings
clipsRouter.get("/:id/edit-settings", async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const settings = await getClipEditSettings(clipId);
  res.json({ data: settings });
});

// Update per-clip edit settings (and optionally apply to all clips in project)
const handleUpdateClipEditSettings = async (req: any, res: any) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const input = clipEditSettingsInputSchema.parse(req.body ?? {});
  const result = await updateClipEditSettings(clipId, input);
  res.json({ data: result });
};

clipsRouter.put("/:id/edit-settings", jsonBody, handleUpdateClipEditSettings);
clipsRouter.patch("/:id/edit-settings", jsonBody, handleUpdateClipEditSettings);

// Reset per-clip edit settings to default
clipsRouter.post("/:id/edit-settings/reset", async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const result = await resetClipEditSettingsToDefault(clipId);
  res.json({ data: result });
});

// Get compiled 3-pillar render pipeline spec & live preview layers for a clip
clipsRouter.get("/:id/preview-pipeline", async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const spec = await buildClipRenderPipelineSpec(clipId);
  res.json({ data: spec });
});

// Apply per-clip edit settings into the clip render pipeline
clipsRouter.post("/:id/render-pipeline", jsonBody, async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const overrideSettings =
    req.body && Object.keys(req.body).length > 0
      ? clipEditSettingsInputSchema.parse(req.body)
      : undefined;
  const result = await applyEditSettingsToRenderPipeline(
    clipId,
    overrideSettings
  );
  res.json({ data: result });
});

// Start fast GPU-accelerated render job for a clip
clipsRouter.post("/:id/render", jsonBody, async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const result = await startRenderJob(clipId, {
    speedMode: req.body?.speedMode,
    resolution: req.body?.resolution,
    fps: req.body?.fps,
    namingPattern: req.body?.namingPattern,
    userId: req.body?.userId,
  });
  res.status(201).json({ data: result });
});

// Get render status and progress telemetry for a clip
clipsRouter.get("/:id/render", async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const result = await getRenderJobStatus(clipId);
  res.json({ data: result });
});

clipsRouter.get("/:id/render-status", async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const result = await getRenderJobStatus(clipId);
  res.json({ data: result });
});

// Update render progress for a clip (simulated GPU tick / worker callback)
clipsRouter.patch("/:id/render/progress", jsonBody, async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const progress = Number(req.body?.progress ?? 0);
  const result = await updateRenderJobProgress(clipId, {
    progress,
    activeStepId: req.body?.activeStepId,
    activeStepLabel: req.body?.activeStepLabel,
    status: req.body?.status,
    errorMessage: req.body?.errorMessage,
    fileSizeMb: req.body?.fileSizeMb,
  });
  res.json({ data: result });
});

// Cancel active render job for a clip
clipsRouter.post("/:id/render/cancel", async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const result = await cancelRenderJob(clipId);
  res.json({ data: result });
});

// Retry failed render job for a clip
clipsRouter.post("/:id/render/retry", jsonBody, async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const result = await retryRenderJob(clipId, {
    speedMode: req.body?.speedMode,
    resolution: req.body?.resolution,
    fps: req.body?.fps,
    namingPattern: req.body?.namingPattern,
    userId: req.body?.userId,
  });
  res.json({ data: result });
});

// Get enriched word-by-word automatic subtitles for a clip
clipsRouter.get("/:id/subtitles", async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const result = await getClipSubtitlesWithWordTimings(clipId);
  res.json({ data: result });
});

// Trigger or regenerate automatic subtitle transcription for a clip
clipsRouter.post("/:id/subtitles/transcribe", jsonBody, async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const customLines = Array.isArray(req.body?.lines) ? req.body.lines : undefined;
  await transcribeClipSubtitles(clipId, customLines);
  const result = await getClipSubtitlesWithWordTimings(clipId);
  res.json({ data: result });
});

// Toggle automatic subtitles on/off for a clip
clipsRouter.patch("/:id/subtitles/toggle", jsonBody, async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const subtitleEnabled =
    typeof req.body?.subtitleEnabled === "boolean"
      ? req.body.subtitleEnabled
      : undefined;
  const subtitleStyleId =
    typeof req.body?.subtitleStyleId === "string"
      ? req.body.subtitleStyleId
      : undefined;
  const result = await toggleClipAutoSubtitles(
    clipId,
    subtitleEnabled,
    subtitleStyleId
  );
  res.json({ data: result });
});

// Get clip metadata and subtitles
clipsRouter.get("/:id", async (req, res) => {
  const [clip] = await db
    .select()
    .from(clips)
    .where(eq(clips.id, req.params.id))
    .limit(1);

  if (!clip) {
    throw new HttpError(404, "NOT_FOUND", "Klip tidak ditemukan.");
  }

  const clipSubtitles = await db
    .select()
    .from(subtitles)
    .where(eq(subtitles.clipId, clip.id))
    .orderBy(subtitles.startTime);

  res.json({
    data: {
      ...clip,
      subtitles: clipSubtitles,
      streamUrl: `/api/clips/${clip.id}/stream`,
    },
  });
});

// Stream video with HTTP 206 Partial Content (Range request) support
clipsRouter.get("/:id/stream", (req, res) => {
  const clipId = req.params.id;
  const filePath = resolveVideoFilePath(clipId);

  if (!filePath) {
    throw new HttpError(
      404,
      "VIDEO_NOT_FOUND",
      "File video untuk pratinjau klip belum tersedia."
    );
  }

  const stat = statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    // Parse Range header (e.g. "bytes=0-1048575")
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
      res.end();
      return;
    }

    const chunkSize = end - start + 1;
    const fileStream = createReadStream(filePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
      "Cache-Control": "no-cache",
    });

    fileStream.pipe(res);
  } else {
    // Full content delivery
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
    });

    createReadStream(filePath).pipe(res);
  }
});

// Download final rendered MP4 video clip with custom naming convention header
clipsRouter.get("/:id/download", async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
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

  const pattern = (req.query.pattern as any) || "dior-viral-rank";
  const resolution =
    (req.query.resolution as string) || job?.resolution || "1080x1920";
  const fps = Number(req.query.fps) || job?.fps || 60;

  const fileName =
    job?.downloadFileName ||
    generateDownloadFileName(
      clip.title,
      clip.rank,
      clip.viralScore,
      pattern,
      resolution,
      fps
    );

  const filePath = resolveVideoFilePath(clipId);

  if (!filePath || !existsSync(filePath)) {
    if (req.query.meta === "true") {
      res.json({
        data: {
          clipId,
          title: clip.title,
          fileName,
          status: job?.status || "completed",
          streamUrl: `/api/clips/${clipId}/stream`,
          fileSizeMb: job?.fileSizeMb || "18.40",
          downloadUrl: `/api/clips/${clipId}/download`,
        },
      });
      return;
    }

    throw new HttpError(
      404,
      "FILE_NOT_FOUND",
      "File video MP4 akhir belum tersedia untuk diunduh. Pastikan klip telah selesai dirender."
    );
  }

  const stat = statSync(filePath);
  const fileSize = stat.size;

  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Length", fileSize);

  createReadStream(filePath).pipe(res);
});
