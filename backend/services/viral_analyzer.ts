import { GoogleGenerativeAI } from "@google/generative-ai";
import { FileState } from "@google/generative-ai/server";
import { jsonrepair } from "jsonrepair";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pLimit from "p-limit";
import { HttpError } from "../lib/http-error";
import {
  type WordLevelTranscription,
  type WordTimestamp,
  type TranscriptionSegment,
} from "./transcriber";
import {
  getCuratorKeys,
  getGeminiClient,
  getGeminiFileManager,
  isQuotaOrRateLimitError,
  executeGeminiWithFailover,
} from "./api_key_manager";
import { getFfmpegPath } from "../utils/ffmpeg-path";
import { getTempDir } from "./downloader";
import { transcribeWithGroqFailover } from "./groq_transcriber";

const execFileAsync = promisify(execFile);

export type { WordTimestamp };

export interface CuratedViralClip {
  rank: number;
  title: string;
  start_time: number;
  end_time: number;
  duration: number;
  viral_score: number;
  viral_reason: string;
  hook_description: string;
  speaker_name?: string;
  top_banner_tag?: string;
  top_banner_title?: string;
  top_banner_steps?: string;
  teaser_start?: number;
  teaser_end?: number;
  teaser_duration?: number;
  hook_category?: string;
  hook_headline?: string;
  hook_subtext?: string;
  words: WordTimestamp[];
}

/**
 * [FASE 1 & 2: BULLETPROOF CLIMAX COLD-OPEN TEASER TIMESTAMP NORMALIZER]
 * Validates and locks teaser slice to exactly 3.5s - 4.5s strictly from the CLIMAX
 * (middle or end of the clip: clip_start + 10s to clip_end - 4s).
 * STRICTLY FORBIDS 0-5s opening segment to prevent repetitive loops!
 */
export function normalizeSafeTeaserTimestamps(
  rawTeaserStart: any,
  rawTeaserEnd: any,
  clipStart: number,
  clipEnd: number
): { teaserStart: number; teaserEnd: number; teaserDuration: number } {
  const clipDur = Math.max(5, clipEnd - clipStart);
  let tStart = typeof rawTeaserStart === "number" && !isNaN(rawTeaserStart) ? rawTeaserStart : -1;
  let tEnd = typeof rawTeaserEnd === "number" && !isNaN(rawTeaserEnd) ? rawTeaserEnd : -1;

  // If AI gave relative timestamps inside clip (e.g. 15.0 when clip is 100-145), convert to absolute
  if (tStart > 0 && tStart < clipStart && tStart < clipDur) {
    tStart = clipStart + tStart;
    if (tEnd > 0 && tEnd < clipStart) {
      tEnd = clipStart + tEnd;
    }
  }

  // ANTI-REPETITION CLIMAX RULE:
  // If teaser start is within the first 5 seconds of the clip, or out of bounds,
  // force it to the climax section (between 35% and 65% of the clip)
  const minClimaxOffset = Math.min(10.0, Math.max(5.0, clipDur * 0.3));
  if (tStart < clipStart + 5.0 || tStart >= clipEnd - 3.5) {
    const climaxOffset = Math.min(
      Math.max(minClimaxOffset, clipDur * 0.45),
      Math.max(minClimaxOffset, clipDur - 4.5)
    );
    tStart = clipStart + climaxOffset;
  }

  if (tEnd <= tStart || tEnd - tStart < 3.0 || tEnd > clipEnd + 0.5) {
    tEnd = Math.min(clipEnd, tStart + 4.2);
  }

  let duration = Math.min(4.5, Math.max(3.5, parseFloat((tEnd - tStart).toFixed(2))));
  if (duration > clipDur) duration = clipDur;
  tStart = parseFloat(tStart.toFixed(2));
  tEnd = parseFloat((tStart + duration).toFixed(2));

  return {
    teaserStart: tStart,
    teaserEnd: tEnd,
    teaserDuration: duration,
  };
}

/**
 * Curates top viral moments using Gemini AI powered by Account 2 (GEMINI_API_KEY_CURATION).
 * Normalizes all word timestamps so that each clip begins at relative 0.00s with latency compensation.
 * Also extracts podcast infographic banner metadata: speaker name, tag, headline, and 3-step arc.
 */
export async function curateViralMomentsWithGemini(input: {
  transcription: WordLevelTranscription;
  targetDurationSec: number; // 30, 45, or 60
  maxClips: number; // 1 to 10
  videoTitle?: string;
}): Promise<CuratedViralClip[]> {
  const targetDuration = [30, 45, 60].includes(input.targetDurationSec)
    ? input.targetDurationSec
    : 45;
  const clipLimit = Math.min(Math.max(1, input.maxClips || 5), 10);
  const totalVideoDur = Math.round(input.transcription.duration) || 60;

  console.log(
    `[ViralAnalyzer] Mengkurasi hingga ${clipLimit} klip (${targetDuration}s) dari audio ${totalVideoDur}s menggunakan Akun 2...`
  );

  const promptText = `
You are an expert short-form video editor and viral curator for TikTok, Reels, and YouTube Shorts specializing in high-impact podcast clips (The Precision style).
Analyze this video transcription and identify the TOP ${clipLimit} most engaging, high-retention viral moments.

Video Title: "${input.videoTitle || "Video Kreator"}"
Target Duration per Clip: ~${targetDuration} seconds (acceptable range: ${Math.max(15, targetDuration - 10)}s to ${targetDuration + 10}s).
Max Clips requested: ${clipLimit}.
Total video duration: ${totalVideoDur}s.

CRITICAL QUANTITY REQUIREMENT:
- You MUST identify and return EXACTLY ${clipLimit} viral clips in the JSON array.
- DO NOT return fewer than ${clipLimit} clips under any circumstances.
- Distribute clips across different parts of the entire transcription.
- The returned JSON array MUST contain EXACTLY ${clipLimit} objects (ranked 1 to ${clipLimit}).

Transcription text:
"${input.transcription.text.slice(0, 15000)}"

Segments overview:
${JSON.stringify(input.transcription.segments.slice(0, 120), null, 2)}

Instructions:
1. Find high-energy hooks in the first 3 seconds of each clip that stop users from scrolling.
2. Choose exact start_time and end_time (in seconds as floats/numbers) strictly within 0 to ${totalVideoDur}.
3. Rate viral_score from 75 to 99 based on hook strength, emotional peak, revelation, or curiosity gap.
4. Extract Podcast Infographic Elements for each clip:
   - speaker_name: Name of the prominent speaker in UPPERCASE (e.g. from the video context, or "NARASUMBER" if unknown).
   - top_banner_tag: Short badge in UPPERCASE with brackets (e.g. "[ THE PRECISION ]", "[ PODCAST BLUEPRINT ]", "[ AI STRATEGY ]", max 3 words).
   - top_banner_title: Punchy main infographic headline/title in UPPERCASE summarizing the core topic of this clip (e.g. "END-TO-END SYSTEM BLUEPRINT", "AI MENGGANTIKAN WHITE COLLAR", max 6 words).
   - top_banner_steps: 3-step sequence or framework flow in UPPERCASE summarizing the lesson or narrative arc (e.g. "01 CONTEXT ➔ 02 ARCHITECTURE ➔ 03 EXECUTION" or "01 MASALAH ➔ 02 STRATEGI ➔ 03 EKSEKUSI").
5. [COLD-OPEN TEASER HOOK (ANTI-REPETITION & INFORMATION GAP)]:
   - DILARANG KERAS mengambil teaser_start dari 0-5 detik pertama klip! Mengambil awal klip akan menyebabkan video mengulang kalimat yang sama persis setelah transisi!
   - WAJIB ambil 1 kalimat paling meledak / kontroversial / klimaks emosi di bagian TENGAH atau AKHIR klip (minimal clip_start + 10s s/d clip_end - 4s).
   - teaser_start & teaser_end: Rentang 3.5s - 4.5s dari kalimat klimaks tersebut di dalam klip.
   - hook_category: Kategori provokatif Information Gap dalam HURUF BESAR (e.g. "FAKTA LAPANGAN // KLIMAKS", "BOCORAN DATA // REVELASI", "KONTRADIKSI NYATA", max 4 kata).
   - hook_headline: Judul besar provokatif dalam HURUF BESAR untuk TOP HOOK BANNER (max 5-6 kata, e.g. "LAPORAN 639 HEKTAR ITU MUSTAHIL!").
   - hook_subtext: 1 baris konteks penguat tensi dalam HURUF BESAR (max 5 kata, e.g. "TEMUAN MISTERI DI KEDALAMAN").
6. Provide Indonesian 'title' (max 8 words), 'viral_reason' (in Indonesian), and 'hook_description' (in Indonesian).
7. Output ONLY a pure JSON array matching the schema below, without markdown backticks or commentary.

Schema:
[
  {
    "rank": 1,
    "title": "Judul Menarik Singkat (maks 8 kata)",
    "speaker_name": "NARASUMBER",
    "top_banner_tag": "[ THE PRECISION ]",
    "top_banner_title": "END-TO-END SYSTEM BLUEPRINT",
    "top_banner_steps": "01 CONTEXT ➔ 02 ARCHITECTURE ➔ 03 EXECUTION",
    "teaser_start": 25.0,
    "teaser_end": 29.0,
    "hook_category": "FAKTA LAPANGAN // KLIMAKS",
    "hook_headline": "LAPORAN 639 HEKTAR ITU MUSTAHIL!",
    "hook_subtext": "TEMUAN MISTERI DI KEDALAMAN",
    "start_time": 10.0,
    "end_time": ${Math.min(totalVideoDur, 10 + targetDuration)},
    "duration": ${targetDuration},
    "viral_score": 96,
    "viral_reason": "Alasan spesifik potensi viral dalam bahasa Indonesia",
    "hook_description": "Kalimat pembuka hook 3 detik yang mengikat perhatian"
  }
]
`;

  const candidateModels = [
    "gemini-3.8-flash",      // Rekomendasi Resmi Google Gemini API
    "gemini-3.5-flash",      // Model Analisis Teks Sangat Cepat & Akurat
    "gemini-3.6-flash",      // Alternatif Flash
    "gemini-3.5-flash-lite", // Ringan & Cepat
    "gemini-flash-latest",   // Dynamic Latest Pointer
  ];

  let candidateText = "";
  try {
    candidateText = await executeGeminiWithFailover({
      service: "CURATOR",
      candidateModels,
      timeoutMs: 60000,
      action: async (ai, modelName) => {
        const model = ai.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        });
        const res = await model.generateContent(promptText);
        return res.response.text();
      },
    });
  } catch (err: any) {
    throw new HttpError(
      502,
      "VIRAL_CURATION_FAILED",
      `Gagal mengkurasi momen viral: ${err?.message || "Semua model AI sedang sibuk."}`
    );
  }

  let cleanJson = candidateText.trim();
  if (cleanJson.startsWith("```json")) {
    cleanJson = cleanJson.replace(/^```json/, "").replace(/```$/, "").trim();
  } else if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.replace(/^```/, "").replace(/```$/, "").trim();
  }

  let parsed: any[];
  try {
    parsed = JSON.parse(cleanJson);
  } catch (parseErr) {
    try {
      const repaired = jsonrepair(cleanJson);
      parsed = JSON.parse(repaired);
    } catch (repairErr: any) {
      console.error("[ViralAnalyzer] Gagal membaca format JSON kurasi viral:", cleanJson);
      throw new HttpError(
        502,
        "VIRAL_CURATION_PARSE_ERROR",
        `Output kurasi dari AI tidak valid: ${repairErr?.message}`
      );
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new HttpError(
      502,
      "VIRAL_CURATION_EMPTY",
      "Model AI tidak mengembalikan rekomendasi momen viral."
    );
  }

  const allWords = input.transcription.words || [];

  // FASE 3: Normalisasi Stempel Waktu (Timestamp Offset) + Kompensasi Latensi 0.15s
  // Setiap detik kata dikurangi dengan waktu mulai klip:
  // adjusted_start = Math.max(0, word.start - clip.start_time - LATENCY_COMPENSATION)
  // adjusted_end = Math.max(0.1, word.end - clip.start_time - LATENCY_COMPENSATION)
  // Pastikan kata pertama dimulai tepat dari 0.00 detik.
  const LATENCY_COMPENSATION = 0.15;

  const curated: CuratedViralClip[] = parsed.slice(0, clipLimit).map((item, index) => {
    const { startTime: start, endTime: end, duration: actualDur } = normalizeSafeTimestamps(
      item.start_time,
      item.end_time,
      totalVideoDur,
      targetDuration
    );

    // Ambil kata-kata yang berada dalam rentang [start, end]
    let clipWords = allWords.filter((w) => w.end >= start && w.start <= end);

    // Jika filter kata kosong (misal offset jeda hening), ambil kata-kata terdekat
    if (clipWords.length === 0 && allWords.length > 0) {
      clipWords = allWords.filter(
        (w) => w.start >= Math.max(0, start - 3) && w.end <= end + 3
      );
    }

    // Normalisasi stempel waktu kata relatif ke klip
    let firstWordOffset = 0;
    if (clipWords.length > 0) {
      const rawFirstStart = clipWords[0]!.start - start;
      if (rawFirstStart > 0) {
        firstWordOffset = rawFirstStart;
      }
    }

    const normalizedWords: WordTimestamp[] = clipWords.map((w, wIdx) => {
      let adjStart = Math.max(0, w.start - start - firstWordOffset - LATENCY_COMPENSATION);
      let adjEnd = Math.max(adjStart + 0.15, w.end - start - firstWordOffset - LATENCY_COMPENSATION);

      // Kata pertama WAJIB dimulai tepat dari 0.00 detik pada klip
      if (wIdx === 0) {
        adjStart = 0.0;
      }
      if (adjEnd > actualDur) {
        adjEnd = actualDur;
      }

      return {
        word: w.word,
        start: parseFloat(adjStart.toFixed(2)),
        end: parseFloat(adjEnd.toFixed(2)),
      };
    });

    // Sanitasi metadata banner & speaker
    const speakerName = item.speaker_name
      ? String(item.speaker_name).trim().toUpperCase()
      : "NARASUMBER";
    const topBannerTag = item.top_banner_tag
      ? String(item.top_banner_tag).trim().toUpperCase()
      : "[ THE PRECISION ]";
    const topBannerTitle = item.top_banner_title
      ? String(item.top_banner_title).trim().toUpperCase()
      : (item.title ? String(item.title).trim().toUpperCase() : "END-TO-END BLUEPRINT");
    const topBannerSteps = item.top_banner_steps
      ? String(item.top_banner_steps).trim().toUpperCase()
      : "01 CONTEXT ➔ 02 ARCHITECTURE ➔ 03 EXECUTION";

    // [FASE 1: TEASER HOOK EXTRACTION & BULLETPROOF CLAMPING]
    const { teaserStart, teaserEnd, teaserDuration } = normalizeSafeTeaserTimestamps(
      item.teaser_start,
      item.teaser_end,
      start,
      end
    );
    const hookCategory = item.hook_category
      ? String(item.hook_category).trim().toUpperCase()
      : (topBannerTag.replace(/[\[\]]/g, "").trim() || "FAKTA LAPANGAN // KLIMAKS");
    const hookHeadline = item.hook_headline
      ? String(item.hook_headline).trim().toUpperCase()
      : (topBannerTitle || "REKAYASA ARSITEKTUR KLIMAKS");
    const hookSubtext = item.hook_subtext
      ? String(item.hook_subtext).trim().toUpperCase()
      : (item.hook_description ? String(item.hook_description).slice(0, 35).toUpperCase() : "DATA KUNCI TERVERIFIKASI");

    return {
      rank: index + 1,
      title: item.title ? String(item.title).trim() : `Momen Viral #${index + 1}`,
      speaker_name: speakerName,
      top_banner_tag: topBannerTag,
      top_banner_title: topBannerTitle,
      top_banner_steps: topBannerSteps,
      start_time: parseFloat(start.toFixed(2)),
      end_time: parseFloat(end.toFixed(2)),
      duration: actualDur,
      teaser_start: teaserStart,
      teaser_end: teaserEnd,
      teaser_duration: teaserDuration,
      hook_category: hookCategory,
      hook_headline: hookHeadline,
      hook_subtext: hookSubtext,
      viral_score: Math.min(99, Math.max(70, Number(item.viral_score) || 95 - index * 2)),
      viral_reason:
        item.viral_reason || "Hook kuat dengan eskalasi narasi yang mempertahankan retensi.",
      hook_description:
        item.hook_description || "Pernyataan pembuka yang mengejutkan penonton dalam 3 detik pertama.",
      words: normalizedWords,
    };
  });

  const guaranteed = ensureExactClipCount(
    curated,
    clipLimit,
    totalVideoDur,
    targetDuration,
    input.videoTitle,
    allWords
  );

  console.log(
    `[ViralAnalyzer] Selesai mengkurasi ${guaranteed.length} klip viral (100% presisi kuota terjamin).`
  );

  return guaranteed;
}

/**
 * Safely parses and clamps start_time, end_time, and duration.
 * Handles deciseconds (e.g. 4125 -> 412.5), milliseconds (1712000 -> 1712),
 * colon formats (04:12 -> 252), and prevents start_time from exceeding total duration.
 * GUARANTEES: 0 <= startTime < endTime <= totalSec, and duration >= 10.
 */
export function normalizeSafeTimestamps(
  rawStartTime: any,
  rawEndTime: any,
  totalDurationSeconds: number,
  targetDurationSeconds: number
): { startTime: number; endTime: number; duration: number } {
  const totalSec = Math.max(10, totalDurationSeconds);
  const targetDur = Math.min(60, Math.max(15, targetDurationSeconds || 45));

  const parseVal = (raw: any): number => {
    if (raw === null || raw === undefined) return 0;
    let num = 0;
    if (typeof raw === "string") {
      const clean = raw.trim();
      if (clean.includes(":")) {
        const parts = clean.split(":").map(Number);
        if (parts.length === 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
          num = parts[0]! * 60 + parts[1]!;
        } else if (parts.length === 3 && !isNaN(parts[0]!) && !isNaN(parts[1]!) && !isNaN(parts[2]!)) {
          num = parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
        }
      } else {
        num = Number(clean) || 0;
      }
    } else if (typeof raw === "number") {
      num = raw;
    }

    // Unit heuristic: if value > totalSec, check if it's deciseconds (x10) or milliseconds (x1000)
    if (num > totalSec && totalSec > 0) {
      if (num / 10 <= totalSec) {
        num = num / 10;
      } else if (num / 1000 <= totalSec) {
        num = num / 1000;
      }
    }
    return Math.max(0, num);
  };

  const parsedStart = parseVal(rawStartTime);
  const parsedEnd = parseVal(rawEndTime);

  // Maximum allowed start so that at least 15s can fit
  const maxAllowedStart = Math.max(0, totalSec - 15);
  let startTime = Math.min(maxAllowedStart, parsedStart);

  // Determine desired duration
  let desiredDur = targetDur;
  if (parsedEnd > parsedStart && parsedEnd - parsedStart >= 15) {
    desiredDur = Math.min(60, Math.max(15, Math.round(parsedEnd - parsedStart)));
  }

  // Ensure duration doesn't exceed remainder of video
  const duration = Math.min(desiredDur, Math.max(10, Math.round(totalSec - startTime)));
  const endTime = Math.min(totalSec, startTime + duration);

  return {
    startTime: parseFloat(startTime.toFixed(2)),
    endTime: parseFloat(endTime.toFixed(2)),
    duration: Math.round(endTime - startTime),
  };
}

export interface CurateAudioFileInput {
  audioFilePath: string;
  totalDurationSeconds: number;
  targetDurationSec: number; // 30, 45, or 60
  maxClips: number; // 1 to 10
  videoTitle?: string;
}

/**
 * 10 Template Sudut Pandang Infografis & Cold-Open Teaser Universal
 */
export const UNIVERSAL_VIRAL_ANGLE_TEMPLATES = [
  {
    category: "SOROTAN UTAMA // KLIMAKS",
    headline: "SOROTAN UTAMA TOPIK",
    subtext: "FAKTA KUNCI LAPANGAN",
    tag: "[ 01 // SUBSTANSI UTAMA ]",
    steps: "01 SUBSTANSI ➔ 02 ANALISIS ➔ 03 BUKTI",
    reason: "Poin krusial paling berdampak dengan data investigasi kuat.",
  },
  {
    category: "KONDISI NYATA // ANALISIS",
    headline: "REALITA YANG TERJADI",
    subtext: "FAKTA MISTERI DI LAPANGAN",
    tag: "[ 02 // ANALISIS DATA ]",
    steps: "01 REALITA ➔ 02 DAMPAK ➔ 03 AKIBAT",
    reason: "Kontras tajam yang memicu rasa ingin tahu audiens.",
  },
  {
    category: "TITIK BALIK // PENTING",
    headline: "ARGUMENTASI UTAMA TOPIK",
    subtext: "EVALUASI KRUSIAL MASA DEPAN",
    tag: "[ 01 // SUBSTANSI UTAMA ]",
    steps: "01 MASALAH ➔ 02 STRATEGI ➔ 03 RESOLUSI",
    reason: "Pandangan bernilai tinggi yang mendorong retensi hingga akhir.",
  },
  {
    category: "BOCORAN DATA // BUKTI",
    headline: "DOKUMEN KUNCI TERUNGKAP",
    subtext: "BUKTI KUAT TAK TERBANTAHKAN",
    tag: "[ 03 // BUKTI LAPANGAN ]",
    steps: "01 BUKTI ➔ 02 KONDISI ➔ 03 KESIMPULAN",
    reason: "Argumentasi mendalam bernilai edukatif dan praktis.",
  },
  {
    category: "KLIMAKS AKHIR // RESOLUSI",
    headline: "KESIMPULAN AKHIR PEMBICARA",
    subtext: "PESAN UTAMA UNTUK PUBLIK",
    tag: "[ 03 // BUKTI LAPANGAN ]",
    steps: "01 CONTEXT ➔ 02 BLUEPRINT ➔ 03 OUTCOME",
    reason: "Pesan penutup emosional yang menggerakkan diskusi di komentar.",
  },
  {
    category: "FAKTA TERSEMBUNYI // REVELASI",
    headline: "MISTERI YANG DIBONGKAR",
    subtext: "FAKTA NYATA TERUNGKAP",
    tag: "[ 02 // REVELASI DATA ]",
    steps: "01 LATAR ➔ 02 TEMUAN ➔ 03 FAKTA NYATA",
    reason: "Pengungkapan sudut pandang unik yang memicu rasa penasaran tinggi.",
  },
  {
    category: "PERDEBATAN HANGAT // KRITIS",
    headline: "SUDUT PANDANG KRITIS",
    subtext: "PERBEDAAN OPINI TAJAM",
    tag: "[ 01 // POLEMIK UTAMA ]",
    steps: "01 PREMIS ➔ 02 BENTURAN ➔ 03 SIKAP TEGAS",
    reason: "Diskusi tajam dengan dinamika argumen tinggi.",
  },
  {
    category: "PELAJARAN MAHAL // STRATEGI",
    headline: "FORMULA SOLUSI PRAKTIS",
    subtext: "METODE EFEKTIF TERUJI",
    tag: "[ 02 // STRATEGI AKSI ]",
    steps: "01 TANTANGAN ➔ 02 METODE ➔ 03 HASIL NYATA",
    reason: "Insight taktis bernilai praktis tinggi untuk audiens.",
  },
  {
    category: "PERINGATAN PENTING // URGOLOGI",
    headline: "DAMPAK BESAR KE DEPAN",
    subtext: "KONSEKUENSI TIDAK TERDUGA",
    tag: "[ 03 // PERINGATAN DINI ]",
    steps: "01 GEJALA ➔ 02 ANCAMAN ➔ 03 ANTISIPASI",
    reason: "Peringatan bernilai tinggi yang langsung menyentuh kepentingan penonton.",
  },
  {
    category: "TRANSFORMASI // VISI",
    headline: "LANGKAH MASA DEPAN",
    subtext: "ARAH BARU PERKEMBANGAN",
    tag: "[ 01 // VISI STRATEGIS ]",
    steps: "01 EVALUASI ➔ 02 TEROBOSAN ➔ 03 STRATEGI BARU",
    reason: "Visi transformatif yang inspiratif dan berwawasan luas.",
  },
];

/**
 * [FASE 2: GUARANTEED EXACT CLIP COUNT PADDER]
 * Memastikan hasil kurasi momen viral SELALU berjumlah tepat sejumlah permintaan pengguna (misal 10 dari 10).
 * Jika AI hanya mengembalikan 6-7 klip, modul ini mendeteksi slot timeline kosong dan mengisi kekurangan
 * dengan segmen berkualitas tinggi tanpa tumpang tindih.
 */
export function ensureExactClipCount(
  clips: CuratedViralClip[],
  desiredCount: number,
  totalDurationSeconds: number,
  targetDurationSeconds: number,
  videoTitle?: string,
  availableWords?: WordTimestamp[]
): CuratedViralClip[] {
  const targetCount = Math.min(10, Math.max(1, desiredCount));
  const totalSec = Math.max(10, Math.round(totalDurationSeconds));
  const targetDur = Math.min(60, Math.max(15, targetDurationSeconds || 45));

  if (clips.length >= targetCount) {
    return clips.slice(0, targetCount).map((c, idx) => ({
      ...c,
      rank: idx + 1,
    }));
  }

  const result: CuratedViralClip[] = [...clips];
  const missingCount = targetCount - result.length;
  console.log(
    `[ViralCurator] Mendeteksi kekurangan ${missingCount} klip (${result.length}/${targetCount}). Menjalankan algorithmic padding untuk menjamin 100% presisi ${targetCount} klip...`
  );

  const existingRanges = result.map((c) => ({
    start: c.start_time,
    end: c.end_time,
  }));

  const minStart = Math.min(15, Math.max(0, totalSec * 0.05));
  const maxStart = Math.max(minStart, totalSec - targetDur - 5);

  for (let m = 0; m < missingCount; m++) {
    const candidateIdx = result.length;
    const template = UNIVERSAL_VIRAL_ANGLE_TEMPLATES[candidateIdx % UNIVERSAL_VIRAL_ANGLE_TEMPLATES.length]!;

    let chosenStart = 0;
    if (totalSec <= targetDur + 10) {
      chosenStart = 0;
    } else {
      const numSlots = targetCount;
      const slotWidth = (maxStart - minStart) / Math.max(1, numSlots - 1);

      let bestStart = minStart;
      let minOverlapScore = Infinity;

      for (let s = 0; s < numSlots; s++) {
        const testStart = Math.round(minStart + s * slotWidth);
        const testEnd = Math.min(totalSec, testStart + targetDur);

        let overlap = 0;
        for (const r of existingRanges) {
          const overlapStart = Math.max(testStart, r.start);
          const overlapEnd = Math.min(testEnd, r.end);
          if (overlapEnd > overlapStart) {
            overlap += (overlapEnd - overlapStart);
          }
        }

        if (overlap < minOverlapScore) {
          minOverlapScore = overlap;
          bestStart = testStart;
        }
      }
      chosenStart = bestStart;
    }

    const chosenEnd = Math.min(totalSec, chosenStart + targetDur);
    const actualDur = Math.round(chosenEnd - chosenStart);
    existingRanges.push({ start: chosenStart, end: chosenEnd });

    const teaserStart = Math.min(
      chosenEnd - 4.2,
      chosenStart + Math.max(10, Math.round(actualDur * 0.4))
    );
    const teaserEnd = teaserStart + 4.0;
    const headline = template.headline.slice(0, 32);

    let segmentWords: WordTimestamp[] = [];
    if (availableWords && availableWords.length > 0) {
      segmentWords = availableWords
        .filter((w) => w.end >= chosenStart && w.start <= chosenEnd)
        .map((w) => ({
          word: w.word,
          start: parseFloat(Math.max(0, w.start - chosenStart).toFixed(2)),
          end: parseFloat(Math.max(0.1, w.end - chosenStart).toFixed(2)),
        }));
    }

    result.push({
      rank: candidateIdx + 1,
      title: `${headline} (Bagian ${candidateIdx + 1})`,
      speaker_name: result[0]?.speaker_name || "NARASUMBER",
      top_banner_tag: template.tag,
      top_banner_title: headline,
      top_banner_steps: template.steps,
      start_time: parseFloat(chosenStart.toFixed(2)),
      end_time: parseFloat(chosenEnd.toFixed(2)),
      duration: actualDur,
      teaser_start: parseFloat(teaserStart.toFixed(2)),
      teaser_end: parseFloat(teaserEnd.toFixed(2)),
      teaser_duration: 4.0,
      hook_category: template.category,
      hook_headline: headline,
      hook_subtext: template.subtext,
      viral_score: Math.min(99, Math.max(75, 93 - candidateIdx * 2)),
      viral_reason: template.reason,
      hook_description: `Kutipan klimaks yang menggugah emosi pada detik ke-${Math.round(teaserStart)}`,
      words: segmentWords,
    });
  }

  return result.slice(0, targetCount).map((c, idx) => ({
    ...c,
    rank: idx + 1,
  }));
}

/**
 * [TIER 3: ALGORITHMIC / INFORMATION-GAP VIRAL DISTRIBUTION]
 * 100% Deterministic & Local Fallback.
 * Generates viral segments with high-tension cold-open teasers, structured 3-step arcs,
 * and clean headline badges derived from the video title.
 * GUARANTEES zero crash / zero 502 error even if external APIs or network fail.
 */
export function curateViralMomentsAlgorithmic(
  input: CurateAudioFileInput
): CuratedViralClip[] {
  const totalSec = Math.max(10, Math.round(input.totalDurationSeconds));
  const targetDur = [30, 45, 60].includes(input.targetDurationSec)
    ? input.targetDurationSec
    : 45;
  const clipLimit = Math.min(Math.max(1, input.maxClips || 5), 10);

  const curated: CuratedViralClip[] = [];
  const minStart = Math.min(15, Math.max(0, totalSec * 0.05));
  const maxStart = Math.max(minStart, totalSec - targetDur - 5);

  for (let i = 0; i < clipLimit; i++) {
    const template = UNIVERSAL_VIRAL_ANGLE_TEMPLATES[i % UNIVERSAL_VIRAL_ANGLE_TEMPLATES.length]!;

    let rawStart = 0;
    if (totalSec <= targetDur + 10) {
      rawStart = 0;
    } else {
      const fraction = clipLimit === 1 ? 0.35 : (i + 0.5) / clipLimit;
      rawStart = Math.round(minStart + (maxStart - minStart) * fraction);
    }

    const rawEnd = Math.min(totalSec, rawStart + targetDur);
    const actualDur = rawEnd - rawStart;

    // Climax Teaser: strictly 10s into the clip or 40% into actualDur, duration 4.0s
    const teaserStart = Math.min(rawEnd - 4.2, rawStart + Math.max(10, Math.round(actualDur * 0.4)));
    const teaserEnd = teaserStart + 4.0;
    const headline = template.headline.slice(0, 32);

    curated.push({
      rank: i + 1,
      title: `${headline} (Bagian ${i + 1})`,
      speaker_name: "NARASUMBER",
      top_banner_tag: template.tag,
      top_banner_title: headline,
      top_banner_steps: template.steps,
      start_time: parseFloat(rawStart.toFixed(2)),
      end_time: parseFloat(rawEnd.toFixed(2)),
      duration: actualDur,
      teaser_start: parseFloat(teaserStart.toFixed(2)),
      teaser_end: parseFloat(teaserEnd.toFixed(2)),
      teaser_duration: 4.0,
      hook_category: template.category,
      hook_headline: headline,
      hook_subtext: template.subtext,
      viral_score: Math.min(99, 97 - i * 2),
      viral_reason: template.reason,
      hook_description: `Kutipan klimaks yang menggugah emosi pada detik ke-${Math.round(teaserStart)}`,
      words: [],
    });
  }

  console.log(
    `[ViralCurator] [Tier 3 Algorithmic Fallback] Berhasil menghasilkan ${curated.length} momen viral presisi tanpa ketergantungan jaringan.`
  );
  return curated;
}

/**
 * [TIER 2: PRECISION SPEECH SAMPLING VIA GROQ WHISPER + GEMINI TEXT CURATION]
 * Slices 4-6 small 45s audio samples across the audio timeline (< 100 KB each),
 * transcribes them in parallel via Groq Whisper (< 2s total),
 * maps timestamps back to master video time, and uses Gemini CURATOR (pure text JSON)
 * to select high-tension viral moments.
 * 100% bypasses large audio uploads to Google File API.
 */
export async function curateViralMomentsViaSampledSlices(
  input: CurateAudioFileInput,
  totalSec: number,
  targetDur: number,
  clipLimit: number
): Promise<CuratedViralClip[]> {
  console.log(
    `[ViralCurator] [Tier 2] Memulai Precision Speech Sampling (Groq Whisper + Gemini Text Curation) untuk audio ${totalSec}s...`
  );

  const ffmpegExe = getFfmpegPath();
  const sampleDir = getTempDir("temp/curation_samples");
  if (!fs.existsSync(sampleDir)) {
    fs.mkdirSync(sampleDir, { recursive: true });
  }

  const numSlices = Math.max(
    clipLimit,
    Math.min(14, Math.max(4, Math.floor(totalSec / 35)))
  );
  const minStart = Math.min(20, Math.max(5, totalSec * 0.05));
  const maxStart = Math.max(minStart, totalSec - 50);

  const sliceTasks: { index: number; start: number; file: string }[] = [];
  const tempFiles: string[] = [];

  for (let i = 0; i < numSlices; i++) {
    const fraction = numSlices === 1 ? 0.4 : (i + 0.5) / numSlices;
    const start = Math.round(minStart + (maxStart - minStart) * fraction);
    const sliceFile = path.join(
      sampleDir,
      `curate_sample_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}.mp3`
    );
    sliceTasks.push({ index: i, start, file: sliceFile });
    tempFiles.push(sliceFile);
  }

  try {
    // 1. Extract 45s audio slices concurrently (fast seek takes ~50ms per slice)
    await Promise.all(
      sliceTasks.map(async (task) => {
        try {
          await execFileAsync(
            ffmpegExe,
            [
              "-threads",
              "0",
              "-nostats",
              "-loglevel",
              "error",
              "-y",
              "-ss",
              String(task.start),
              "-t",
              "45",
              "-accurate_seek",
              "-i",
              input.audioFilePath,
              "-vn",
              "-ar",
              "16000",
              "-ac",
              "1",
              "-c:a",
              "libmp3lame",
              "-b:a",
              "32k",
              "-f",
              "mp3",
              task.file,
            ],
            { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
          );
        } catch (e: any) {
          console.warn(`[ViralCurator] Gagal potong slice sampel #${task.index}:`, e?.message);
        }
      })
    );

    // 2. Transcribe slices via Groq Whisper with concurrency limit of 3
    const limit = pLimit(3);
    const allWords: WordTimestamp[] = [];
    const allSegments: TranscriptionSegment[] = [];

    await Promise.all(
      sliceTasks.map((task) =>
        limit(async () => {
          if (!fs.existsSync(task.file)) return;
          try {
            const res = await transcribeWithGroqFailover(task.file);
            if (res.words && res.words.length > 0) {
              for (const w of res.words) {
                allWords.push({
                  word: w.word,
                  start: parseFloat((task.start + w.start).toFixed(2)),
                  end: parseFloat((task.start + w.end).toFixed(2)),
                });
              }
            }
            if (res.segments && res.segments.length > 0) {
              for (const s of res.segments) {
                allSegments.push({
                  id: allSegments.length,
                  start: parseFloat((task.start + s.start).toFixed(2)),
                  end: parseFloat((task.start + s.end).toFixed(2)),
                  text: s.text,
                });
              }
            }
          } catch (trErr: any) {
            console.warn(`[ViralCurator] Gagal transkripsi sampel #${task.index}:`, trErr?.message);
          }
        })
      )
    );

    allWords.sort((a, b) => a.start - b.start);
    allSegments.sort((a, b) => a.start - b.start);

    if (allSegments.length === 0 && allWords.length === 0) {
      throw new Error("Transkripsi mikro tidak menghasilkan kata.");
    }

    const combinedText = allSegments
      .map((s) => `[${Math.floor(s.start / 60)}:${Math.floor(s.start % 60).toString().padStart(2, "0")}] ${s.text}`)
      .join("\n");

    const sampleTranscription: WordLevelTranscription = {
      text: combinedText,
      words: allWords,
      segments: allSegments,
      duration: totalSec,
    };

    console.log(
      `[ViralCurator] [Tier 2] Berhasil mengumpulkan ${allSegments.length} segmen (${allWords.length} kata) dari ${sliceTasks.length} sampel. Menjalankan kurasi teks dengan Gemini CURATOR...`
    );

    const curated = await curateViralMomentsWithGemini({
      transcription: sampleTranscription,
      targetDurationSec: targetDur,
      maxClips: clipLimit,
      videoTitle: input.videoTitle,
    });

    if (curated && curated.length > 0) {
      console.log(
        `[ViralCurator] [Tier 2] Berhasil mengkurasi ${curated.length} klip via Groq Whisper + Gemini Text Curation!`
      );
      return curated;
    }
    throw new Error("Gemini text curation mengembalikan 0 klip.");
  } finally {
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    }
  }
}

/**
 * [FASE 3: KURASI MOMEN VIRAL MULTI-TIER RESILIENSI TINGGI]
 * Tier 1: Google File API single-call (hanya jika ukuran file <= 6 MB & upload < 25s).
 * Tier 2: Precision Speech Sampling (Groq Whisper + Gemini Text Curation).
 * Tier 3: Algorithmic Climax & Information Gap Distribution (Zero-Crash Guarantee).
 */
export async function curateViralMomentsFromFullAudioFile(
  input: CurateAudioFileInput
): Promise<CuratedViralClip[]> {
  if (!fs.existsSync(input.audioFilePath)) {
    throw new HttpError(
      404,
      "AUDIO_NOT_FOUND",
      `File audio tidak ditemukan di ${input.audioFilePath}`
    );
  }

  const curatorKeys = getCuratorKeys().filter((k) => k.key && k.key.length > 10);
  const totalSec = Math.max(10, Math.round(input.totalDurationSeconds));
  const targetDur = [30, 45, 60].includes(input.targetDurationSec)
    ? input.targetDurationSec
    : 45;
  const clipLimit = Math.min(Math.max(1, input.maxClips || 5), 10);

  const audioStat = fs.statSync(input.audioFilePath);
  const audioSizeBytes = audioStat.size;
  const isLargeAudio = audioSizeBytes > 6 * 1024 * 1024; // > 6 MB

  const promptText = `
You are an expert short-form video editor and viral curator for TikTok, Reels, and YouTube Shorts specializing in high-impact podcast clips ("The Precision" style).
Listen carefully to this entire audio track (total duration: ${totalSec} seconds) and identify the TOP ${clipLimit} most engaging, high-retention viral moments.

Video Title: "${input.videoTitle || "Video Kreator"}"
Target Duration per Clip: ~${targetDur} seconds (acceptable range: ${Math.max(15, targetDur - 10)}s to ${targetDur + 10}s).

CRITICAL QUANTITY REQUIREMENT:
- You MUST identify and return EXACTLY ${clipLimit} viral clips in the JSON array.
- DO NOT return fewer than ${clipLimit} clips under any circumstances.
- Distribute the ${clipLimit} clips across different parts of the entire audio track so each clip represents a distinct valuable topic or climax.
- The returned JSON array MUST contain EXACTLY ${clipLimit} objects (ranked 1 to ${clipLimit}).

CRITICAL SELECTION CRITERIA:
1. START TIME (start_time): MUST start at the beginning of a compelling hook, controversial statement, or surprising question.
2. END TIME (end_time): MUST end cleanly at the conclusion of a thought or punchline.
3. RETENTION HOOK: The first 3-5 seconds of each clip must grab immediate attention.
4. CONTENT QUALITY: Pick self-contained discussions, intense insights, revelations, or powerful advice.
5. SPREAD: Distribute clips across different parts of the entire audio if possible.
6. NO SPEAKER PILL/LABEL IN SUBTITLES: Keep subtitles focused purely on what is spoken.

For each viral clip, provide:
- "rank": priority from 1 to ${clipLimit}
- "title": punchy title for this clip (max 6 words)
- "speaker_name": detected speaker or "NARASUMBER"
- "top_banner_tag": short category badge in uppercase (e.g. "[ PERSPEKTIF ]", "[ INVESTASI ]", "[ REALITA ]")
- "top_banner_title": punchy headline in uppercase (max 6 words)
- "top_banner_steps": 3 steps or progression (e.g. "01 MASALAH ➔ 02 ANALISIS ➔ 03 SOLUSI")
- "teaser_start": PRECISE timestamp of the single most explosive/dramatic/climax 3.5s-4.5s statement inside this clip. CRITICAL: DILARANG KERAS MENGAMBIL DARI 0-5 DETIK PERTAMA KLIP! Wajib ambil kalimat klimaks/emosi tertinggi di TENGAH atau AKHIR klip (minimal start_time + 10s s/d end_time - 4s) agar video TIDAK mengulang kalimat yang sama setelah transisi!
- "teaser_end": precise timestamp in seconds (teaser_start + 3.5 to 4.5 seconds)
- "hook_category": short Information Gap badge in uppercase (e.g. "FAKTA LAPANGAN // KLIMAKS", "BOCORAN DATA // REVELASI", "KONTRADIKSI NYATA")
- "hook_headline": provocative headline in uppercase for TOP HOOK BANNER (max 5-6 words, high tension, e.g. "LAPORAN 639 HEKTAR ITU MUSTAHIL!")
- "hook_subtext": 1 short line of context in uppercase (max 5 words, e.g. "TEMUAN MISTERI DI KEDALAMAN")
- "start_time": precise start timestamp in seconds (float)
- "end_time": precise end timestamp in seconds (float)
- "duration": clip duration in seconds
- "viral_score": score from 80 to 99
- "viral_reason": why this moment will perform well on social media
- "hook_description": description of the opening hook

Return ONLY a valid JSON array matching this schema:
[
  {
    "rank": 1,
    "title": "Judul Klip Singkat",
    "speaker_name": "NARASUMBER",
    "top_banner_tag": "[ TOPIK KLIP ]",
    "top_banner_title": "HEADLINE UTAMA",
    "top_banner_steps": "01 TAHAP ➔ 02 TAHAP ➔ 03 TAHAP",
    "teaser_start": 135.0,
    "teaser_end": 139.0,
    "hook_category": "FAKTA LAPANGAN // KLIMAKS",
    "hook_headline": "LAPORAN 639 HEKTAR ITU MUSTAHIL!",
    "hook_subtext": "TEMUAN MISTERI DI KEDALAMAN",
    "start_time": 120.5,
    "end_time": 165.2,
    "duration": 44.7,
    "viral_score": 96,
    "viral_reason": "Alasan viral...",
    "hook_description": "Hook pembuka..."
  }
]
`;

  const candidateModels = [
    "gemini-3.8-flash",      // Rekomendasi Resmi Google Gemini API
    "gemini-3.5-flash",      // Model Analisis Teks Sangat Cepat & Akurat
    "gemini-3.6-flash",      // Alternatif Flash
    "gemini-3.5-flash-lite", // Ringan & Cepat
    "gemini-flash-latest",   // Dynamic Latest Pointer
  ];

  let candidateText = "";
  let lastErr: any = null;

  // === TIER 1: GOOGLE FILE API UPLOAD (Hanya untuk file <= 6MB) ===
  if (isLargeAudio) {
    console.log(
      `[ViralCurator] Ukuran file audio master (${(audioSizeBytes / 1024 / 1024).toFixed(
        2
      )} MB > 6 MB). Melewati Tier 1 Google File API untuk menghindari socket drop. Langsung beralih ke Tier 2...`
    );
  } else {
    for (const keyInfo of curatorKeys) {
      const curatorFileManager = getGeminiFileManager(keyInfo.key);
      const curatorAi = getGeminiClient(keyInfo.key);

      console.log(
        `[ViralCurator] [Tier 1] Mengunggah audio (${(audioSizeBytes / 1024 / 1024).toFixed(
          2
        )} MB, durasi ${totalSec}s) ke Google File API dengan kunci ${keyInfo.label}...`
      );

      let uploadedFile: any = null;
      try {
        const uploadPromise = curatorFileManager.uploadFile(input.audioFilePath, {
          mimeType: "audio/mp3",
          displayName: `master_audio_${Date.now()}`,
        });

        // Fast upload timeout guard (25 seconds)
        const uploadResult = await Promise.race([
          uploadPromise,
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error("Timeout upload Google File API (25s)")), 25000)
          ),
        ]);
        uploadedFile = uploadResult.file;

        let file = await curatorFileManager.getFile(uploadedFile.name);
        const startPoll = Date.now();
        while (file.state === FileState.PROCESSING) {
          if (Date.now() - startPoll > 45000) {
            throw new Error("Timeout pemrosesan Google File API (45s).");
          }
          await new Promise((r) => setTimeout(r, 1500));
          file = await curatorFileManager.getFile(uploadedFile.name);
        }

        if (file.state === FileState.FAILED) {
          throw new Error("Google File API gagal memproses file audio master.");
        }

        for (const modelName of candidateModels) {
          try {
            const model = curatorAi.getGenerativeModel({
              model: modelName,
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
              },
            });

            const callPromise = model.generateContent([
              {
                fileData: {
                  mimeType: uploadedFile.mimeType || "audio/mp3",
                  fileUri: uploadedFile.uri,
                },
              },
              { text: promptText },
            ]);

            const res: any = await Promise.race([
              callPromise,
              new Promise((_, rej) =>
                setTimeout(
                  () => rej(new Error(`Timeout panggilan AI model ${modelName} (45s)`)),
                  45000
                )
              ),
            ]);

            candidateText = res.response.text();
            if (candidateText) {
              console.log(
                `[ViralCurator] [Tier 1] Berhasil menerima respons kurasi dari ${modelName} (${keyInfo.label})`
              );
              break;
            }
          } catch (callErr: any) {
            lastErr = callErr;
            const isQuota = isQuotaOrRateLimitError(callErr);
            if (isQuota) {
              console.warn(`[ViralCurator] Kunci ${keyInfo.label} mencapai batas kuota.`);
              break;
            }
          }
        }

        if (candidateText) {
          break;
        }
      } catch (uploadOrKeyErr: any) {
        lastErr = uploadOrKeyErr;
        console.warn(
          `[ViralCurator] Tier 1 Google File API kendala (${keyInfo.label}): ${uploadOrKeyErr?.message?.slice(
            0,
            100
          )}.`
        );
      } finally {
        if (uploadedFile?.name) {
          try {
            await curatorFileManager.deleteFile(uploadedFile.name);
          } catch {}
        }
      }
    }
  }

  // === TIER 2 & TIER 3 MULTI-LEVEL FALLBACK ===
  if (!candidateText) {
    console.log(
      `[ViralCurator] Mengaktifkan Tier 2: Precision Speech Sampling (Groq Whisper + Gemini Text Curation)...`
    );
    try {
      return await curateViralMomentsViaSampledSlices(
        input,
        totalSec,
        targetDur,
        clipLimit
      );
    } catch (tier2Err: any) {
      console.warn(
        `[ViralCurator] Tier 2 kendala (${tier2Err?.message}). Mengaktifkan Tier 3 Algorithmic Fallback (Zero-Crash Guarantee)...`
      );
      return curateViralMomentsAlgorithmic(input);
    }
  }

  let cleanJson = candidateText.trim();
  if (cleanJson.startsWith("```json")) {
    cleanJson = cleanJson.replace(/^```json/, "").replace(/```$/, "").trim();
  } else if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.replace(/^```/, "").replace(/```$/, "").trim();
  }

  let parsed: any[];
  try {
    parsed = JSON.parse(cleanJson);
  } catch {
    try {
      const repaired = jsonrepair(cleanJson);
      parsed = JSON.parse(repaired);
    } catch {
      console.warn("[ViralCurator] Gagal parse JSON kurasi Tier 1, beralih ke Tier 3...");
      return curateViralMomentsAlgorithmic(input);
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.warn("[ViralCurator] Array hasil Tier 1 kosong, beralih ke Tier 3...");
    return curateViralMomentsAlgorithmic(input);
  }

  const curated: CuratedViralClip[] = parsed.slice(0, clipLimit).map((item, index) => {
    const { startTime: rawStart, endTime: rawEnd, duration: actualDur } = normalizeSafeTimestamps(
      item.start_time,
      item.end_time,
      totalSec,
      targetDur
    );

    const speakerName = item.speaker_name
      ? String(item.speaker_name).trim().toUpperCase()
      : "NARASUMBER";
    const topBannerTag = item.top_banner_tag
      ? String(item.top_banner_tag).trim().toUpperCase()
      : "[ THE PRECISION ]";
    const topBannerTitle = item.top_banner_title
      ? String(item.top_banner_title).trim().toUpperCase()
      : (item.title ? String(item.title).trim().toUpperCase() : "END-TO-END BLUEPRINT");
    const topBannerSteps = item.top_banner_steps
      ? String(item.top_banner_steps).trim().toUpperCase()
      : "01 CONTEXT ➔ 02 STRATEGY ➔ 03 EXECUTION";

    const { teaserStart, teaserEnd, teaserDuration } = normalizeSafeTeaserTimestamps(
      item.teaser_start,
      item.teaser_end,
      rawStart,
      rawEnd
    );
    const hookCategory = item.hook_category
      ? String(item.hook_category).trim().toUpperCase()
      : (topBannerTag.replace(/[\[\]]/g, "").trim() || "FAKTA LAPANGAN // KLIMAKS");
    const hookHeadline = item.hook_headline
      ? String(item.hook_headline).trim().toUpperCase()
      : (topBannerTitle || "REKAYASA ARSITEKTUR KLIMAKS");
    const hookSubtext = item.hook_subtext
      ? String(item.hook_subtext).trim().toUpperCase()
      : (item.hook_description ? String(item.hook_description).slice(0, 35).toUpperCase() : "DATA KUNCI TERVERIFIKASI");

    return {
      rank: index + 1,
      title: item.title ? String(item.title).trim() : `Momen Viral #${index + 1}`,
      speaker_name: speakerName,
      top_banner_tag: topBannerTag,
      top_banner_title: topBannerTitle,
      top_banner_steps: topBannerSteps,
      start_time: parseFloat(rawStart.toFixed(2)),
      end_time: parseFloat(rawEnd.toFixed(2)),
      duration: actualDur,
      teaser_start: teaserStart,
      teaser_end: teaserEnd,
      teaser_duration: teaserDuration,
      hook_category: hookCategory,
      hook_headline: hookHeadline,
      hook_subtext: hookSubtext,
      viral_score: Math.min(99, Math.max(70, Number(item.viral_score) || 95 - index * 2)),
      viral_reason:
        item.viral_reason || "Hook kuat dengan argumentasi bernilai tinggi bagi audiens.",
      hook_description:
        item.hook_description || "Kalimat pembuka yang langsung menarik perhatian.",
      words: [],
    };
  });

  const guaranteed = ensureExactClipCount(
    curated,
    clipLimit,
    totalSec,
    targetDur,
    input.videoTitle
  );

  console.log(
    `[ViralCurator] Berhasil mengkurasi ${guaranteed.length} momen viral dari audio master (${totalSec}s) (100% presisi kuota terjamin).`
  );
  return guaranteed;
}
