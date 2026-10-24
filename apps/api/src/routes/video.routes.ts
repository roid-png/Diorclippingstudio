import { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { getOutputsDir } from "../services/downloader";

export const videoRouter = Router();

/**
 * [FASE 6: STREAMING ENGINE HTTP 206]
 * GET /api/video/:filename
 * Streams rendered MP4 video with full HTTP 206 Partial Content (Range Requests) support:
 * - Prevents black screen during scrubbing, seeking, and full-screen modal zoom
 * - Sets 'Accept-Ranges', 'Content-Range', 'Content-Length', and 'Content-Type: video/mp4'
 */
videoRouter.all("/:filename", (req: Request, res: Response) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).end();
    return;
  }
  const rawParam = req.params.filename;
  const rawFileName = (Array.isArray(rawParam) ? rawParam[0] : rawParam) || "video.mp4";
  const safeFileName = path.basename(rawFileName);
  const outputsDir = getOutputsDir();
  let filePath = path.join(outputsDir, safeFileName);

  if (!fs.existsSync(filePath)) {
    const candidatePaths = [
      path.resolve(process.cwd(), "outputs", safeFileName),
      path.resolve(process.cwd(), "backend/outputs", safeFileName),
      path.resolve(process.cwd(), "apps/api/outputs", safeFileName),
      path.resolve(process.cwd(), "../../backend/outputs", safeFileName),
      path.resolve(__dirname, "../../../backend/outputs", safeFileName),
      path.resolve(__dirname, "../../outputs", safeFileName),
    ];
    const foundPath = candidatePaths.find((p) => fs.existsSync(p));
    if (foundPath) {
      filePath = foundPath;
    } else {
      res.status(404).json({
        success: false,
        error: "FILE_NOT_FOUND",
        message: `File video "${safeFileName}" tidak ditemukan.`,
      });
      return;
    }
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const isAttachment = req.query.download === "true" || req.query.attachment === "1";
  const disposition = isAttachment ? "attachment" : "inline";

  res.setHeader("Content-Disposition", `${disposition}; filename="${safeFileName}"`);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "HEAD") {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Cross-Origin-Resource-Policy": "cross-origin",
    });
    res.end();
    return;
  }

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0]!, 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
      return;
    }

    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
      "Cross-Origin-Resource-Policy": "cross-origin",
    });

    stream.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Cross-Origin-Resource-Policy": "cross-origin",
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

