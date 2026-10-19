import express, { Router, type Request, type Response } from "express";
import { z } from "zod";
import { executeRealPipeline } from "../services/full-pipeline.service";
import { extractSessionToken } from "../middleware/auth";
import { verifySessionToken } from "../services/account.service";

export const pipelineRouter = Router();

pipelineRouter.use(express.json({ limit: "10mb" }));

const generateSchema = z.object({
  youtubeUrl: z.string().trim().min(5, "URL YouTube wajib diisi."),
  maxClips: z.coerce.number().int().min(1).max(10).default(5),
  clipDuration: z.coerce.number().int().refine((v) => [30, 45, 60].includes(v)).default(45),
  presetId: z.string().optional().default("viral-motion"),
  enableMotionGraphic: z.boolean().optional().default(true),
});

/**
 * POST /api/pipeline/generate
 * One-click full real processing pipeline from YouTube link to finished vertical 9:16 clips.
 */
pipelineRouter.post("/generate", async (req: Request, res: Response) => {
  const parsed = generateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: firstIssue?.message || "Parameter pembuatan klip tidak valid.",
    });
    return;
  }

  let userId = "user-creator-demo";
  const token = extractSessionToken(req);
  if (token) {
    const verified = await verifySessionToken(token);
    if (verified) {
      userId = verified.user.id;
    }
  }

  try {
    const result = await executeRealPipeline({
      ...parsed.data,
      userId,
    });

    res.status(200).json({
      success: true,
      message: `Berhasil memproses ${result.clips.length} klip video vertikal 9:16 siap unduh!`,
      data: result,
    });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 500;
    res.status(status).json({
      success: false,
      error: err?.code || "PIPELINE_FAILED",
      message: err?.message || "Gagal memproses klip video dari YouTube.",
    });
  }
});

