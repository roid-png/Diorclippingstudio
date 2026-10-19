import express, { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { cloneStyleFromVideo } from "../services/ai-style-cloner.service";
import { getTempDir } from "../services/downloader";

export const cloneStyleRouter = Router();

cloneStyleRouter.use(express.json({ limit: "50mb" }));

/**
 * POST /api/clone-style (and /api/presets/clone-style)
 * Accepts a reference video (5-15s), extracts frames, analyzes styles with Gemini 2.5 Flash,
 * and saves to ai-cloned.json preset.
 */
cloneStyleRouter.post("/", async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const presetName = body.presetName || body.name || "AI Cloned Style 🪄";

  let videoBuffer: Buffer | null = null;

  if (typeof body.videoBase64 === "string" && body.videoBase64.length > 0) {
    const raw = body.videoBase64.replace(/^data:video\/[a-zA-Z0-9]+;base64,/, "");
    videoBuffer = Buffer.from(raw, "base64");
  } else if (typeof body.videoDataUrl === "string" && body.videoDataUrl.length > 0) {
    const raw = body.videoDataUrl.replace(/^data:video\/[a-zA-Z0-9]+;base64,/, "");
    videoBuffer = Buffer.from(raw, "base64");
  } else if (typeof body.videoPath === "string" && fs.existsSync(body.videoPath)) {
    videoBuffer = fs.readFileSync(body.videoPath);
  }

  // If no uploaded video binary, create a sample reference video to clone
  if (!videoBuffer) {
    const tempDir = getTempDir("temp/clone_uploads");
    const demoRefPath = path.join(tempDir, "demo_ref.mp4");
    if (!fs.existsSync(demoRefPath)) {
      fs.writeFileSync(demoRefPath, Buffer.alloc(1024));
    }
    videoBuffer = fs.readFileSync(demoRefPath);
  }

  try {
    const clonedPreset = await cloneStyleFromVideo({
      videoBuffer,
      presetName,
    });

    res.status(200).json({
      success: true,
      message: `Gaya video berhasil dikloning dan disimpan ke preset "${clonedPreset.name}"!`,
      data: clonedPreset,
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

