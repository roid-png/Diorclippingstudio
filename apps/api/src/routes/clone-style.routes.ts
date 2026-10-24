import express, { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { getTempDir } from "../services/downloader";
import {
  analyzeReferenceVideoToBlueprint,
  getActiveTempCloneBlueprint,
  clearActiveTempCloneBlueprint,
} from "../services/clone_engine/universal_style_analyzer";

export const cloneStyleRouter = Router();

cloneStyleRouter.use(express.json({ limit: "50mb" }));

/**
 * GET /api/clone-style/active
 * Mengecek apakah terdapat sesi temporary clone blueprint yang aktif.
 */
cloneStyleRouter.get("/active", (_req: Request, res: Response) => {
  const activeBp = getActiveTempCloneBlueprint();
  res.status(200).json({
    success: true,
    hasActiveClone: Boolean(activeBp),
    data: activeBp,
  });
});

/**
 * DELETE /api/clone-style/active
 * Membatalkan sesi temporary clone blueprint (tombol [X Batal Clone]).
 */
cloneStyleRouter.delete("/active", (_req: Request, res: Response) => {
  clearActiveTempCloneBlueprint();
  res.status(200).json({
    success: true,
    message: "Sesi temporary clone berhasil dibatalkan.",
  });
});

/**
 * POST /api/clone-style
 * [FASE 4: SISTEM TEMP CLONE SESSION - NO AUTO-SAVE TO PRESETS]
 * Menerima video referensi, mengekstrak UniversalParametricBlueprint,
 * dan HANYA menyimpannya di sesi sementara (temp/active_temp_clone.json).
 * DILARANG langsung menyimpan ke daftar Preset permanen!
 */
cloneStyleRouter.post("/", async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const presetName = body.presetName || body.name || "Universal Cloned Style 🪄";

  let videoBuffer: Buffer | null = null;

  if (typeof body.videoBase64 === "string" && body.videoBase64.length > 0) {
    const raw = body.videoBase64.replace(/^data:[^;]+;base64,/, "");
    videoBuffer = Buffer.from(raw, "base64");
  } else if (typeof body.videoDataUrl === "string" && body.videoDataUrl.length > 0) {
    const raw = body.videoDataUrl.replace(/^data:[^;]+;base64,/, "");
    videoBuffer = Buffer.from(raw, "base64");
  } else if (typeof body.videoPath === "string" && fs.existsSync(body.videoPath)) {
    videoBuffer = fs.readFileSync(body.videoPath);
  }

  // Jika tidak ada video yang dikirim, gunakan placeholder sample
  if (!videoBuffer) {
    const tempDir = getTempDir("temp/clone_uploads");
    const demoRefPath = path.join(tempDir, "demo_ref.mp4");
    if (!fs.existsSync(demoRefPath)) {
      fs.writeFileSync(demoRefPath, Buffer.alloc(1024));
    }
    videoBuffer = fs.readFileSync(demoRefPath);
  }

  try {
    const blueprint = await analyzeReferenceVideoToBlueprint({
      videoBuffer,
      presetName,
    });

    res.status(200).json({
      success: true,
      message: `Gaya video berhasil dianalisis ke Universal Blueprint (${blueprint.detected_style_summary})! Sesi clone aktif siap diaplikasikan ke video utama.`,
      data: blueprint,
    });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 500;
    res.status(status).json({
      success: false,
      error: err?.code || "CLONE_STYLE_FAILED",
      message: err?.message || "Gagal mengkloning gaya video referensi.",
    });
  }
});
