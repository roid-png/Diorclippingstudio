import fs from "node:fs";
import path from "node:path";
import { getOutputsDir, getTempDir } from "./downloader";
import { db } from "../db";
import { projects, clips, renderJobs } from "../db/schema";

/**
 * Removes temporary files (audio streams, subtitles, frame samples) older than maxAgeMinutes.
 */
export function cleanupTempFiles(maxAgeMinutes = 10): { deletedCount: number } {
  const tempBase = getTempDir("temp");
  let deletedCount = 0;
  const now = Date.now();
  const maxAgeMs = maxAgeMinutes * 60 * 1000;

  function scanAndClean(dirPath: string) {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        scanAndClean(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            fs.unlinkSync(fullPath);
            deletedCount++;
          }
        } catch {}
      }
    }
  }

  scanAndClean(tempBase);
  return { deletedCount };
}

/**
 * Removes rendered MP4 files in outputs directory older than maxAgeHours (default: 2 hours).
 */
export function cleanupOutputsOlderThan(maxAgeHours = 2): { deletedCount: number } {
  const outputsDir = getOutputsDir();
  let deletedCount = 0;
  const now = Date.now();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  if (fs.existsSync(outputsDir)) {
    const files = fs.readdirSync(outputsDir);
    for (const file of files) {
      if (file.endsWith(".mp4") || file.endsWith(".tmp")) {
        const fullPath = path.join(outputsDir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            fs.unlinkSync(fullPath);
            deletedCount++;
          }
        } catch {}
      }
    }
  }

  return { deletedCount };
}

/**
 * Resets all active clips, temporary audio/video chunks, and clears the current queue.
 */
export async function resetAllActiveClipsAndTemp() {
  // 1. Clean temp directory immediately
  const tempBase = getTempDir("temp");
  let tempDeleted = 0;
  function removeAllInDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        removeAllInDir(fullPath);
      } else {
        try {
          fs.unlinkSync(fullPath);
          tempDeleted++;
        } catch {}
      }
    }
  }
  removeAllInDir(tempBase);

  // 2. Clear or reset processing database projects/clips
  try {
    await db.delete(renderJobs);
    await db.delete(clips);
    await db.delete(projects);
  } catch {
    // In-memory mode fallback
  }

  return {
    success: true,
    message: "Seluruh antrean klip dan file sementara berhasil dibersihkan.",
    cleanedTempFiles: tempDeleted,
    timestamp: new Date().toISOString(),
  };
}

let schedulerTimer: NodeJS.Timeout | null = null;

/**
 * Starts background scheduler running every 30 minutes to clean old temp files and 2h+ output videos.
 */
export function startAutoCleanupScheduler() {
  if (schedulerTimer) return;

  const intervalMs = 30 * 60 * 1000; // 30 mins
  schedulerTimer = setInterval(() => {
    try {
      const tempRes = cleanupTempFiles(15);
      const outRes = cleanupOutputsOlderThan(2);
      if (tempRes.deletedCount > 0 || outRes.deletedCount > 0) {
        console.log(
          `[Auto-Cleanup] Berhasil membersihkan ${tempRes.deletedCount} file temp dan ${outRes.deletedCount} file output kedaluwarsa (>2 jam).`
        );
      }
    } catch (err: any) {
      console.warn("[Auto-Cleanup] Error during scheduled cleanup:", err?.message);
    }
  }, intervalMs);

  schedulerTimer.unref();
}

