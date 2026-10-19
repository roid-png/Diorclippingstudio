import { Router } from "express";
import {
  batchSelectFavoriteClipsSchema,
  clipIdSchema,
  createProjectSchema,
  projectIdSchema,
  toggleFavoriteClipSchema,
} from "@starter/shared/validators/projects";
import { HttpError } from "../lib/http-error";
import { getAuth, requireAuth } from "../middleware/auth";
import { jsonBody } from "../middleware/body";
import { requireTrustedOrigin } from "../middleware/origin";
import {
  createProjectJob,
  getProjectById,
  getProjectStatusAndClips,
  getUserQuota,
  listUserProjects,
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

// Trigger auto-cut for existing project
projectsRouter.post("/:id/cut", async (req, res) => {
  const userId = getAuth(req).user.id;
  const id = projectIdSchema.parse(req.params.id);
  const project = await getProjectById(userId, id);
  if (!project) throw new HttpError(404, "NOT_FOUND", "Proyek tidak ditemukan.");
  const generatedClips = await autoCutProjectVideo(id);
  res.json({ data: { project, clips: generatedClips } });
});

// Get job status and clips for polling
projectsRouter.get("/:id/status", async (req, res) => {
  const userId = getAuth(req).user.id;
  const id = projectIdSchema.parse(req.params.id);
  const statusInfo = await getProjectStatusAndClips(userId, id);
  if (!statusInfo) throw new HttpError(404, "NOT_FOUND", "Proyek tidak ditemukan.");
  res.json({ data: statusInfo });
});

// Get sorted & filtered viral clips for a project
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
  const limit =
    typeof req.query.limit === "string" && !Number.isNaN(Number(req.query.limit))
      ? Number(req.query.limit)
      : undefined;

  const clips = await getProjectClips(id, { sortBy, category, limit });
  res.json({ data: clips });
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

// List user projects
projectsRouter.get("/", async (req, res) => {
  const userId = getAuth(req).user.id;
  const projects = await listUserProjects(userId);
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

