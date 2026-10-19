import { Router } from "express";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { clips, subtitles } from "../db/schema";
import { HttpError } from "../lib/http-error";
import {
  getViralScoreCategory,
  resolveHighlightMomentWithFallback,
} from "../services/viral-scoring.service";

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

// Get sorted list of viral clips (with optional projectId, sortBy, category, and limit 1..10)
clipsRouter.get("/", async (req, res) => {
  const projectId =
    typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  const sortByRaw =
    typeof req.query.sortBy === "string" ? req.query.sortBy : "viral-desc";
  const category =
    typeof req.query.category === "string" ? req.query.category : "all";
  const rawLimit =
    typeof req.query.limit === "string" ? Number(req.query.limit) : 10;
  const limit = Number.isNaN(rawLimit)
    ? 10
    : Math.min(Math.max(1, rawLimit), 10);

  const orderByClause =
    sortByRaw === "viral-asc"
      ? [asc(clips.viralScore), asc(clips.rank)]
      : sortByRaw === "timeline-asc"
      ? [asc(clips.startTime)]
      : sortByRaw === "duration-desc"
      ? [desc(clips.duration), desc(clips.viralScore)]
      : [desc(clips.viralScore), asc(clips.rank)];

  const query = projectId
    ? db
        .select()
        .from(clips)
        .where(eq(clips.projectId, projectId))
        .orderBy(...orderByClause)
    : db
        .select()
        .from(clips)
        .orderBy(...orderByClause);

  const rows = await query;

  const enriched = rows
    .map((c, idx) => {
      const numericScore = Number(c.viralScore || 90);
      const { tier, label } = getViralScoreCategory(numericScore);
      const resolvedHighlight = resolveHighlightMomentWithFallback(
        c.highlightMoment,
        c.startTime,
        c.endTime
      );
      const effectiveRank = c.rank ?? idx + 1;
      return {
        ...c,
        rank: effectiveRank,
        viralLabel: c.viralLabel || label,
        viralCategoryTier: tier,
        isPrimaryRecommendation: c.isPrimaryRecommendation || effectiveRank <= 3,
        highlightMoment: resolvedHighlight.text,
        hasFallbackHighlight: resolvedHighlight.isFallback,
        streamUrl: `/api/clips/${c.id}/stream`,
      };
    })
    .filter((c) => {
      if (category === "all") return true;
      if (category === "top3") return c.rank <= 3;
      if (category === "mega") return Number(c.viralScore || 0) >= 95;
      if (category === "favorites") return c.isSelected;
      return c.category === category;
    })
    .slice(0, limit);

  res.json({
    data: enriched,
    meta: {
      totalReturned: enriched.length,
      limit,
      sortBy: sortByRaw,
      category,
    },
  });
});

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

