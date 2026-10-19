import type { RenderClipItem } from "../types";

export type NamingConventionPattern =
  | "dior-viral-rank"
  | "tiktok-reels-seo"
  | "studio-timestamp";

export interface DownloadHistoryEntry {
  id: string;
  clipId: string;
  clipTitle: string;
  fileName: string;
  fileSizeMb: number;
  resolution: string;
  fps: number;
  viralScore: number;
  downloadedAt: string;
}

function slugifyTitle(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join("_");
}

function slugifyPresetId(presetId: string): string {
  return presetId.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
}

export function buildClipDownloadFileName(
  clip: RenderClipItem,
  pattern: NamingConventionPattern = "dior-viral-rank"
): string {
  const rankPadded = String(clip.rank).padStart(2, "0");
  const titleSlug = slugifyTitle(clip.title) || `Klip_${rankPadded}`;
  const resTag = clip.resolution === "1080x1920" ? "1080p" : "720p";
  const fpsTag = `${clip.fps}fps`;
  const styleTag = slugifyPresetId(clip.pillarConfig.editingStyleId);
  const scoreInt = Math.round(clip.viralScore);

  if (pattern === "tiktok-reels-seo") {
    return `TikTok_Reels_#${rankPadded}_${titleSlug}_Viral${scoreInt}_${resTag}.mp4`;
  }

  if (pattern === "studio-timestamp") {
    const startClean = clip.startTimeFormatted.replace(":", "m") + "s";
    const endClean = clip.endTimeFormatted.replace(":", "m") + "s";
    return `DIOR_CLIP_${rankPadded}_${startClean}-${endClean}_${styleTag}_${resTag}${fpsTag}.mp4`;
  }

  // Default: "dior-viral-rank"
  return `DIOR_CLIP_${rankPadded}_Viral${scoreInt}%_${styleTag}_${titleSlug}_${resTag}${fpsTag}.mp4`;
}
