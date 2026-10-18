import { Router } from "express";
import {
  createProjectSchema,
  projectIdSchema,
} from "@starter/shared/validators/projects";
import { HttpError } from "../lib/http-error";
import { getAuth, requireAuth } from "../middleware/auth";
import { jsonBody } from "../middleware/body";
import { requireTrustedOrigin } from "../middleware/origin";
import {
  createProjectJob,
  getProjectById,
  getUserQuota,
  listUserProjects,
} from "../services/projects.service";
import {
  autoCutProjectVideo,
  getProjectClips,
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

// Get clips for a project
projectsRouter.get("/:id/clips", async (req, res) => {
  const userId = getAuth(req).user.id;
  const id = projectIdSchema.parse(req.params.id);
  const project = await getProjectById(userId, id);
  if (!project) throw new HttpError(404, "NOT_FOUND", "Proyek tidak ditemukan.");
  const clips = await getProjectClips(id);
  res.json({ data: clips });
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
