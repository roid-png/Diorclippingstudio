import express, { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import {
  executeRealPipeline,
  executeDirectVideoUploadPipeline,
} from "../services/full-pipeline.service";
import { getJobProgress, updateJobProgress } from "../services/job_progress_manager";
import { extractSessionToken } from "../middleware/auth";
import { verifySessionToken } from "../services/account.service";
import { HttpError } from "../lib/http-error";

export const processVideoRouter = Router();

const tempUploadsDir = path.resolve(process.cwd(), "temp_uploads");
if (!fs.existsSync(tempUploadsDir)) {
  fs.mkdirSync(tempUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempUploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
    const safeName = file.originalname
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 30);
    cb(null, `${safeName}_${Date.now()}_${randomUUID().slice(0, 6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"].includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new HttpError(
          400,
          "INVALID_FILE_TYPE",
          "Format file tidak didukung. Harap upload video MP4 atau MOV (maksimal 2GB)."
        )
      );
    }
  },
});

processVideoRouter.use(express.json({ limit: "2gb" }));
processVideoRouter.use(express.urlencoded({ extended: true, limit: "2gb" }));

const chunkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const chunkDir = path.resolve(tempUploadsDir, "chunks");
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }
    cb(null, chunkDir);
  },
  filename: (_req, file, cb) => {
    cb(null, `part_${Date.now()}_${randomUUID().slice(0, 6)}_${file.originalname}`);
  },
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per chunk limit (well within Codespaces limits)
});

/**
 * POST /api/process-video/upload-chunk
 * Menerima potongan video (chunk) untuk melewati batas payload Nginx Codespaces (Status 413).
 */
processVideoRouter.post("/upload-chunk", chunkUpload.single("chunk"), async (req: Request, res: Response) => {
  try {
    const uploadId = String(req.body.uploadId || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const chunkIndex = parseInt(req.body.chunkIndex, 10);
    const totalChunks = parseInt(req.body.totalChunks, 10);
    const originalFileName = String(req.body.originalFileName || "video.mp4");

    if (!uploadId || isNaN(chunkIndex) || isNaN(totalChunks) || !req.file) {
      return res.status(400).json({
        success: false,
        message: "Data potongan video (chunk) tidak lengkap.",
      });
    }

    const ext = path.extname(originalFileName).toLowerCase() || ".mp4";
    const mergedTargetFile = path.resolve(tempUploadsDir, `chunked_${uploadId}${ext}`);

    // Read chunk and append to merged file
    const chunkBytes = fs.readFileSync(req.file.path);
    fs.appendFileSync(mergedTargetFile, chunkBytes);

    // Delete temp chunk piece
    try {
      fs.unlinkSync(req.file.path);
    } catch {}

    const isCompleted = chunkIndex + 1 >= totalChunks;
    console.log(`[ChunkUpload] [${uploadId}] Chunk ${chunkIndex + 1}/${totalChunks} diterima (${(chunkBytes.length / 1024 / 1024).toFixed(1)}MB)${isCompleted ? " -> SELESAI DIGABUNG" : ""}`);

    return res.status(200).json({
      success: true,
      uploadId,
      chunkIndex,
      totalChunks,
      isCompleted,
    });
  } catch (err: any) {
    console.error("[ChunkUpload] Gagal memproses potongan video:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Gagal menyimpan potongan video.",
    });
  }
});

const uploadMiddleware = upload.fields([
  { name: "video", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

/**
 * GET /api/process-video/progress
 * Polling status kemajuan pemotongan & render video secara real-time berdasarkan kondisi sebenarnya.
 */
processVideoRouter.get("/progress", (req: Request, res: Response) => {
  const jobId = typeof req.query.jobId === "string" ? req.query.jobId.trim() : "";
  if (!jobId) {
    res.status(400).json({ success: false, message: "Parameter jobId wajib diisi." });
    return;
  }

  const progress = getJobProgress(jobId);
  if (!progress) {
    res.status(404).json({ success: false, message: "Job ID tidak ditemukan atau telah kedaluwarsa." });
    return;
  }

  res.status(200).json({
    success: true,
    data: progress,
  });
});

/**
 * POST /api/process-video
 * Dual Input Endpoint: Accepts either direct video upload (MP4/MOV <= 2GB) OR YouTube URL string.
 */
processVideoRouter.post("/", (req: Request, res: Response, next) => {
  if (req.is("multipart/form-data")) {
    uploadMiddleware(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            error: "FILE_TOO_LARGE",
            message: "Ukuran file video melebihi batas maksimal 2GB.",
          });
        }
        return res.status(400).json({
          success: false,
          error: "UPLOAD_ERROR",
          message: err.message,
        });
      } else if (err) {
        const status = typeof err?.status === "number" ? err.status : 400;
        return res.status(status).json({
          success: false,
          error: err?.code || "UPLOAD_ERROR",
          message: err?.message || "Gagal mengunggah file video.",
        });
      }
      next();
    });
  } else {
    next();
  }
}, async (req: Request, res: Response) => {
  let userId = "user-creator-demo";
  const token = extractSessionToken(req);
  if (token) {
    const verified = await verifySessionToken(token);
    if (verified) {
      userId = verified.user.id;
    }
  }

  // Check uploaded file or chunked uploaded file
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const directUploadedFile = files?.["video"]?.[0] || files?.["file"]?.[0];

  let localVideoPath: string | null = null;
  let originalVideoName = "Uploaded Video";
  let videoFileSize = 0;

  if (directUploadedFile) {
    localVideoPath = directUploadedFile.path;
    originalVideoName = directUploadedFile.originalname;
    videoFileSize = directUploadedFile.size;
  } else if (req.body?.uploadId) {
    const safeUploadId = String(req.body.uploadId).replace(/[^a-zA-Z0-9_-]/g, "");
    if (fs.existsSync(tempUploadsDir)) {
      const matched = fs.readdirSync(tempUploadsDir).filter((f) => f.startsWith(`chunked_${safeUploadId}`));
      if (matched.length > 0) {
        localVideoPath = path.resolve(tempUploadsDir, matched[0]);
        originalVideoName = req.body?.originalFileName || matched[0];
        videoFileSize = fs.existsSync(localVideoPath) ? fs.statSync(localVideoPath).size : 0;
      }
    }
  }

  // Check YouTube URL
  const rawYoutubeUrl = req.body?.youtube_url || req.body?.youtubeUrl;
  const youtubeUrl = typeof rawYoutubeUrl === "string" ? rawYoutubeUrl.trim() : "";

  const rawJobId = req.body?.jobId || (typeof req.query?.jobId === "string" ? req.query.jobId : undefined);
  const jobId = typeof rawJobId === "string" && rawJobId.trim().length > 0 ? rawJobId.trim() : `job_${Date.now()}_${randomUUID().slice(0, 6)}`;

  const rawClipCount = req.body?.clipCount ?? req.body?.clip_count ?? req.body?.max_clips ?? req.body?.maxClips;
  const clipCount = Math.min(Math.max(1, Number(rawClipCount) || 5), 10);

  const rawTargetDuration = req.body?.targetDuration ?? req.body?.target_duration ?? req.body?.clip_duration ?? req.body?.clipDuration;
  const targetDuration = [30, 45, 60].includes(Number(rawTargetDuration))
    ? Number(rawTargetDuration)
    : 45;

  const rawPipelineMode = req.body?.pipelineMode ?? req.body?.pipeline_mode;
  let pipelineMode: "raw_cut" | "clean_subtitle" | "netflix_editorial" | "clone_only" = "netflix_editorial";
  if (rawPipelineMode === "raw_cut" || rawPipelineMode === "clean_subtitle" || rawPipelineMode === "netflix_editorial" || rawPipelineMode === "clone_only") {
    pipelineMode = rawPipelineMode;
  } else if (req.body?.compositionMode === "POTONG_MURNI" || req.body?.composition_mode === "POTONG_MURNI") {
    pipelineMode = "raw_cut";
  }

  const presetId = req.body?.preset_id || req.body?.presetId || "viral-motion";
  const subtitleFont = req.body?.subtitleFont || req.body?.subtitle_font || req.body?.fontFamily || req.body?.font_family || "Montserrat ExtraBold";

  const enableHook =
    req.body.enableHook !== undefined
      ? (req.body.enableHook === "true" || req.body.enableHook === true)
      : req.body.enable_hook !== undefined
      ? (req.body.enable_hook === "true" || req.body.enable_hook === true)
      : req.body.enable_cinematic_hook !== undefined
      ? (req.body.enable_cinematic_hook === "true" || req.body.enable_cinematic_hook === true)
      : req.body.enableCinematicHook !== undefined
      ? (req.body.enableCinematicHook === "true" || req.body.enableCinematicHook === true)
      : true;

  const enablePolish =
    req.body.enablePolish !== undefined
      ? (req.body.enablePolish === "true" || req.body.enablePolish === true)
      : req.body.enable_polish !== undefined
      ? (req.body.enable_polish === "true" || req.body.enable_polish === true)
      : req.body.color_polish !== undefined
      ? (req.body.color_polish === "true" || req.body.color_polish === true)
      : req.body.colorPolish !== undefined
      ? (req.body.colorPolish === "true" || req.body.colorPolish === true)
      : true;

  // Print mandatory terminal log
  console.log(
    `[CONFIG RECEIVED] Clips: ${clipCount} | Duration: ${targetDuration}s | Mode: ${pipelineMode} | Preset: ${presetId} | Font: ${subtitleFont} | Hook: ${enableHook} | Polish & SFX: ${enablePolish}`
  );

  const hookFont = req.body?.hook_font || req.body?.hookFont || "Cinzel";

  const enableCloneTopMotion =
    req.body.enableCloneTopMotion !== undefined
      ? req.body.enableCloneTopMotion === "true" || req.body.enableCloneTopMotion === true
      : req.body.enable_clone_top_motion !== undefined
      ? req.body.enable_clone_top_motion === "true" || req.body.enable_clone_top_motion === true
      : undefined;

  const enableCloneBottomMotion =
    req.body.enableCloneBottomMotion !== undefined
      ? req.body.enableCloneBottomMotion === "true" || req.body.enableCloneBottomMotion === true
      : req.body.enable_clone_bottom_motion !== undefined
      ? req.body.enable_clone_bottom_motion === "true" || req.body.enable_clone_bottom_motion === true
      : undefined;

  const useTempCloneBlueprint =
    req.body.useTempCloneBlueprint !== undefined
      ? req.body.useTempCloneBlueprint === "true" || req.body.useTempCloneBlueprint === true
      : undefined;

  let tempCloneBlueprint = undefined;
  if (req.body.tempCloneBlueprint) {
    if (typeof req.body.tempCloneBlueprint === "string") {
      try {
        tempCloneBlueprint = JSON.parse(req.body.tempCloneBlueprint);
      } catch {}
    } else if (typeof req.body.tempCloneBlueprint === "object") {
      tempCloneBlueprint = req.body.tempCloneBlueprint;
    }
  }

  if (!localVideoPath && !youtubeUrl) {
    res.status(400).json({
      success: false,
      error: "INPUT_REQUIRED",
      message: "Silakan masukkan link YouTube atau upload file video (MP4/MOV).",
    });
    return;
  }

  try {
    let result;
    if (localVideoPath) {
      console.log(`[ProcessVideo] Memproses unggahan file video: ${originalVideoName} (${(videoFileSize / 1024 / 1024).toFixed(1)}MB, mode: ${pipelineMode}, font: ${subtitleFont})`);
      result = await executeDirectVideoUploadPipeline({
        videoFilePath: localVideoPath,
        originalFileName: originalVideoName,
        clipCount,
        maxClips: clipCount,
        targetDuration,
        clipDuration: targetDuration,
        pipelineMode,
        presetId,
        subtitleFont,
        fontFamily: subtitleFont,
        enableHook,
        enableCinematicHook: enableHook,
        enablePolish,
        colorPolish: enablePolish,
        hookFont,
        userId,
        tempCloneBlueprint,
        useTempCloneBlueprint,
        enableCloneTopMotion,
        enableCloneBottomMotion,
        jobId,
      });
    } else {
      console.log(`[ProcessVideo] Memproses tautan YouTube: ${youtubeUrl} (mode: ${pipelineMode}, font: ${subtitleFont})`);
      result = await executeRealPipeline({
        youtubeUrl,
        clipCount,
        maxClips: clipCount,
        targetDuration,
        clipDuration: targetDuration,
        pipelineMode,
        presetId,
        subtitleFont,
        fontFamily: subtitleFont,
        enableHook,
        enableCinematicHook: enableHook,
        enablePolish,
        colorPolish: enablePolish,
        hookFont,
        userId,
        tempCloneBlueprint,
        useTempCloneBlueprint,
        enableCloneTopMotion,
        enableCloneBottomMotion,
        jobId,
      });
    }

    res.status(200).json({
      success: true,
      message: `Berhasil memproses ${result.clips.length} klip video 9:16 siap unduh!`,
      data: result,
    });
  } catch (err: any) {
    updateJobProgress(jobId, { status: "error", error: err?.message || "Gagal memproses klip video." });
    // If an error occurred with an uploaded file, clean it up
    if (directUploadedFile && fs.existsSync(directUploadedFile.path)) {
      try {
        fs.unlinkSync(directUploadedFile.path);
      } catch {}
    }

    const status = typeof err?.status === "number" ? err.status : 500;
    const rawMsg = String(err?.message || "");
    console.error("[ProcessVideo Error Handler]:", {
      status,
      code: err?.code,
      message: rawMsg,
      stack: err?.stack,
    });

    let cleanMessage = rawMsg;
    if (
      rawMsg.includes("GoogleGenerativeAI") ||
      rawMsg.includes("fetch failed") ||
      rawMsg.includes("GoogleAIFileManager") ||
      rawMsg.includes("generativelanguage") ||
      rawMsg.includes("GOOGLE_FILE") ||
      rawMsg.includes("GEMINI_API_KEY")
    ) {
      cleanMessage = `Gagal memproses audio: ${rawMsg.replace(/\[GoogleGenerativeAI Error\]:\s*/g, "").slice(0, 150)}`;
    }

    res.status(status).json({
      success: false,
      error: err?.code || "PROCESS_FAILED",
      message: cleanMessage || "Gagal memproses klip video.",
    });
  }
});