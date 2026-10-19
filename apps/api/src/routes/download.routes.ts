import { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { getOutputsDir } from "../services/downloader";

export const downloadRouter = Router();

/**
 * GET /api/download/:filename
 * Streams or downloads rendered MP4 video clips with range support for instant browser playback.
 */
downloadRouter.get("/:filename", (req: Request, res: Response) => {
  const rawParam = req.params.filename;
  const rawFileName = (Array.isArray(rawParam) ? rawParam[0] : rawParam) || "video.mp4";
  const safeFileName = path.basename(rawFileName);
  const outputsDir = getOutputsDir();
  const filePath = path.join(outputsDir, safeFileName);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({
      success: false,
      error: "FILE_NOT_FOUND",
      message: `File video "${safeFileName}" tidak ditemukan atau telah kedaluwarsa.`,
    });
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const isAttachment = req.query.download === "true" || req.query.attachment === "1";
  const disposition = isAttachment ? "attachment" : "inline";

  res.setHeader("Content-Disposition", `${disposition}; filename="${safeFileName}"`);
  res.setHeader("Accept-Ranges", "bytes");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0]!, 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
    });
    fs.createReadStream(filePath).pipe(res);
  }
});
