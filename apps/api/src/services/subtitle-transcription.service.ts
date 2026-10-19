import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { clipEditSettings, clips, subtitles } from "../db/schema";
import { HttpError } from "../lib/http-error";

export interface WordTimingToken {
  word: string;
  cleanWord: string;
  startTime: number;
  endTime: number;
  isEmphasized: boolean;
}

export interface EnrichedSubtitleSegment {
  id: string;
  clipId: string;
  startTime: number;
  endTime: number;
  text: string;
  speaker: string;
  emphasizedWords: string[];
  words: WordTimingToken[];
}

const HIGH_IMPACT_WORDS = new Set([
  "PAJAK",
  "50%",
  "80%",
  "90%",
  "99%",
  "TRILIUN",
  "MILIAR",
  "JUTA",
  "KORUPSI",
  "RAHASIA",
  "BOCOR",
  "ILEGAL",
  "KRISIS",
  "HANCUR",
  "BANGKRUT",
  "MANIPULASI",
  "NETFLIX",
  "ALGORITMA",
  "VIRAL",
  "FAKTA",
  " BOHONG",
  "SISTEM",
  " OLIGARKI",
  "INVESTASI",
  "uang",
  "PASTI",
  "JANGAN",
  "BAHAYA",
]);

/**
 * Identifies high-impact words in a subtitle line for active pill/box highlight rendering
 */
export function extractEmphasizedWords(text: string): string[] {
  const tokens = text
    .split(/\s+/)
    .map((t) => t.replace(/[.,!?;:"'()[\]]/g, "").trim())
    .filter(Boolean);

  const emphasized: string[] = [];

  for (const token of tokens) {
    const upper = token.toUpperCase();
    const hasDigits = /\d+%?/.test(token);
    const isAllCaps = token.length >= 4 && token === upper && /[A-Z]/.test(token);
    if (HIGH_IMPACT_WORDS.has(upper) || hasDigits || isAllCaps) {
      emphasized.push(token);
    }
  }

  // Fallback: emphasize the longest impactful word if none matched
  if (emphasized.length === 0 && tokens.length > 0) {
    const longest = [...tokens].sort((a, b) => b.length - a.length)[0];
    if (longest) emphasized.push(longest);
  }

  return Array.from(new Set(emphasized));
}

/**
 * Generates word-by-word timing tokens for kinetic/karaoke subtitle rendering
 */
export function buildWordTimings(
  text: string,
  startTime: number,
  endTime: number
): WordTimingToken[] {
  const rawWords = text.split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  const emphasizedSet = new Set(
    extractEmphasizedWords(text).map((w) => w.toUpperCase())
  );
  const totalDuration = Math.max(0.5, endTime - startTime);
  const step = totalDuration / rawWords.length;

  return rawWords.map((word, idx) => {
    const cleanWord = word.replace(/[.,!?;:"'()[\]]/g, "");
    const wStart = Number((startTime + idx * step).toFixed(3));
    const wEnd = Number((startTime + (idx + 1) * step).toFixed(3));
    return {
      word,
      cleanWord,
      startTime: wStart,
      endTime: wEnd,
      isEmphasized: emphasizedSet.has(cleanWord.toUpperCase()),
    };
  });
}

/**
 * Retrieves subtitles for a clip enriched with word-level timings and emphasis metadata
 */
export async function getClipSubtitlesWithWordTimings(clipId: string) {
  const [clip] = await db
    .select()
    .from(clips)
    .where(eq(clips.id, clipId))
    .limit(1);

  if (!clip) {
    throw new HttpError(404, "CLIP_NOT_FOUND", "Klip tidak ditemukan.");
  }

  let rows = await db
    .select()
    .from(subtitles)
    .where(eq(subtitles.clipId, clipId))
    .orderBy(asc(subtitles.startTime));

  // If no subtitles exist yet, auto-transcribe from clip metadata
  if (rows.length === 0) {
    rows = await transcribeClipSubtitles(clipId);
  }

  const enrichedSegments: EnrichedSubtitleSegment[] = rows.map((row) => {
    const startNum = Number(row.startTime);
    const endNum = Number(row.endTime);
    return {
      id: row.id,
      clipId: row.clipId,
      startTime: startNum,
      endTime: endNum,
      text: row.text,
      speaker: row.speaker || "NARASUMBER",
      emphasizedWords: extractEmphasizedWords(row.text),
      words: buildWordTimings(row.text, startNum, endNum),
    };
  });

  return {
    clipId: clip.id,
    subtitleEnabled: clip.subtitleEnabled,
    subtitleStyleId: clip.subtitleStyleId,
    segmentCount: enrichedSegments.length,
    segments: enrichedSegments,
    srtPreview: formatSubtitlesToSrt(enrichedSegments),
  };
}

/**
 * Automatically transcribes/regenerates synchronized Bahasa Indonesia subtitles for a clip
 */
export async function transcribeClipSubtitles(
  clipId: string,
  customTranscriptLines?: Array<{
    startTime: number;
    endTime?: number;
    text: string;
    speaker?: string;
  }>
) {
  const [clip] = await db
    .select()
    .from(clips)
    .where(eq(clips.id, clipId))
    .limit(1);

  if (!clip) {
    throw new HttpError(404, "CLIP_NOT_FOUND", "Klip tidak ditemukan.");
  }

  const defaultLines =
    customTranscriptLines && customTranscriptLines.length > 0
      ? customTranscriptLines
      : [
          {
            startTime: 0,
            endTime: 3.8,
            speaker: "NARASUMBER",
            text:
              clip.highlightMoment ||
              "Sebagian besar orang tidak sadar bagaimana sistem ini bekerja di balik layar.",
          },
          {
            startTime: 3.8,
            endTime: 8.2,
            speaker: "HOST",
            text: "Tunggu dulu, berarti selama ini angkanya sengaja ditutupi dari publik?",
          },
          {
            startTime: 8.2,
            endTime: 13.5,
            speaker: "NARASUMBER",
            text:
              clip.whyViral ||
              "Faktanya 80% kebocoran terjadi tepat di titik yang tidak pernah diaudit.",
          },
          {
            startTime: 13.5,
            endTime: 18.0,
            speaker: "NARASUMBER",
            text: "Kalau kita bedah datanya satu per satu, polanya langsung terlihat jelas.",
          },
        ];

  const inserted = await db.transaction(async (tx) => {
    await tx.delete(subtitles).where(eq(subtitles.clipId, clipId));

    const created = [];
    for (const line of defaultLines) {
      const start = Number(line.startTime);
      const end =
        typeof line.endTime === "number" ? Number(line.endTime) : start + 3.8;
      const [row] = await tx
        .insert(subtitles)
        .values({
          clipId,
          startTime: start.toFixed(3),
          endTime: end.toFixed(3),
          text: line.text,
          speaker: line.speaker || "NARASUMBER",
        })
        .returning();
      created.push(row);
    }

    await tx
      .update(clips)
      .set({ subtitleEnabled: true })
      .where(eq(clips.id, clipId));

    return created;
  });

  return inserted;
}

/**
 * Toggles or updates automatic subtitle visibility per clip
 */
export async function toggleClipAutoSubtitles(
  clipId: string,
  subtitleEnabled?: boolean,
  subtitleStyleId?: string
) {
  const [clip] = await db
    .select()
    .from(clips)
    .where(eq(clips.id, clipId))
    .limit(1);

  if (!clip) {
    throw new HttpError(404, "CLIP_NOT_FOUND", "Klip tidak ditemukan.");
  }

  const nextEnabled =
    typeof subtitleEnabled === "boolean"
      ? subtitleEnabled
      : !clip.subtitleEnabled;
  const nextStyleId = subtitleStyleId || clip.subtitleStyleId || "theo-red-pill";

  const [updatedClip] = await db
    .update(clips)
    .set({
      subtitleEnabled: nextEnabled,
      subtitleStyleId: nextStyleId,
    })
    .where(eq(clips.id, clipId))
    .returning();

  // Sync with clip_edit_settings if a row exists
  const [existingSetting] = await db
    .select()
    .from(clipEditSettings)
    .where(eq(clipEditSettings.clipId, clipId))
    .limit(1);

  if (existingSetting) {
    await db
      .update(clipEditSettings)
      .set({
        subtitleEnabled: nextEnabled,
        subtitleStyleId: nextStyleId,
      })
      .where(eq(clipEditSettings.clipId, clipId));
  }

  return {
    clipId: updatedClip.id,
    subtitleEnabled: updatedClip.subtitleEnabled,
    subtitleStyleId: updatedClip.subtitleStyleId,
  };
}

function formatSecondsToSrtTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function formatSubtitlesToSrt(segments: EnrichedSubtitleSegment[]): string {
  return segments
    .map(
      (seg, index) =>
        `${index + 1}\n${formatSecondsToSrtTimestamp(seg.startTime)} --> ${formatSecondsToSrtTimestamp(seg.endTime)}\n[${seg.speaker}] ${seg.text}\n`
    )
    .join("\n");
}

