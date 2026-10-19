import { Router, type Request, type Response } from "express";
import { resetAllActiveClipsAndTemp } from "../services/cleanup.service";

export const resetRouter = Router();

/**
 * POST /api/reset (and /api/projects/reset)
 * Deletes current active clipping queue, removes temporary audio & video files,
 * and resets the state so the workspace is 100% clean.
 */
resetRouter.post("/", async (_req: Request, res: Response) => {
  try {
    const result = await resetAllActiveClipsAndTemp();
    res.status(200).json({
      success: true,
      message: "Seluruh antrean klip aktif dan file sementara berhasil dibersihkan.",
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: "RESET_FAILED",
      message: err?.message || "Gagal melakukan reset antrean klip.",
    });
  }
});

