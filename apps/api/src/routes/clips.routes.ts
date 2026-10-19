import { Router } from "express";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { clips, subtitles } from "../db/schema";
import { HttpError } from "../lib/http-error";

export const clipsRouter = Router();

// Locate available video file for streaming
function resolveVideoFilePath(clipId?: string): string | null {
  const candidatePaths = [
    // 1. Storage generated clip
    resolve(process.cwd(), `storage/clips/${clipId}.mp4`),
    // 2. Web public video asset
    resolve(process.cwd(), "apps/web/public/videos/theo_preview.mp4"),
    resolve(process.cwd(), "../web/public/videos/theo_preview.mp4"),
    // 3. User root video
    resolve(process.cwd(), "../../THEO 5-FIX.mp4"),
    resolve(process.cwd(), "../THEO 5-FIX.mp4"),
  ];

  for (const p of candidatePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

// Get clip metadata and subtitles
clipsRouter.get("/:id", async (req, res) => {
  const [clip] = await db
    .select()
    .from(clips)
    .where(eq(clips.id, req.params.id))
    .limit(1);

  if (!clip) {
    throw new HttpError(404, "NOT_FOUND", "Klip tidak ditemukan.");
  }

  const clipSubtitles = await db
    .select()
    .from(subtitles)
    .where(eq(subtitles.clipId, clip.id))
    .orderBy(subtitles.startTime);

  res.json({
    data: {
      ...clip,
      subtitles: clipSubtitles,
      streamUrl: `/api/clips/${clip.id}/stream`,
    },
  });
});

// Stream video with HTTP 206 Partial Content (Range request) support
clipsRouter.get("/:id/stream", (req, res) => {
  const clipId = req.params.id;
  const filePath = resolveVideoFilePath(clipId);

  if (!filePath) {
    throw new HttpError(404, "VIDEO_NOT_FOUND", "File video untuk pratinjau klip belum tersedia.");
  }

  const stat = statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    // Parse Range header (e.g. "bytes=0-1048575")
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
      res.end();
      return;
    }

    const chunkSize = end - start + 1;
    const fileStream = createReadStream(filePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
      "Cache-Control": "no-cache",
    });

    fileStream.pipe(res);
  } else {
    // Full content delivery
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
    });

    createReadStream(filePath).pipe(res);
  }
});

