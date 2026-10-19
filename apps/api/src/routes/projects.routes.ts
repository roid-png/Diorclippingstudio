import { Router } from "express";
import {
  batchSelectFavoriteClipsSchema,
  clipIdSchema,
  createProjectSchema,
  maxClipsParamSchema,
  projectIdSchema,
  listProjectsQuerySchema,
  toggleFavoriteClipSchema,
  updateProjectMaxClipsSchema,
} from "@starter/shared/validators/projects";
import { HttpError } from "../lib/http-error";
import { getAuth, requireAuth } from "../middleware/auth";
import { jsonBody } from "../middleware/body";
import { requireTrustedOrigin } from "../middleware/origin";
import {
  createProjectJob,
  deleteProject,
  getProjectById,
  getProjectStatusAndClips,
  getUserQuota,
  listUserProjects,
  toggleProjectPin,
  updateProjectMaxClips,
} from "../services/projects.service";
import {
  autoCutProjectVideo,
  batchUpdateFavoriteClips,
  getProjectClips,
  toggleClipFavorite,
} from "../services/video-cutter.service";

export const projectsRouter = Router();

projectsRouter.use(requireAuth, requireTrustedOrigin);

// Get current user's clipping quota
projectsRouter.get("/quota", async (req, res) => {
  const userId = getAuth(req).user.id;
  const quota = await getUserQuota(userId);
  res.json({ data: quota });
});

// Create new video clipping job with quota check and auto-cut
projectsRouter.post("/", jsonBody, async (req, res) => {
  const userId = getAuth(req).user.id;
  const input = createProjectSchema.parse(req.body);
  const result = await createProjectJob(userId, input);
  res.status(201).location(`/api/projects/${result.project.id}`).json({ data: result });
});

// Trigger auto-cut for existing project (supports optional maxClips 1..10 in body/query)
projectsRouter.post("/:id/cut", jsonBody, async (req, res) => {
  const userId = getAuth(req).user.id;
  const id = projectIdSchema.parse(req.params.id);
  const project = await getProjectById(userId, id);
  if (!project) throw new HttpError(404, "NOT_FOUND", "Proyek tidak ditemukan.");

  const rawMaxClips = req.body?.maxClips ?? req.query.maxClips;
  const overrideMaxClips =
    rawMaxClips !== undefined ? maxClipsParamSchema.parse(rawMaxClips) : undefined;

  const generatedClips = await autoCutProjectVideo(id, overrideMaxClips);
  res.json({ data: { project, clips: generatedClips, maxClips: overrideMaxClips ?? project.maxClips } });
});

// Update maxClips (1..10) configuration for a project
const handleUpdateMaxClips = async (req: any, res: any) => {
  const userId = getAuth(req).user.id;
  const id = projectIdSchema.parse(req.params.id);
  const { maxClips, regenerateClips } = updateProjectMaxClipsSchema.parse(req.body);
  const result = await updateProjectMaxClips(userId, id, maxClips, regenerateClips);
  res.json({ data: result });
};

projectsRouter.patch("/:id/max-clips", jsonBody, handleUpdateMaxClips);
projectsRouter.put("/:id/max-clips", jsonBody, handleUpdateMaxClips);

// Get job status and clips for polling
projectsRouter.get("/:id/status", async (req, res) => {
  const userId = getAuth(req).user.id;
  const id = projectIdSchema.parse(req.params.id);
  const statusInfo = await getProjectStatusAndClips(userId, id);
  if (!statusInfo) throw new HttpError(404, "NOT_FOUND", "Proyek tidak ditemukan.");
  res.json({ data: statusInfo });
});

// Get sorted & filtered viral clips for a project (bounded by maxClips / limit 1..10)
projectsRouter.get("/:id/clips", async (req, res) => {
  const userId = getAuth(req).user.id;
  const id = projectIdSchema.parse(req.params.id);
  const project = await getProjectById(userId, id);
  if (!project) throw new HttpError(404, "NOT_FOUND", "Proyek tidak ditemukan.");

  const sortByRaw = typeof req.query.sortBy === "string" ? req.query.sortBy : undefined;
  const sortBy =
    sortByRaw === "viral-asc" ||
    sortByRaw === "timeline-asc" ||
    sortByRaw === "duration-desc"
      ? sortByRaw
      : "viral-desc";
  const category =
    typeof req.query.category === "string" ? req.query.category : undefined;

  const rawMaxParam = req.query.maxClips ?? req.query.limit;
  const maxClips =
    rawMaxParam !== undefined
      ? maxClipsParamSchema.parse(rawMaxParam)
      : Math.min(Math.max(1, project.maxClips || 10), 10);

  const clips = await getProjectClips(id, { sortBy, category, maxClips });
  res.json({
    data: clips,
    meta: {
      maxClips,
      totalReturned: clips.length,
      sortBy,
      category: category || "all",
    },
  });
});

// Toggle favorite status for a single clip within a project (max 10)
projectsRouter.patch("/:id/clips/:clipId/favorite", jsonBody, async (req, res) => {
  const userId = getAuth(req).user.id;
  const id = projectIdSchema.parse(req.params.id);
  const clipId = clipIdSchema.parse(req.params.clipId);
  const project = await getProjectById(userId, id);
  if (!project) throw new HttpError(404, "NOT_FOUND", "Proyek tidak ditemukan.");

  const parsedBody =
    req.body && typeof req.body === "object"
      ? toggleFavoriteClipSchema.parse(req.body)
      : {};
  const result = await toggleClipFavorite(clipId, parsedBody.isSelected);
  res.json({ data: result });
});

// Batch update favorite clips for a project (max 10)
projectsRouter.put("/:id/clips/favorites", jsonBody, async (req, res) => {
  const userId = getAuth(req).user.id;
  const id = projectIdSchema.parse(req.params.id);
  const project = await getProjectById(userId, id);
  if (!project) throw new HttpError(404, "NOT_FOUND", "Proyek tidak ditemukan.");

  const { clipIds } = batchSelectFavoriteClipsSchema.parse(req.body);
  const result = await batchUpdateFavoriteClips(id, clipIds);
  res.json({ data: result });
});

// List user projects with history filtering and search
projectsRouter.get("/", async (req, res) => {
  const userId = getAuth(req).user.id;
  const query = listProjectsQuerySchema.parse(req.query);
  const projects = await listUserProjects(userId, query);
  res.json({ data: projects });
});

// Get single project by ID with clips
projectsRouter.get("/:id", async (req, res) => {
  const userId = getAuth(req).user.id;
  const id = projectIdSchema.parse(req.params.id);
  const project = await getProjectById(userId, id);
  if (!project) throw new HttpError(404, "NOT_FOUND", "Proyek tidak ditemukan.");
  res.json({ data: project });
});

// Toggle or update pinned status for a project
projectsRouter.patch("/:id/pin", jsonBody, async (req, res) => {
  const userId = getAuth(req).user.id;
  const id = projectIdSchema.parse(req.params.id);
  const isPinned =
    typeof req.body?.isPinned === "boolean" ? req.body.isPinned : undefined;
  const result = await toggleProjectPin(userId, id, isPinned);
  res.json({ data: result });
});

// Delete project from user's history
projectsRouter.delete("/:id", async (req, res) => {
  const userId = getAuth(req).user.id;
  const id = projectIdSchema.parse(req.params.id);
  const result = await deleteProject(userId, id);
  res.json({ data: result });
});

