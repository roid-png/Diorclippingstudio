import { Router } from "express";
import { clipIdSchema, projectIdSchema } from "@starter/shared/validators/projects";
import { jsonBody } from "../middleware/body";
import {
  cancelRenderJob,
  getProjectRenderTelemetry,
  getRenderJobStatus,
  retryRenderJob,
  startRenderJob,
  updateRenderJobProgress,
} from "../services/render-jobs.service";
import { notificationsRouter } from "./notifications.routes";
import { processVideoRouter } from "./process-video.routes";

export const renderRouter = Router();

// Full pipeline execution endpoint aliases
renderRouter.post("/", processVideoRouter);
renderRouter.post("/direct-upload", processVideoRouter);

// Start GPU-accelerated render job for a clip
renderRouter.post("/start", jsonBody, async (req, res) => {
  const clipId = clipIdSchema.parse(req.body?.clipId);
  const result = await startRenderJob(clipId, {
    speedMode: req.body?.speedMode,
    resolution: req.body?.resolution,
    fps: req.body?.fps,
    namingPattern: req.body?.namingPattern,
    userId: req.body?.userId,
  });
  res.status(201).json({ data: result });
});

// Start render for a specific clip ID via route param
renderRouter.post("/:clipId/start", jsonBody, async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.clipId);
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
renderRouter.get("/:clipId/status", async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.clipId);
  const result = await getRenderJobStatus(clipId);
  res.json({ data: result });
});

// Update render progress for a clip (simulated GPU tick / worker callback)
renderRouter.patch("/:clipId/progress", jsonBody, async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.clipId);
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

// Get aggregated render progress and telemetry for an entire project
renderRouter.get("/project/:projectId", async (req, res) => {
  const projectId = projectIdSchema.parse(req.params.projectId);
  const result = await getProjectRenderTelemetry(projectId);
  res.json({ data: result });
});

// Cancel an active render job
renderRouter.post("/:clipId/cancel", async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.clipId);
  const result = await cancelRenderJob(clipId);
  res.json({ data: result });
});

// Retry a failed render job
renderRouter.post("/:clipId/retry", jsonBody, async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.clipId);
  const result = await retryRenderJob(clipId, {
    speedMode: req.body?.speedMode,
    resolution: req.body?.resolution,
    fps: req.body?.fps,
    namingPattern: req.body?.namingPattern,
    userId: req.body?.userId,
  });
  res.json({ data: result });
});

// Download final MP4 video clip via render router
renderRouter.get("/:clipId/download", (req, res) => {
  const clipId = clipIdSchema.parse(req.params.clipId);
  res.redirect(`/api/clips/${clipId}/download?${new URLSearchParams(req.query as any).toString()}`);
});

// Notifications sub-router mounted under /render/notifications
renderRouter.use("/notifications", notificationsRouter);
