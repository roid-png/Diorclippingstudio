import express, { Router, type Request, type Response } from "express";
import { z } from "zod";
import { listAllPresets, savePreset, getPresetById } from "../services/presets.service";

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
  subtitleStyle: z
    .object({
      fontName: z.string().default("Arial"),
      fontSize: z.number().default(24),
      primaryColor: z.string().default("&H00FFFFFF"),
      highlightColor: z.string().default("&H0000FFFF"),
      outlineColor: z.string().default("&H00000000"),
      outlineWidth: z.number().default(2),
      alignment: z.number().default(2),
      marginV: z.number().default(80),
      bold: z.boolean().default(true),
      animation: z.string().optional(),
      bounceScale: z.number().optional(),
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
 * Registers or updates a preset configuration JSON.
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
    res.status(201).json({
      success: true,
      message: `Preset "${saved.name}" berhasil didaftarkan.`,
      data: saved,
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
