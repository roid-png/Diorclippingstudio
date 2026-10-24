import express, { Router, type Request, type Response } from "express";
import { z } from "zod";
import { listAllPresets, savePreset, getPresetById, deletePreset } from "../services/presets.service";
import {
  getActiveTempCloneBlueprint,
  saveBlueprintAsPreset,
} from "../services/clone_engine/universal_style_analyzer";

export const presetsRouter = Router();

presetsRouter.use(express.json());

const createPresetSchema = z.object({
  id: z.string().min(2, "ID preset minimal 2 karakter."),
  name: z.string().min(2, "Nama preset minimal 2 karakter."),
  description: z.string().optional(),
  format: z.string().default("9:16"),
  width: z.number().default(1080),
  height: z.number().default(1920),
  colorGrading: z.string().optional(),
  transition: z.string().optional(),
  pipelineMode: z.string().optional(),
  accentColor: z.string().optional(),
  enableHook: z.boolean().optional(),
  enableTopMotion: z.boolean().optional(),
  enablePolish: z.boolean().optional(),
  badge: z.string().optional(),
  isCustom: z.boolean().optional(),
  isCloned: z.boolean().optional(),
  subtitleStyle: z
    .object({
      fontName: z.string().default("Montserrat ExtraBold"),
      fontSize: z.number().default(26),
      primaryColor: z.string().default("&H00FFFFFF"),
      highlightColor: z.string().default("#E50914"),
      outlineColor: z.string().default("&H00000000"),
      outlineWidth: z.number().default(2),
      alignment: z.number().default(2),
      marginV: z.number().default(370),
      bold: z.boolean().default(true),
      animation: z.string().optional(),
      bounceScale: z.number().optional(),
      showSpeakerTag: z.boolean().optional(),
    })
    .optional(),
  motionGraphic: z
    .object({
      progressBar: z.boolean().default(true),
      punchZoom: z.boolean().default(false),
      punchZoomScale: z.number().default(1.15),
    })
    .optional(),
});

/**
 * GET /api/presets
 * Dynamically lists all available editing presets from presets directory.
 */
presetsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const presets = await listAllPresets();
    res.status(200).json({
      success: true,
      data: presets,
      total: presets.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: "FETCH_PRESETS_FAILED",
      message: err?.message || "Gagal membaca daftar preset.",
    });
  }
});

/**
 * GET /api/presets/:id
 * Retrieves a single preset configuration.
 */
presetsRouter.get("/:id", async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const presetId = (Array.isArray(rawId) ? rawId[0] : rawId) || "";
  try {
    const preset = await getPresetById(presetId);
    if (!preset) {
      res.status(404).json({
        success: false,
        error: "PRESET_NOT_FOUND",
        message: `Preset "${presetId}" tidak ditemukan.`,
      });
      return;
    }
    res.status(200).json({
      success: true,
      data: preset,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: "FETCH_PRESET_FAILED",
      message: err?.message || "Gagal mengambil data preset.",
    });
  }
});

/**
 * POST /api/presets
 * Registers or updates a preset configuration JSON physically to disk.
 * Returns the saved preset and the updated full presets list.
 */
presetsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = createPresetSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: firstIssue?.message || "Format data preset tidak valid.",
    });
    return;
  }

  try {
    const saved = await savePreset(parsed.data as any);
    const allPresets = await listAllPresets();
    res.status(201).json({
      success: true,
      message: `Preset "${saved.name}" berhasil didaftarkan ke server.`,
      data: saved,
      allPresets,
    });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 400;
    res.status(status).json({
      success: false,
      error: err?.code || "SAVE_PRESET_FAILED",
      message: err?.message || "Gagal menyimpan preset.",
    });
  }
});

/**
 * POST /api/presets/save-from-blueprint & POST /api/presets/save-from-clone
 * [FASE 4 & 5: TOMBOL MANUAL "SIMPAN KE PRESET"]
 * Menyimpan UniversalStyleBlueprint / UniversalParametricBlueprint aktif secara permanen ke daftar Preset.
 */
const handleSaveFromBlueprint = async (req: Request, res: Response) => {
  try {
    const { blueprint, presetName, name } = req.body ?? {};
    const finalName = presetName || name || "Universal Cloned Style";
    const activeBp = blueprint || getActiveTempCloneBlueprint();
    if (!activeBp) {
      res.status(400).json({
        success: false,
        error: "NO_ACTIVE_BLUEPRINT",
        message: "Tidak ada blueprint clone aktif untuk disimpan ke Preset.",
      });
      return;
    }

    const saved = await saveBlueprintAsPreset(activeBp, finalName);
    const allPresets = await listAllPresets();
    res.status(200).json({
      success: true,
      message: `Gaya kloning berhasil disimpan permanen sebagai Preset "${saved.name}"!`,
      data: saved,
      allPresets,
    });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 500;
    res.status(status).json({
      success: false,
      error: err?.code || "SAVE_BLUEPRINT_FAILED",
      message: err?.message || "Gagal menyimpan preset dari blueprint clone.",
    });
  }
};

presetsRouter.post("/save-from-blueprint", handleSaveFromBlueprint);
presetsRouter.post("/save-from-clone", handleSaveFromBlueprint);

/**
 * DELETE /api/presets/:id
 * Physically removes a preset JSON from server.
 * Protects system default presets (netflix-cinematic and viral-motion).
 */
presetsRouter.delete("/:id", async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const presetId = (Array.isArray(rawId) ? rawId[0] : rawId) || "";

  try {
    const result = await deletePreset(presetId);
    const allPresets = await listAllPresets();
    res.status(200).json({
      success: true,
      message: "Preset berhasil dihapus dari server.",
      id: result.id,
      allPresets,
    });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 400;
    res.status(status).json({
      success: false,
      error: err?.code || "DELETE_PRESET_FAILED",
      message: err?.message || "Gagal menghapus preset.",
    });
  }
});
