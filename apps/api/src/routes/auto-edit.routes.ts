import { Router } from "express";
import {
  clipEditSettingsInputSchema,
  createStylePresetSchema,
} from "@starter/shared/validators/auto-edit";
import { clipIdSchema } from "@starter/shared/validators/projects";
import { jsonBody } from "../middleware/body";
import {
  getClipEditSettings,
  getDefaultEditSettings,
  resetClipEditSettingsToDefault,
  updateClipEditSettings,
} from "../services/clip-edit-settings.service";
import {
  createCustomMotionGraphicPreset,
  getMotionGraphicPresetById,
  listMotionGraphicPresets,
} from "../services/motion-graphic-presets.service";

export const autoEditRouter = Router();

// Get default auto-edit configuration & 3-pillar quick combo presets
autoEditRouter.get("/defaults", (_req, res) => {
  res.json({ data: getDefaultEditSettings() });
});

// List all motion graphic styles (built-in + custom AI-learned presets)
autoEditRouter.get("/motion-graphics", async (_req, res) => {
  const presets = await listMotionGraphicPresets();
  res.json({
    data: presets,
    meta: {
      total: presets.length,
      defaultId: "theo-infographics",
    },
  });
});

// Get detail and preview simulation keyframes for a specific motion graphic style
autoEditRouter.get("/motion-graphics/:id", async (req, res) => {
  const preset = await getMotionGraphicPresetById(req.params.id);
  res.json({ data: preset });
});

// Create a custom motion graphic preset from a reference video/folder
autoEditRouter.post("/motion-graphics", jsonBody, async (req, res) => {
  const input = createStylePresetSchema.parse(req.body ?? {});
  const created = await createCustomMotionGraphicPreset(input);
  res.status(201).json({ data: created });
});

// Get per-clip edit settings (falls back to default if not yet initialized)
autoEditRouter.get("/clips/:id/settings", async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const settings = await getClipEditSettings(clipId);
  res.json({ data: settings });
});

// Update per-clip edit settings (with optional applyToAllProjectClips)
const handleUpdateClipSettings = async (req: any, res: any) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const input = clipEditSettingsInputSchema.parse(req.body ?? {});
  const result = await updateClipEditSettings(clipId, input);
  res.json({ data: result });
};

autoEditRouter.put("/clips/:id/settings", jsonBody, handleUpdateClipSettings);
autoEditRouter.patch("/clips/:id/settings", jsonBody, handleUpdateClipSettings);

// Reset per-clip edit settings to default
autoEditRouter.post("/clips/:id/settings/reset", async (req, res) => {
  const clipId = clipIdSchema.parse(req.params.id);
  const result = await resetClipEditSettingsToDefault(clipId);
  res.json({ data: result });
});


