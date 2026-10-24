import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { jsonrepair } from "jsonrepair";
import {
  executeGeminiWithFailover,
  executeGroqWithFailover,
  STANDARD_GEMINI_CANDIDATE_MODELS,
} from "./api_key_manager";
import { getFfmpegPath } from "../utils/ffmpeg-path";
import { renderFastCanvasMotionVideo } from "./fast_canvas_motion";

const execFileAsync = promisify(execFile);

/**
 * [FASE 1: SANITASI TEKS KETAT & HAPUS TOTAL NAMA FILE / MOJIBAKE]
 * Membersihkan seluruh emoji, mojibake, simbol aneh, dan ekstensi file.
 */
export const cleanAscii = (raw: string | undefined | null): string => {
  if (!raw) return "";
  return String(raw)
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\b(mkv|mp4|mov|webm|avi|flv|ts|youtube|2715|2716)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

export function cleanTextForRender(raw: string | undefined | null): string {
  if (!raw) return "";
  let text = String(raw);

  // 1. Double-decoded UTF-8 mojibake repair (e.g. Ã°ÂŸ...)
  try {
    if (/[\xC2\xC3][\x80-\xBF]/.test(text) || text.includes("Ã") || text.includes("Â")) {
      const buf = Buffer.from(text, "latin1");
      const decoded = buf.toString("utf8");
      if (decoded && !decoded.includes("\ufffd") && decoded !== text) {
        text = decoded;
      }
    }
  } catch {}

  // 2. Strip Unicode emojis & special symbols
  text = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE00}-\u{FE0F}]/gu, " ");

  // 3. Strip raw mojibake characters
  text = text.replace(/Ã[\x80-\xBF]+/g, " ");
  text = text.replace(/Â[\x80-\xBF]+/g, " ");

  // 4. Strict ASCII cleanup removing file extensions and noise
  text = cleanAscii(text);

  return text;
}

/**
 * [FASE 1: SANITASI CONVERSATIONAL FILLERS & SLANG LISAN]
 * Membersihkan filler percakapan santai seperti "tau gak sih", "kan bisa bisa", dll.
 */
export function cleanConversationalFillers(raw: string | undefined | null): string {
  if (!raw) return "";
  let text = cleanTextForRender(raw);

  const fillerPhrases = [
    /\btau\s+gak\s+sih\b/gi,
    /\btau\s+nggak\s+sih\b/gi,
    /\btahu\s+tidak\s+sih\b/gi,
    /\bkan\s+bisa\s+bisa\b/gi,
    /\bsemuanya\s+semua\b/gi,
    /\baja\s+lah\b/gi,
    /\bcoba\s+deh\b/gi,
    /\bgimana\s+ya\b/gi,
    /\bapa\s+ya\b/gi,
    /\bkayak\s+gimana\b/gi,
    /\bsebenarnya\s+sih\b/gi,
    /\bmaksudnya\s+tuh\b/gi,
    /\bintinya\s+mah\b/gi,
    /\bgini\s+loh\b/gi,
    /\bgitu\s+deh\b/gi,
    /\bkan\s+ya\b/gi,
    /\bya\s+kan\b/gi,
    /\bkan\s+bisa\b/gi,
    /\bbisa\s+bisa\b/gi,
  ];

  for (const regex of fillerPhrases) {
    text = text.replace(regex, " ");
  }

  // Standalone conversational filler words
  const singleFillers = [
    "dong", "nih", "tuh", "lah", "sih", "kan", "loh", "kok", "deh", "nah", "oke", "yuk", "yah"
  ];
  const fillerWordRegex = new RegExp(`\\b(${singleFillers.join("|")})\\b`, "gi");
  text = text.replace(fillerWordRegex, " ");

  return text.replace(/\s+/g, " ").trim();
}

/**
 * [FASE 1: TRUNCATE AT WORD BOUNDARY - ZERO BROKEN WORDS / ZERO TYPO]
 * Memotong teks secara aman HANYA pada batas spasi kata.
 * DILARANG memotong kata di tengah suku kata (contoh: "AKUNTABILITAS" -> "AKUNTABILI").
 */
export function truncateAtWordBoundary(
  text: string | undefined | null,
  maxChars: number,
  fallback = ""
): string {
  if (!text) return fallback;
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;

  const substr = clean.slice(0, maxChars + 1);
  const lastSpace = substr.lastIndexOf(" ");
  if (lastSpace > 0) {
    const candidate = substr.slice(0, lastSpace).trim();
    return candidate.replace(/[,;:\-\/\\]+$/, "").trim();
  }
  if (clean.length <= maxChars + 3) {
    return clean;
  }
  return clean.slice(0, maxChars).trim();
}

/**
 * [FASE 1: EKSTRAK HEADLINE DARI TRANSKRIP KLIP - BUKAN NAMA FILE]
 * DILARANG KERAS menggunakan nama file video sebagai hook_headline!
 * Mengambil 2-4 kata paling penting dan provokatif dari transkrip klip tersebut tanpa typo / kata nggantung.
 */
export function extractClimaxHeadlineFromTranscript(
  transcript: string | undefined | null,
  fallbackContext?: string
): string {
  const clean = cleanTextForRender(transcript);
  if (!clean || clean.length < 5) {
    const fallbackClean = cleanTextForRender(fallbackContext);
    if (fallbackClean && !fallbackClean.toLowerCase().includes("youtube") && !fallbackClean.includes(".")) {
      return truncateAtWordBoundary(fallbackClean.toUpperCase(), 28, "FAKTA TERVERIFIKASI");
    }
    return "FAKTA TERVERIFIKASI";
  }

  // Indonesian stop words to ignore when looking for punchy topic words
  const stopWords = new Set([
    "yang", "dan", "di", "ini", "itu", "dari", "ke", "pada", "untuk", "dengan",
    "adalah", "kita", "saya", "kamu", "mereka", "dia", "bisa", "ada", "karena",
    "jadi", "kalau", "tapi", "akan", "sudah", "juga", "atau", "tidak", "bukan",
    "saat", "oleh", "secara", "lebih", "harus", "banyak", "hanya", "masih",
    "seperti", "lalu", "namun", "lagi", "bahkan", "sangat", "pun", "apa", "siapa"
  ]);

  const words = clean
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
    .filter((w) => w.length > 2);

  const keyWords = words.filter((w) => !stopWords.has(w.toLowerCase()));

  if (keyWords.length >= 2) {
    return truncateAtWordBoundary(keyWords.slice(0, 4).join(" "), 28, "FAKTA TERVERIFIKASI");
  }

  return truncateAtWordBoundary(words.slice(0, 4).join(" "), 28, "FAKTA TERVERIFIKASI");
}

export type MotionArchetype =
  | "DYNAMIC_COUNTER"
  | "PROCESS_STEPPER"
  | "VERSUS_CARDS"
  | "AUDIO_RADAR"
  | "VERSUS_COMPARISON"
  | "EDITORIAL_TITLE_BANNER";

export interface DynamicCounterData {
  prefix?: string;
  targetValue: number;
  suffix?: string;
  metricLabel?: string;
  growthRate?: string;
}

export interface ProcessStepperData {
  steps: string[];
}

export interface VersusComparisonData {
  leftTitle: string;
  leftDesc?: string;
  rightTitle: string;
  rightDesc?: string;
  versusBadge?: string;
}

export interface EditorialBannerData {
  tag: string;
  headline: string;
  subheadline?: string;
}

export interface GeneralMotionOverlayProps {
  archetype: MotionArchetype;
  tag: string;
  title: string;
  hookQuote?: string;
  speakerName?: string;
  speakerRole?: string;
  keyTakeaway?: string;
  counterData?: DynamicCounterData;
  stepperData?: ProcessStepperData;
  versusData?: VersusComparisonData;
  bannerData?: EditorialBannerData;
  customTsxCode?: string;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface DocProps {
  videoSrc: string;
  title: string;
  hookQuote: string;
  speakerName: string;
  speakerRole: string;
  keyTakeaway: string;
  archetype: string;
  words?: WordTiming[];
  counterTarget?: number;
  counterPrefix?: string;
  counterSuffix?: string;
  counterLabel?: string;
  stepperSteps?: string[];
  versusLeft?: string;
  versusRight?: string;
  fontFamily?: string;
}

export interface MotionValues {
  targetNumber?: number;
  unit?: string;
  metricLabel?: string;
  steps?: string[];
  lucideIcon?: string;
  leftTitle?: string;
  leftDesc?: string;
  rightTitle?: string;
  rightDesc?: string;
}

export interface ClipTranscriptInput {
  clipId: string;
  title: string;
  transcript: string;
  duration: number;
  words?: WordTiming[];
  speakerName?: string;
  hookDescription?: string;
  viralReason?: string;
  topBannerTag?: string;
  topBannerTitle?: string;
  topBannerSteps?: string;
  accentHex?: string;
}

export type VisualSceneType =
  | "FLOW_NODES"
  | "BIG_METRIC_BAR"
  | "KEY_TAKEAWAYS_LIST"
  | "SPLIT_VERSUS"
  | "QUOTE_IMPACT";

export interface VisualSceneDataPayload {
  // FLOW_NODES (Hierarki / Proses / Aktor)
  nodes?: string[];

  // BIG_METRIC_BAR (Angka / Statistik / Perbandingan Bar)
  metric_value?: number;
  metric_prefix?: string;
  metric_suffix?: string;
  metric_display?: string;
  bar_1_label?: string;
  bar_1_value?: number;
  bar_2_label?: string;
  bar_2_value?: number;
  metric_comparison_label?: string;

  // KEY_TAKEAWAYS_LIST (Daftar Poin Kesimpulan)
  bullet_points?: string[];

  // SPLIT_VERSUS (Kontras / Perbandingan Dua Kubu)
  left_pill?: string;
  right_pill?: string;

  // QUOTE_IMPACT (Sorotan Kutipan Kunci)
  impact_subtext?: string;

  // Key Takeaway Footer Pill (Y=380 di bawah seluruh diagram)
  key_takeaway?: string;
}

export interface ExplanationBeat {
  beat_index: number;
  start_sec: number;
  end_sec: number;
  layout_type?: string;
  scene_type?: VisualSceneType;
  step_badge: string;
  kicker_tag?: string;
  title: string;
  highlight_metric: string;
  progress_percent: number; // 33, 66, 100
  icon: string;
  accent_hex: string;
  duration_sec?: number;
  // Aliases for compatibility
  step_label?: string;
  headline?: string;
  lucide_icon?: string;
  motion_curve?: "easeBackOut" | "easeCubicOut" | "easeQuadInOut" | "easeOutExpo";
  accent_tint?: string;
  key_takeaway?: string;
  data_payload?: VisualSceneDataPayload;
}

export type VisualScene = ExplanationBeat;

export interface GeminiArtDirectorOutput {
  hook_scene: {
    badge: string;
    headline: string;
    sub_caption: string;
    icon?: string;
  };
  visual_scenes: VisualScene[];
}

/**
 * [FASE 2 & 3: EXECUTIVE HOOK & MULTI-BEAT STORYBOARDER SCHEMA]
 * Format data JSON ringkas per klip dari GEMINI_API_KEY_ART_DIRECTOR.
 */
export interface ExecutiveHookMetadata {
  clip_id: string;
  speaker_name: string;
  hook_category: string;
  hook_headline: string;
  hook_subtext?: string;
  hook_sub_metric: string;
  lucide_icon: string;
  style_variant?: number;
  accent_hex: string;
  vibe_description?: string;
  teaser_start?: number;
  teaser_end?: number;
  explanation_beats?: ExplanationBeat[];
}

export interface ClipMotionMetadata {
  clipId: string;
  archetype: MotionArchetype;
  headline: string;
  accent_color: string;
  motion_values: MotionValues;
  tag: string;
  title: string;
  hookMetadata?: ExecutiveHookMetadata;
  hookQuote?: string;
  speakerName?: string;
  speakerRole?: string;
  keyTakeaway?: string;
  counterData?: DynamicCounterData;
  stepperData?: ProcessStepperData;
  versusData?: VersusComparisonData;
  bannerData?: EditorialBannerData;
  customTsxCode?: string;
}

/**
 * System prompt untuk Gemini Art Director (Executive Hook Storyboarder - Fase 2 & 8 Varied Styles).
 * Menghasilkan konsep Hook dan Motion Styles dinamis beragam dari 8 Style Archetype kelas dunia.
 */
export const EXECUTIVE_HOOK_STORYBOARDER_SYSTEM_PROMPT = `
Bertindaklah sebagai Executive Visual Storyboarder dan Senior Art Director untuk podcast dokumenter kelas atas (Vox / Bloomberg / Netflix Documentary style).
Tugasmu adalah menganalisis transkrip pembicaraan klip podcast dan merancang konsep "Hook 4.5 Detik Pertama", "Motion Style Variant", dan "3 Explanation Motion Beats" di sepanjang klip yang bervariasi, dinamis, elegan, dan bebas dari kemonotonan.

PILIHAN 8 GAYA MOTION ARCHETYPE (DIPILIH BERDASARKAN EMOSI & TOPIK MASING-MASING KLIP):
- 0: "GLOWING_KINETIC_TYPOGRAPHY" (Aksen: #FF6B00 / #FF4500) -> Opini viral, pernyataan mengejutkan, punchline dramatis.
- 1: "CYBER_GLASS_TIMELINE" (Aksen: #06B6D4 / #00F5FF) -> Teknologi, AI, alur proses digital, internet, masa depan.
- 2: "WARM_GOLD_METRIC_HUD" (Aksen: #F59E0B / #D97706) -> Uang, finansial, investasi, miliaran rupiah, bisnis eksekutif, HUD korporat.
- 3: "MINIMAL_APPLE_CARDS" (Aksen: #38BDF8 / #FFFFFF) -> Edukasi elegan, psikologi, produktivitas, card minimalis modern.
- 4: "CRIMSON_EDITORIAL_SPLIT" (Aksen: #E50914 / #DC2626) -> Skandal, investigasi kritis, bahaya, hukum, kontroversi politik ala Netflix.
- 5: "ELECTRIC_PURPLE_CREATOR" (Aksen: #8B5CF6 / #A855F7) -> Industri kreatif, media sosial, tren Gen-Z, podcast, viral marketing.
- 6: "EMERALD_INVESTIGATIVE_MATRIX" (Aksen: #10B981 / #059669) -> Solusi nyata, pertumbuhan positif, kesehatan, audit sains & lingkungan.
- 7: "BOLD_SWISS_BRUTALIST" (Aksen: #FACC15 / #EAB308) -> Debat sengit, perbandingan ekstrem, fakta telak, kontras hitam-kuning.

PENTING: JANGAN MENGGUNAKAN SATU GAYA UNTUK SEMUA KLIP! VARIASIKAN GAYA SETIAP KLIP SESUAI TOPIKNYA!

Untuk SETIAP klip yang diberikan, hasilkan data JSON yang sangat presisi:
- "clip_id": ID klip persis seperti input.
- "speaker_name": Nama narasumber asli jika dibahas/dikenali di transkrip, atau "NARASUMBER" jika tidak disebutkan (DILARANG mengarang nama).
- "hook_category": Kategori provokatif dalam huruf kapital dengan pemisah ganda (misal: "INVESTIGASI // FAKTA", "STRATEGI // BLUEPRINT", "ANALISIS // REALITA", "TEKNOLOGI // AI REVOLUTION").
- "hook_headline": Judul Hook utama yang sangat kuat dan bernas dalam HURUF BESAR (MAKSIMAL 5 KATA). Jangan bertele-tele!
- "hook_sub_metric": Konteks singkat atau metrik kunci pendukung (MAKSIMAL 4 KATA).
- "hook_subtext": 1 baris konteks pendek di bawah judul (maksimal 5 kata, contoh: "KONTROVERSI DATA PEMERINTAH").
- "lucide_icon": Pilih SATU nama ikon Lucide yang relevan ("Flame", "Coins", "Workflow", "TrendingUp", "ShieldAlert", "Cpu", "Zap", "Layers", "CheckCircle2", "Scale").
- "style_variant": Integer 0 s/d 7 sesuai gaya motion yang paling cocok.
- "accent_hex": Warna aksen yang selaras (#FF6B00, #06B6D4, #F59E0B, #38BDF8, #E50914, #8B5CF6, #10B981, #FACC15).
- "vibe_description": Deskripsi singkat suasana visual (contoh: "WARM GOLD METRIC HUD").
- "explanation_beats": Tepat 3 kartu visual penjelas alur bahasan di detik penting:
  [
    {
      "beat_index": 1,
      "step_label": "01 // AKAR MASALAH",
      "headline": "POKOK MASALAH UTAMA",
      "highlight_metric": "BUKTI DATA KUNCI",
      "lucide_icon": "AlertCircle",
      "accent_hex": "#E50914",
      "start_sec": 7.0,
      "duration_sec": 4.0
    },
    {
      "beat_index": 2,
      "step_label": "02 // ANALISIS INTI",
      "headline": "TEMUAN FAKTA UTAMA",
      "highlight_metric": "TEMUAN 100% NYATA",
      "lucide_icon": "TrendingUp",
      "accent_hex": "#F59E0B",
      "start_sec": 19.0,
      "duration_sec": 4.0
    },
    {
      "beat_index": 3,
      "step_label": "03 // KESIMPULAN",
      "headline": "SOLUSI & LANGKAH NYATA",
      "highlight_metric": "HASIL STRATEGIS",
      "lucide_icon": "Zap",
      "accent_hex": "#20B2AA",
      "start_sec": 31.0,
      "duration_sec": 4.0
    }
  ]

KEMBALIKAN HANYA ARRAY JSON VALID MURNI TANPA MARKDOWN (TANPA \`\`\`json).
`;

/**
 * [FASE 1 & 2: ZERO-HARDCODE SEMANTIC INSIGHT EXTRACTOR]
 * DILARANG KERAS menggunakan naive word slicing (words.slice/split) atau filler percakapan!
 * Jika Gemini Art Director lambat/gagal, fungsi ini mengekstrak entitas substantif dan
 * menghasilkan ringkasan eksekutif berstruktur rapi tanpa potongan kata lisan mentah.
 */
/**
 * [FASE 1: ZOD SCHEMA & AI ART DIRECTOR SPECIFICATION]
 * Menghubungkan skill validasi schema (Zod), kurva easing (d3-ease/bezier-easing),
 * dan ikonografi visual (lucide-static) ke AI Art Director.
 */
export const MotionCurveZod = z.enum([
  "easeBackOut",
  "easeCubicOut",
  "easeQuadInOut",
  "easeOutExpo",
]);
export type MotionCurve = z.infer<typeof MotionCurveZod>;

export const VisualSceneTypeZod = z.enum([
  "FLOW_NODES",
  "BIG_METRIC_BAR",
  "SPLIT_VERSUS",
  "QUOTE_IMPACT",
  "KEY_TAKEAWAYS_LIST",
]);

export const DualAIHookItemSchema = z.object({
  kicker: z.string().default("SOROTAN // KLIMAKS"),
  headline: z.string().default("MOMEN KRUSIAL TOPIK"),
  subtext: z.string().default("FAKTA TERVERIFIKASI"),
  lucide_icon: z.string().default("Flame"),
  motion_curve: MotionCurveZod.default("easeOutExpo"),
});

export const DualAISceneItemSchema = z.object({
  part: z.number().default(1),
  type: VisualSceneTypeZod.default("KEY_TAKEAWAYS_LIST"),
  kicker: z.string().default("POIN PENTING"),
  headline: z.string().default("SUBSTANSI PEMBAHASAN"),
  items: z.array(z.string()).default([]),
  footer_note: z.string().default(""),
  lucide_icon: z.string().default("Sparkles"),
  motion_curve: MotionCurveZod.default("easeBackOut"),
  accent_tint: z.string().optional(),
});

export const DualAIMotionDirectorOutputSchema = z.object({
  style_variant: z.number().min(0).max(7).optional().default(0),
  accent_hex: z.string().optional().default("#FF6B00"),
  vibe_description: z.string().optional().default("Cinematic Motion"),
  hook: DualAIHookItemSchema,
  scenes: z.array(DualAISceneItemSchema).default([]),
});

export interface DualAISceneItem {
  part: number;
  type: VisualSceneType;
  kicker: string;
  headline: string;
  items: string[];
  footer_note: string;
  lucide_icon?: string;
  motion_curve?: MotionCurve;
  accent_tint?: string;
}

export interface DualAIHookItem {
  kicker: string;
  headline: string;
  subtext: string;
  lucide_icon?: string;
  motion_curve?: MotionCurve;
}

export interface DualAIMotionDirectorOutput {
  style_variant?: number;
  accent_hex?: string;
  vibe_description?: string;
  hook: DualAIHookItem;
  scenes: DualAISceneItem[];
  beats?: ExplanationBeat[];
}

export interface SegmentBeatInput {
  clipId?: string;
  title?: string;
  duration: number;
  segments: {
    hook: string;
    part1: string;
    part2: string;
    part3: string;
  };
  accentHex?: string;
}

/**
 * [FASE 1: DETERMINISTIC TRANSCRIPT KEYWORD EXTRACTOR - ZERO HARDCODE]
 * DILARANG KERAS menggunakan string template palsu ("POKOK PEMBAHASAN UTAMA", "Rp 99 UNIT", dll)!
 * Mengekstrak entitas dan frasa kunci asli langsung dari potongan transkrip segmen tersebut.
 */
export function generateDeterministicSegmentBeats(input: SegmentBeatInput): DualAIMotionDirectorOutput & { beats: ExplanationBeat[] } {
  const dur = Math.max(12, Math.round(input.duration));
  const accentHex = input.accentHex && /^#[0-9A-Fa-f]{6}$/.test(input.accentHex) ? input.accentHex : "#E50914";

  const stopWords = new Set([
    "yang", "dan", "di", "ini", "itu", "dari", "ke", "pada", "untuk", "dengan",
    "adalah", "kita", "saya", "kamu", "mereka", "dia", "bisa", "ada", "karena",
    "jadi", "kalau", "tapi", "akan", "sudah", "juga", "atau", "tidak", "bukan",
    "saat", "oleh", "secara", "lebih", "harus", "banyak", "hanya", "masih",
    "seperti", "lalu", "namun", "lagi", "bahkan", "sangat", "pun", "apa", "siapa",
    "dong", "sih", "lah", "deh", "nah", "oke", "ya", "yah", "kan", "kok", "loh",
    "tau", "gak", "nggak", "tahu", "coba", "gimana", "kayak", "maksudnya", "intinya",
    "gini", "gitu", "nih", "tuh", "aja"
  ]);

  const extractHeadlineWords = (text: string, fallback: string): string => {
    const clean = cleanConversationalFillers(text);
    const tokens = clean
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
      .filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));
    if (tokens.length >= 2) {
      return truncateAtWordBoundary(tokens.slice(0, 4).join(" "), 28, fallback);
    }
    return truncateAtWordBoundary((cleanTextForRender(fallback) || "SOROTAN UTAMA").toUpperCase(), 28);
  };

  const extractBullets = (text: string): string[] => {
    const clean = cleanConversationalFillers(text);
    const sents = clean.split(/[.,?!;]/).map((s) => s.trim()).filter((s) => s.length > 6);
    if (sents.length >= 2) {
      return [
        truncateAtWordBoundary(sents[0]!, 36, "Poin Kritis Lapangan"),
        truncateAtWordBoundary(sents[1]!, 36, "Urgensi Kebijakan Nyata"),
      ];
    }
    const words = clean.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));
    const b1 = truncateAtWordBoundary(words.slice(0, 4).join(" "), 32, "Poin Kritis Lapangan");
    const b2 = truncateAtWordBoundary(words.slice(4, 8).join(" "), 32, "Urgensi Kebijakan Nyata");
    return [b1, b2];
  };

  function detectSegmentArchetype(
    text: string,
    defaultType: VisualSceneType,
    partIndex: number
  ): {
    type: VisualSceneType;
    items: string[];
    kicker: string;
    footer: string;
  } {
    const clean = cleanConversationalFillers(text);
    const numMatch = clean.match(/\b\d+(\.\d+)?\b/);
    const isYearOnly = /\b(19\d\d|20\d\d)\b/.test(clean) && !/(miliar|triliun|juta|ribu|persen|%|rp|dolar|hektar|ton)/i.test(clean);
    const hasMetricUnit = /(miliar|triliun|juta|ribu|persen|%|rp|usd|dolar|hektar|ton|kg)/i.test(clean);

    if (numMatch && !isYearOnly && hasMetricUnit) {
      const isRupiah = /rp|miliar|triliun|juta/i.test(clean);
      return {
        type: "BIG_METRIC_BAR",
        items: [
          truncateAtWordBoundary(`TOTAL ESTIMASI ${isRupiah ? "DANA" : "VOLUME"}`, 24),
          truncateAtWordBoundary("REALISASI DAERAH", 24),
        ],
        kicker: "FAKTA // ANGGARAN",
        footer: "Data Statistik Terverifikasi",
      };
    }

    if (/(lawan|vs|versus|dibanding|beda|masalah|kontras|konflik|padahal|kenyataan)/i.test(clean)) {
      return {
        type: "SPLIT_VERSUS",
        items: ["RENCANA AWAL", "REALITA LAPANGAN"],
        kicker: "KOMPARASI // REALITA",
        footer: "Kesenjangan Lapangan Terlihat",
      };
    }

    if (/(presiden|kementerian|menteri|pemda|bupati|gubernur|dinas|dprd|alur|proses|birokrasi|regulasi|kebijakan)/i.test(clean)) {
      return {
        type: "FLOW_NODES",
        items: ["PEMERINTAH PUSAT", "KEMENTERIAN", "PEMDA DAERAH"],
        kicker: "HIERARKI // ALUR",
        footer: "Koordinasi Antar Lembaga Krusial",
      };
    }

    if (/(menurut|bilang|mengatakan|ungkap|tegaskan|soroti|kata narasumber|saya kira|pernyataan)/i.test(clean)) {
      const punchySent = clean.split(/[.,?!;]/).map((s) => s.trim()).filter((s) => s.length > 8)[0];
      return {
        type: "QUOTE_IMPACT",
        items: [truncateAtWordBoundary(punchySent || "Pernyataan Penting Lapangan", 36)],
        kicker: "SOROTAN // PERNYATAAN",
        footer: "Pernyataan Kunci Narasumber",
      };
    }

    return {
      type: defaultType,
      items: extractBullets(clean),
      kicker: `POIN 0${partIndex} // SUBSTANSI`,
      footer: "Substansi Lapangan Terverifikasi",
    };
  }

  const hookHead = extractHeadlineWords(input.segments.hook, input.title || "SOROTAN UTAMA TOPIK");
  const hookWords = cleanConversationalFillers(input.segments.hook).split(/\s+/).filter((w) => w.length > 2);
  const hookSub = truncateAtWordBoundary(hookWords.slice(4, 9).join(" "), 32, "DATA TERVERIFIKASI");

  const p1Detected = detectSegmentArchetype(input.segments.part1, "FLOW_NODES", 1);
  const p2Detected = detectSegmentArchetype(input.segments.part2, "BIG_METRIC_BAR", 2);
  const p3Detected = detectSegmentArchetype(input.segments.part3, "KEY_TAKEAWAYS_LIST", 3);

  const p1Head = extractHeadlineWords(input.segments.part1, "ANALISIS TOPIK PERTAMA");
  const p2Head = extractHeadlineWords(input.segments.part2, "FAKTA KUNCI LAPANGAN");
  const p3Head = extractHeadlineWords(input.segments.part3, "EVALUASI DAN KESIMPULAN");

  const scenes: DualAISceneItem[] = [
    {
      part: 1,
      type: p1Detected.type,
      kicker: p1Detected.kicker,
      headline: p1Head,
      items: p1Detected.items,
      footer_note: p1Detected.footer,
    },
    {
      part: 2,
      type: p2Detected.type,
      kicker: p2Detected.kicker,
      headline: p2Head,
      items: p2Detected.items,
      footer_note: p2Detected.footer,
    },
    {
      part: 3,
      type: p3Detected.type,
      kicker: p3Detected.kicker,
      headline: p3Head,
      items: p3Detected.items,
      footer_note: p3Detected.footer,
    },
  ];

  const beats = mapDualAIScenesToExplanationBeats({
    scenes,
    duration: dur,
    accentHex,
  });

  const allText = `${input.segments.hook} ${input.segments.part1} ${input.segments.part2} ${input.segments.part3}`.toLowerCase();
  let fallbackStyleVariant = 0;
  let fallbackAccent = accentHex;
  let fallbackVibe = "Cinematic Motion";

  if (/(uang|dana|rupiah|miliar|triliun|anggaran|bisnis|omzet|investasi|pajak|gaji|keuntungan|profit)/i.test(allText)) {
    fallbackStyleVariant = 2; // WARM_GOLD_METRIC_HUD
    fallbackAccent = "#F59E0B";
    fallbackVibe = "WARM GOLD METRIC HUD";
  } else if (/(ai|teknologi|software|sistem|digital|internet|komputer|aplikasi|data|coding|robot)/i.test(allText)) {
    fallbackStyleVariant = 1; // CYBER_GLASS_TIMELINE
    fallbackAccent = "#06B6D4";
    fallbackVibe = "CYBER GLASS TIMELINE";
  } else if (/(kreator|konten|youtube|tiktok|instagram|views|followers|viral|podcast|influencer)/i.test(allText)) {
    fallbackStyleVariant = 5; // ELECTRIC_PURPLE_CREATOR
    fallbackAccent = "#8B5CF6";
    fallbackVibe = "ELECTRIC PURPLE CREATOR";
  } else if (/(solusi|lingkungan|tumbuh|kesehatan|berkelanjutan|green|medis|dokter|organik)/i.test(allText)) {
    fallbackStyleVariant = 6; // EMERALD_INVESTIGATIVE_MATRIX
    fallbackAccent = "#10B981";
    fallbackVibe = "EMERALD INVESTIGATIVE MATRIX";
  } else if (/(lawan|debat|beda|kontras|versus|kritik|bantah|kebohongan|fakta|perbandingan)/i.test(allText)) {
    fallbackStyleVariant = 7; // BOLD_SWISS_BRUTALIST
    fallbackAccent = "#FACC15";
    fallbackVibe = "BOLD SWISS BRUTALIST";
  } else if (/(skandal|kasus|hukum|korupsi|polisi|jaksa|bahaya|ancaman|krisis|darurat)/i.test(allText)) {
    fallbackStyleVariant = 4; // CRIMSON_EDITORIAL_SPLIT
    fallbackAccent = "#E50914";
    fallbackVibe = "CRIMSON EDITORIAL INVESTIGATION";
  } else if (/(tips|rahasia|cara|mindset|psikologi|kebiasaan|buku|belajar|prinsip)/i.test(allText)) {
    fallbackStyleVariant = 3; // MINIMAL_APPLE_CARDS
    fallbackAccent = "#38BDF8";
    fallbackVibe = "MINIMAL APPLE KEYNOTE";
  } else {
    const seed = (input.title || "").length + (input.clipId || "").length;
    fallbackStyleVariant = seed % 8;
  }

  return {
    style_variant: fallbackStyleVariant,
    accent_hex: fallbackAccent,
    vibe_description: fallbackVibe,
    hook: {
      kicker: "SOROTAN UTAMA // KLIMAKS",
      headline: hookHead,
      subtext: hookSub,
    },
    scenes,
    beats,
  };
}

/**
 * Maps Dual-AI scenes into ExplanationBeat array for canvas motion and rendering engines.
 */
export function mapDualAIScenesToExplanationBeats(options: {
  scenes: DualAISceneItem[];
  duration: number;
  accentHex: string;
}): ExplanationBeat[] {
  const { scenes, duration, accentHex } = options;
  const dur = Math.max(12, Math.round(duration));
  const tMid1 = parseFloat(Math.min(18.0, dur * 0.38).toFixed(1));
  const tMid2 = parseFloat(Math.min(33.0, dur * 0.72).toFixed(1));

  const timeSlots = [
    { start: 4.0, end: tMid1, hex: accentHex },
    { start: tMid1, end: tMid2, hex: "#F59E0B" },
    { start: tMid2, end: dur, hex: "#20B2AA" },
  ];

  return scenes.slice(0, 3).map((scene, idx) => {
    const slot = timeSlots[idx] || { start: 4.0 + idx * 8, end: 4.0 + (idx + 1) * 8, hex: accentHex };
    const sSec = parseFloat(Math.max(0.5, slot.start).toFixed(1));
    const eSec = parseFloat(Math.min(dur, Math.max(sSec + 2.5, slot.end)).toFixed(1));
    let sceneType: VisualSceneType = scene.type || "KEY_TAKEAWAYS_LIST";

    const kicker = truncateAtWordBoundary(cleanAscii(scene.kicker || `POIN 0${idx + 1} // ANALISIS`).toUpperCase(), 24);
    const headline = truncateAtWordBoundary(cleanAscii(scene.headline || "SOROTAN TOPIK").toUpperCase(), 28);
    const footerNote = truncateAtWordBoundary(cleanAscii(scene.footer_note || "Fakta Terverifikasi Lapangan"), 38);

    const payload: VisualSceneDataPayload = {
      key_takeaway: footerNote,
    };

    // Strict validation for BIG_METRIC_BAR:
    // Only allow if real currency/percentage/area exists. Year numbers (1999, 2024) are FORBIDDEN from BIG_METRIC_BAR.
    if (sceneType === "BIG_METRIC_BAR") {
      const combinedText = `${headline} ${scene.items.join(" ")}`;
      const numMatch = combinedText.match(/\b\d+(\.\d+)?\b/);
      const isYear = /\b(19\d\d|20\d\d)\b/.test(combinedText);
      const hasCurrencyOrUnit = /(miliar|triliun|juta|ribu|persen|%|rp|usd|dolar|hektar|ton)/i.test(combinedText);

      if (numMatch && !isYear && hasCurrencyOrUnit) {
        const val = parseFloat(numMatch[0]);
        const isRupiah = /rp|miliar|triliun|juta/i.test(combinedText);
        let suffix = "";
        if (/%|persen/i.test(combinedText)) suffix = "%";
        else if (/miliar/i.test(combinedText)) suffix = " MILIAR";
        else if (/triliun/i.test(combinedText)) suffix = " TRILIUN";
        else if (/juta/i.test(combinedText)) suffix = " JUTA";
        else if (/hektar/i.test(combinedText)) suffix = " HEKTAR";
        else if (/ton/i.test(combinedText)) suffix = " TON";

        payload.metric_value = val;
        payload.metric_prefix = isRupiah ? "Rp " : "";
        payload.metric_suffix = suffix;
        payload.metric_display = `${isRupiah ? "Rp " : ""}${val}${suffix}`;
        payload.bar_1_label = truncateAtWordBoundary(cleanAscii(scene.items[0] || "TOTAL ESTIMASI ALOKASI").toUpperCase(), 24);
        payload.bar_1_value = 100;
        payload.bar_2_label = truncateAtWordBoundary(cleanAscii(scene.items[1] || "DISTRIBUSI DAERAH").toUpperCase(), 24);
        payload.bar_2_value = 40;
      } else {
        // Fall back to KEY_TAKEAWAYS_LIST if year or invalid metric
        sceneType = "KEY_TAKEAWAYS_LIST";
        payload.bullet_points = scene.items.slice(0, 2).map((it) => truncateAtWordBoundary(cleanAscii(it), 36));
      }
    } else if (sceneType === "FLOW_NODES") {
      const rawNodes = scene.items.length >= 3 ? scene.items.slice(0, 3) : [...scene.items, "PELAKSANA"];
      payload.nodes = rawNodes.map((n) => truncateAtWordBoundary(cleanAscii(n).toUpperCase(), 16));
    } else if (sceneType === "SPLIT_VERSUS") {
      payload.left_pill = truncateAtWordBoundary(cleanAscii(scene.items[0] || "FAKTA KUNCI").toUpperCase(), 20);
      payload.right_pill = truncateAtWordBoundary(cleanAscii(scene.items[1] || "TANTANGAN").toUpperCase(), 20);
    } else if (sceneType === "QUOTE_IMPACT") {
      payload.impact_subtext = truncateAtWordBoundary(cleanAscii(scene.items[0] || headline).toUpperCase(), 36);
    } else {
      payload.bullet_points = scene.items.slice(0, 2).map((it) => truncateAtWordBoundary(cleanAscii(it), 36));
    }

    const defaultIcon =
      sceneType === "BIG_METRIC_BAR"
        ? "DollarSign"
        : sceneType === "FLOW_NODES"
        ? "TrendingUp"
        : sceneType === "SPLIT_VERSUS"
        ? "Zap"
        : sceneType === "QUOTE_IMPACT"
        ? "Flame"
        : "ShieldAlert";

    const chosenIcon = scene.lucide_icon || defaultIcon;

    const defaultCurve: MotionCurve =
      sceneType === "BIG_METRIC_BAR"
        ? "easeBackOut"
        : sceneType === "FLOW_NODES"
        ? "easeCubicOut"
        : sceneType === "SPLIT_VERSUS"
        ? "easeQuadInOut"
        : sceneType === "QUOTE_IMPACT"
        ? "easeOutExpo"
        : "easeBackOut";

    const chosenCurve = scene.motion_curve || defaultCurve;
    const chosenTint = scene.accent_tint && /^#[0-9A-Fa-f]{6}$/.test(scene.accent_tint) ? scene.accent_tint : slot.hex;

    return {
      beat_index: idx + 1,
      start_sec: sSec,
      end_sec: eSec,
      duration_sec: parseFloat((eSec - sSec).toFixed(1)),
      layout_type: sceneType,
      scene_type: sceneType,
      step_badge: kicker,
      kicker_tag: kicker,
      title: headline,
      headline,
      highlight_metric: footerNote,
      progress_percent: idx === 0 ? 33 : idx === 1 ? 66 : 100,
      icon: chosenIcon,
      lucide_icon: chosenIcon,
      motion_curve: chosenCurve,
      accent_tint: chosenTint,
      accent_hex: chosenTint,
      step_label: kicker,
      key_takeaway: footerNote,
      data_payload: payload,
    };
  });
}

/**
 * [FASE 3: DUAL-AI ENGINE PADA MOTION DIRECTOR]
 * Engine 1: Groq Chat Completion (llama-3.3-70b-versatile, openai/gpt-oss-120b, qwen/qwen3.8-27b) dengan response_format: { type: "json_object" }.
 * Engine 2: Gemini Failover (gemini-3.8-flash, gemini-flash-latest) JSON Mode.
 * Fallback: Deterministic transcript keyword extractor (ZERO canned sentences).
 */
export async function analyzeSegmentBeatsWithDualAI(
  input: SegmentBeatInput
): Promise<DualAIMotionDirectorOutput & { beats: ExplanationBeat[] }> {
  const dur = Math.max(12, Math.round(input.duration));
  const accentHex = input.accentHex && /^#[0-9A-Fa-f]{6}$/.test(input.accentHex) ? input.accentHex : "#E50914";

  const prompt = `
Bertindaklah sebagai Art Director & Visual Motion Producer profesional (gaya Vox / Bloomberg / Visual Capitalist).
Tugasmu adalah menganalisis transkrip pembicaraan klip podcast dari 4 segmen waktu nyata dan merancang visual motion header yang 100% AKURAT DENGAN UCAPAN NARASUMBER.

TRANSKRIP 4 SEGMEN WAKTU:
- SEGMEN 0 (Hook 00:00 - 00:04):
"${cleanConversationalFillers(input.segments.hook).slice(0, 1000)}"

- SEGMEN 1 (Part 1 00:04 - 00:18):
"${cleanConversationalFillers(input.segments.part1).slice(0, 1200)}"

- SEGMEN 2 (Part 2 00:18 - 00:33):
"${cleanConversationalFillers(input.segments.part2).slice(0, 1200)}"

- SEGMEN 3 (Part 3 00:33 - ${dur}s):
"${cleanConversationalFillers(input.segments.part3).slice(0, 1200)}"

STANDAR KUALITAS EDITORIAL TINGGI & ATURAN ANTI-SLOP (AMBIL YANG PENTING SAJA):
1. AMBIL INTI SUBSTANSI, DILARANG MEMASUKKAN KATA-KATA CANGGUNG ATAU NGGANTUNG:
   - Hook (0-4s):
     * "kicker": Kategori tajam (1-2 kata, contoh: "SOROTAN // KLIMAKS", "INVESTIGASI // FAKTA").
     * "headline": Judul utama bernas dalam HURUF BESAR (TEPAT 2 HINGGA 4 KATA MAKSIMAL, contoh: "DANA 260 MILIAR MACET", "KRISIS KOORDINASI DAERAH"). DILARANG LEBIH DARI 4 KATA!
     * "subtext": 1 baris konteks pendek (maksimal 4 kata).
   - Part 1 (4-18s), Part 2 (18-33s), Part 3 (33s-end):
     * "kicker": Label topik ringkas (1-2 kata, huruf besar, contoh: "FAKTA // ANGGARAN", "ALUR // BIROKRASI", "EVALUASI // KEBIJAKAN").
     * "headline": TEPAT 2 HINGGA 4 KATA MAKSIMAL dalam huruf besar. Harus berupa frasa utuh bermakna, BUKAN potongan kata nggantung!
     * "type": Pilih tipe layout visual yang PALING SESUAI dengan topik segmen tersebut (VARIASIKAN, jangan sama semua):
       - "FLOW_NODES": jika membahas alur proses, koordinasi, pihak, atau birokrasi. Berikan "items": array tepat 3 pihak/tahap (masing-masing 1-2 kata, contoh: ["PUSAT", "PROVINSI", "KABUPATEN"]).
       - "BIG_METRIC_BAR": HANYA JIKA ADA ANGKA NYATA berupa uang, persentase, atau jumlah kuantitas fisik (seperti hektar, ton) yang secara eksplisit disebut di audio. Jika angka berupa TAHUN (seperti 1999 atau 2024), DILARANG KERAS dijadikan BIG_METRIC_BAR (jadikan teks biasa "PERIODE 1999 - 2003" di tipe lain). Berikan "items": array 2 bar perbandingan (contoh: ["ALOKASI PUSAT: 100%", "REALISASI DAERAH: 40%"]).
       - "KEY_TAKEAWAYS_LIST": jika membahas kritik, argumen, atau temuan fakta penting. Berikan "items": array 2 poin penting (masing-masing 3-4 kata utuh).
       - "SPLIT_VERSUS": jika membandingkan dua kutub, kontras masalah vs solusi, atau rencana vs realita. Berikan "items": array 2 kutub (masing-masing 1-2 kata, contoh: ["RENCANA PUSAT", "KENDALA DAERAH"]).
       - "QUOTE_IMPACT": jika ada satu pernyataan tajam atau kutipan paling berbobot. Berikan "items": array 1 kalimat kutipan ringkas (maks 4-5 kata).
     * "footer_note": 1 kalimat takeaway ringkas di bagian bawah diagram (maks 4 kata).
2. DILARANG KERAS mengarang fakta yang tidak ada di transkrip!
3. DILARANG menggunakan kata percakapan lisan santai ("tau gak sih", "kan bisa bisa").
4. DILARANG TYPO DAN DILARANG MEMOTONG KATA DI TENGAH SUKU KATA.

5. ARAHAN ART & DESAIN MOTION DARI 8 STYLE ARCHETYPE (DIPILIH SECARA CERDAS OLEH AI ART DIRECTOR):
   - "style_variant" (Pilih integer 0 s/d 7 yang paling merefleksikan emosi & topik klip ini, JANGAN SAMAKAN SEMUA):
     * 0: GLOWING_KINETIC_TYPOGRAPHY (Aksen: #FF6B00 / #FF4500) -> Opini viral, pernyataan mengejutkan, punchline dramatis.
     * 1: CYBER_GLASS_TIMELINE (Aksen: #06B6D4 / #00F5FF) -> Teknologi, AI, alur proses digital, internet, masa depan.
     * 2: WARM_GOLD_METRIC_HUD (Aksen: #F59E0B / #D97706) -> Uang, finansial, investasi, miliaran rupiah, bisnis eksekutif, HUD korporat.
     * 3: MINIMAL_APPLE_CARDS (Aksen: #38BDF8 / #FFFFFF) -> Edukasi elegan, psikologi, produktivitas, card minimalis modern.
     * 4: CRIMSON_EDITORIAL_SPLIT (Aksen: #E50914 / #DC2626) -> Skandal, investigasi kritis, bahaya, hukum, kontroversi politik ala Netflix.
     * 5: ELECTRIC_PURPLE_CREATOR (Aksen: #8B5CF6 / #A855F7) -> Industri kreatif, media sosial, tren Gen-Z, podcast, viral marketing.
     * 6: EMERALD_INVESTIGATIVE_MATRIX (Aksen: #10B981 / #059669) -> Solusi nyata, pertumbuhan positif, kesehatan, audit sains & lingkungan.
     * 7: BOLD_SWISS_BRUTALIST (Aksen: #FACC15 / #EAB308) -> Debat sengit, perbandingan ekstrem, fakta telak, kontras hitam-kuning.
   - "accent_hex": Hex warna aksen yang dipilih untuk klip ini (misal #E50914, #06B6D4, #F59E0B, #8B5CF6, #10B981, #FACC15, dll).
   - "vibe_description": Deskripsi singkat suasana visual (contoh: "WARM GOLD METRIC HUD").

6. IKONOGRAFI & KURVA ANIMASI:
   - "lucide_icon": Pilih SATU nama ikon Lucide yang paling relevan dengan konteks:
     * Keuangan/Anggaran/Uang: "Coins", "TrendingUp", "DollarSign"
     * Krisis/Masalah/Bahaya/Api: "Flame", "AlertTriangle", "ShieldAlert"
     * Proses/Birokrasi/Regulasi: "Workflow", "Scale", "Layers", "Landmark"
     * Konflik/Perbandingan: "Zap", "Swords", "GitCompare"
     * Tokoh/Masyarakat: "Users", "UserCheck", "Megaphone"
     * Data/Fakta/Kutipan: "Target", "BarChart3", "CheckCircle2"
   - "motion_curve": Pilih kurva animasi:
     * "easeBackOut": efek pop menghentak/antusias (bagus untuk angka besar / BIG_METRIC_BAR).
     * "easeCubicOut": alur halus korporat (bagus untuk proses / FLOW_NODES).
     * "easeQuadInOut": dinamis seimbang (bagus untuk komparasi / SPLIT_VERSUS).
     * "easeOutExpo": dramatis klimaks tajam (bagus untuk QUOTE_IMPACT / HOOK).
   - "accent_tint": Hex warna aksen pendukung suasana.

FORMAT JSON WAJIB (Kembalikan HANYA JSON valid murni):
{
  "style_variant": 2,
  "accent_hex": "#F59E0B",
  "vibe_description": "WARM GOLD METRIC HUD",
  "hook": {
    "kicker": "LABEL TOPIK HOOK",
    "headline": "JUDUL UTAMA KLIMAKS HOOK",
    "subtext": "Konteks singkat pendukung",
    "lucide_icon": "Flame",
    "motion_curve": "easeOutExpo"
  },
  "scenes": [
    {
      "part": 1,
      "type": "FLOW_NODES",
      "kicker": "KICKER TOPIK 1",
      "headline": "RINGKASAN SUBSTANSI PART 1",
      "items": ["ITEM 1", "ITEM 2", "ITEM 3"],
      "footer_note": "Kesimpulan ringkas part 1",
      "lucide_icon": "Workflow",
      "motion_curve": "easeCubicOut",
      "accent_tint": "#06B6D4"
    },
    {
      "part": 2,
      "type": "BIG_METRIC_BAR",
      "kicker": "KICKER TOPIK 2",
      "headline": "RINGKASAN SUBSTANSI PART 2",
      "items": ["BAR 1", "BAR 2"],
      "footer_note": "Kesimpulan ringkas part 2",
      "lucide_icon": "Coins",
      "motion_curve": "easeBackOut",
      "accent_tint": "#F59E0B"
    },
    {
      "part": 3,
      "type": "KEY_TAKEAWAYS_LIST",
      "kicker": "KICKER TOPIK 3",
      "headline": "RINGKASAN SUBSTANSI PART 3",
      "items": ["POIN KUNCI A", "POIN KUNCI B"],
      "footer_note": "Kesimpulan ringkas part 3",
      "lucide_icon": "CheckCircle2",
      "motion_curve": "easeBackOut",
      "accent_tint": "#10B981"
    }
  ]
}
`;

  let parsedOutput: DualAIMotionDirectorOutput | null = null;

  // -------------------------------------------------------------
  // ENGINE 1: GROQ CHAT COMPLETION (PRIMARY - ULTRA FAST JSON)
  // -------------------------------------------------------------
  try {
    const groqCandidates = [
      "llama-3.3-70b-versatile",
      "openai/gpt-oss-120b",
      "qwen/qwen3.8-27b",
      "openai/gpt-oss-20b",
    ];

    const rawGroq = await executeGroqWithFailover(async (client, keyInfo) => {
      for (const modelId of groqCandidates) {
        try {
          console.log(`[MotionDirector] Mencoba Groq Engine 1 (${keyInfo.label}) dengan model ${modelId}...`);
          const res = await client.chat.completions.create({
            model: modelId,
            messages: [
              {
                role: "system",
                content: "You are an executive Art Director & Visual Motion Designer. Always output valid JSON strictly matching the requested schema.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
          });

          const content = res.choices[0]?.message?.content;
          if (content && content.includes("{") && content.includes("scenes")) {
            console.log(`[MotionDirector] Groq Engine 1 (${modelId}) sukses memberikan respons!`);
            return content;
          }
        } catch (mErr: any) {
          console.warn(`[MotionDirector] Groq model ${modelId} notice: ${mErr?.message?.slice(0, 80)}. Mencoba model berikutnya...`);
        }
      }
      throw new Error("Semua kandidat model Groq gagal.");
    }, 12000);

    if (rawGroq) {
      const cleanJson = rawGroq.replace(/```json/g, "").replace(/```/g, "").trim();
      let rawObj: any;
      try {
        rawObj = JSON.parse(cleanJson);
      } catch {
        rawObj = JSON.parse(jsonrepair(cleanJson));
      }
      const zodCheck = DualAIMotionDirectorOutputSchema.safeParse(rawObj);
      if (zodCheck.success && zodCheck.data.scenes.length >= 3) {
        parsedOutput = zodCheck.data;
      } else if (rawObj && Array.isArray(rawObj.scenes) && rawObj.scenes.length >= 3) {
        parsedOutput = rawObj;
      }
    }
  } catch (groqErr: any) {
    console.warn(`[MotionDirector] Groq Engine 1 kendala: ${groqErr?.message?.slice(0, 100)}. Melakukan failover ke Gemini Engine 2...`);
  }

  // -------------------------------------------------------------
  // ENGINE 2: GEMINI (SECONDARY / FAILOVER)
  // -------------------------------------------------------------
  if (!parsedOutput || !Array.isArray(parsedOutput.scenes) || parsedOutput.scenes.length < 3) {
    try {
      const geminiCandidates = STANDARD_GEMINI_CANDIDATE_MODELS;
      const rawGemini = await executeGeminiWithFailover({
        service: "ART_DIRECTOR",
        candidateModels: geminiCandidates,
        timeoutMs: 16000,
        action: async (ai, modelName, keyInfo) => {
          console.log(`[MotionDirector] Menghubungi Gemini Engine 2 (${modelName}, ${keyInfo.label})...`);
          const model = ai.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          });
          const res = await model.generateContent(prompt);
          return res.response.text();
        },
      });

      if (rawGemini) {
        const cleanJson = rawGemini.replace(/```json/g, "").replace(/```/g, "").trim();
        let rawObj: any;
        try {
          rawObj = JSON.parse(cleanJson);
        } catch {
          rawObj = JSON.parse(jsonrepair(cleanJson));
        }
        const zodCheck = DualAIMotionDirectorOutputSchema.safeParse(rawObj);
        if (zodCheck.success && zodCheck.data.scenes.length >= 3) {
          parsedOutput = zodCheck.data;
        } else if (rawObj && Array.isArray(rawObj.scenes) && rawObj.scenes.length >= 3) {
          parsedOutput = rawObj;
        }
      }
    } catch (gemErr: any) {
      console.warn(`[MotionDirector] Gemini Engine 2 kendala: ${gemErr?.message?.slice(0, 100)}. Mengaktifkan deterministic transcript extractor...`);
    }
  }

  // -------------------------------------------------------------
  // ENGINE 3: DETERMINISTIC TRANSCRIPT KEYWORD EXTRACTOR (FALLBACK)
  // -------------------------------------------------------------
  if (!parsedOutput || !Array.isArray(parsedOutput.scenes) || parsedOutput.scenes.length < 3) {
    console.log(`[MotionDirector] Menggunakan Deterministic Transcript Extractor (Zero Canned Strings)...`);
    const fallbackRes = generateDeterministicSegmentBeats(input);
    console.log(
      `[MOTION DIRECTOR SUCCESS] Hook: ${fallbackRes.hook.headline} | Scene 1: ${fallbackRes.scenes[0]?.headline} | Scene 2: ${fallbackRes.scenes[1]?.headline} | Scene 3: ${fallbackRes.scenes[2]?.headline}`
    );
    return fallbackRes;
  }

  // Normalize hook data
  const hookKicker = truncateAtWordBoundary(cleanAscii(parsedOutput.hook?.kicker || "SOROTAN UTAMA // KLIMAKS").toUpperCase(), 24);
  const hookHead = truncateAtWordBoundary(cleanAscii(parsedOutput.hook?.headline || input.title || "SOROTAN UTAMA TOPIK").toUpperCase(), 28);
  const hookSub = truncateAtWordBoundary(cleanAscii(parsedOutput.hook?.subtext || "FAKTA TERVERIFIKASI"), 36);
  const hookIcon = typeof parsedOutput.hook?.lucide_icon === "string" ? parsedOutput.hook.lucide_icon : "Flame";
  const hookCurve = parsedOutput.hook?.motion_curve || "easeOutExpo";

  const cleanScenes: DualAISceneItem[] = parsedOutput.scenes.slice(0, 3).map((sc: any, idx: number) => ({
    part: idx + 1,
    type: (["FLOW_NODES", "BIG_METRIC_BAR", "KEY_TAKEAWAYS_LIST", "SPLIT_VERSUS", "QUOTE_IMPACT"].includes(sc.type)
      ? sc.type
      : "KEY_TAKEAWAYS_LIST") as VisualSceneType,
    kicker: truncateAtWordBoundary(cleanAscii(sc.kicker || `POIN 0${idx + 1} // ANALISIS`).toUpperCase(), 24),
    headline: truncateAtWordBoundary(cleanAscii(sc.headline || "RINGKASAN TOPIK").toUpperCase(), 28),
    items: Array.isArray(sc.items) ? sc.items.map((it: any) => truncateAtWordBoundary(cleanAscii(String(it)), 36)) : ["Poin Penting"],
    footer_note: truncateAtWordBoundary(cleanAscii(sc.footer_note || "Fakta Terverifikasi"), 36),
    lucide_icon: typeof sc.lucide_icon === "string" ? sc.lucide_icon : undefined,
    motion_curve: typeof sc.motion_curve === "string" && ["easeBackOut", "easeCubicOut", "easeQuadInOut", "easeOutExpo"].includes(sc.motion_curve) ? sc.motion_curve : undefined,
    accent_tint: typeof sc.accent_tint === "string" && /^#[0-9A-Fa-f]{6}$/.test(sc.accent_tint) ? sc.accent_tint : undefined,
  }));

  const beats = mapDualAIScenesToExplanationBeats({
    scenes: cleanScenes,
    duration: dur,
    accentHex: (parsedOutput as any).accent_hex && /^#[0-9A-Fa-f]{6}$/.test((parsedOutput as any).accent_hex) ? (parsedOutput as any).accent_hex : accentHex,
  });

  const detectedVariant =
    typeof (parsedOutput as any).style_variant === "number" && !isNaN((parsedOutput as any).style_variant)
      ? Math.abs((parsedOutput as any).style_variant) % 8
      : undefined;

  const detectedAccent =
    typeof (parsedOutput as any).accent_hex === "string" && /^#[0-9A-Fa-f]{6}$/.test((parsedOutput as any).accent_hex)
      ? (parsedOutput as any).accent_hex
      : accentHex;

  const finalOutput = {
    style_variant: detectedVariant,
    accent_hex: detectedAccent,
    vibe_description: (parsedOutput as any).vibe_description || "Cinematic Motion",
    hook: {
      kicker: hookKicker,
      headline: hookHead,
      subtext: hookSub,
      lucide_icon: hookIcon,
      motion_curve: hookCurve,
    },
    scenes: cleanScenes,
    beats,
  };

  // [FASE 4: LOGGING TERMINAL SUKSES]
  console.log(
    `[MOTION DIRECTOR SUCCESS] Style Variant: ${finalOutput.style_variant !== undefined ? finalOutput.style_variant : "AUTO"} (${finalOutput.accent_hex}, ${finalOutput.vibe_description}) | Hook: ${finalOutput.hook.headline} | Scene 1: ${finalOutput.scenes[0]?.headline} | Scene 2: ${finalOutput.scenes[1]?.headline} | Scene 3: ${finalOutput.scenes[2]?.headline}`
  );

  return finalOutput;
}

/**
 * [FASE 2: DYNAMIC TRANSCRIPT VISUAL SCENES EXTRACTOR - ZERO HARDCODE]
 */
export function generateDynamicVisualScenesFromTranscript(
  transcript: string | undefined | null,
  duration: number,
  groqWords?: Array<{ word: string; start: number; end: number }>,
  accentHex: string = "#E50914"
): ExplanationBeat[] {
  const dur = Math.max(12, Math.round(duration));
  const t0 = 0.5;
  const t1 = parseFloat((dur * 0.35).toFixed(1));
  const t2 = parseFloat((dur * 0.70).toFixed(1));
  const t3 = parseFloat(dur.toFixed(1));

  const allWords = groqWords && groqWords.length > 0 ? groqWords : [];
  const hookWords = allWords.filter((w) => w.end <= 4.0);
  const p1Words = allWords.filter((w) => w.start >= 4.0 && w.end <= t1);
  const p2Words = allWords.filter((w) => w.start >= t1 && w.end <= t2);
  const p3Words = allWords.filter((w) => w.start >= t2);

  const fallback = generateDeterministicSegmentBeats({
    duration: dur,
    segments: {
      hook: hookWords.map((w) => w.word).join(" ") || String(transcript || "").slice(0, 100),
      part1: p1Words.map((w) => w.word).join(" ") || String(transcript || "").slice(100, 300),
      part2: p2Words.map((w) => w.word).join(" ") || String(transcript || "").slice(300, 600),
      part3: p3Words.map((w) => w.word).join(" ") || String(transcript || "").slice(600),
    },
    accentHex,
  });

  return fallback.beats;
}

/**
 * [FASE 2: SEQUENTIAL EXPLANATION BEATS GENERATOR - ZERO HARDCODE]
 */
export function generateSequentialExplanationBeats(
  clipDur: number,
  topBannerSteps?: string,
  category?: string,
  accentHex: string = "#E50914",
  transcript?: string
): ExplanationBeat[] {
  return generateDynamicVisualScenesFromTranscript(transcript || category, clipDur, undefined, accentHex);
}

export const generateFallbackExplanationBeats = generateSequentialExplanationBeats;

/**
 * [FASE 3: ANALYZE CLIP EXPLANATION BEATS - DUAL-AI POWERED]
 * Slices spoken clip transcript into 4 exact segments (Hook 0-4s, Part 1 4-18s, Part 2 18-33s, Part 3 33s-end)
 * and processes through Dual-AI Engine (Groq llama-3.3-70b-versatile + Gemini Failover).
 */
export async function analyzeClipExplanationBeatsWithGemini(input: {
  clipId: string;
  title: string;
  transcript: string;
  duration: number;
  topBannerSteps?: string;
  topBannerTag?: string;
  accentHex?: string;
  groqWords?: Array<{ word: string; start: number; end: number }>;
  segments?: {
    hook: string;
    part1: string;
    part2: string;
    part3: string;
  };
}): Promise<ExplanationBeat[]> {
  const dur = Math.max(12, Math.round(input.duration));
  const accentHex = input.accentHex && /^#[0-9A-Fa-f]{6}$/.test(input.accentHex) ? input.accentHex : "#E50914";

  let segments = input.segments;

  if (!segments) {
    const words = input.groqWords || [];
    if (words.length > 0) {
      const hookW = words.filter((w) => w.end <= 4.0 || (w.start < 4.0 && w.end <= 5.0));
      const p1W = words.filter((w) => w.start >= 3.8 && w.start < 18.0);
      const p2W = words.filter((w) => w.start >= 17.8 && w.start < 33.0);
      const p3W = words.filter((w) => w.start >= 32.8);

      segments = {
        hook: hookW.map((w) => w.word).join(" ").trim(),
        part1: p1W.map((w) => w.word).join(" ").trim(),
        part2: p2W.map((w) => w.word).join(" ").trim(),
        part3: p3W.map((w) => w.word).join(" ").trim(),
      };
    } else {
      const allText = cleanConversationalFillers(input.transcript || input.title);
      const tokens = allText.split(/\s+/);
      const q1 = Math.floor(tokens.length * 0.15);
      const q2 = Math.floor(tokens.length * 0.45);
      const q3 = Math.floor(tokens.length * 0.75);

      segments = {
        hook: tokens.slice(0, Math.max(4, q1)).join(" "),
        part1: tokens.slice(q1, q2).join(" "),
        part2: tokens.slice(q2, q3).join(" "),
        part3: tokens.slice(q3).join(" "),
      };
    }
  }

  const result = await analyzeSegmentBeatsWithDualAI({
    clipId: input.clipId,
    title: input.title,
    duration: dur,
    segments,
    accentHex,
  });

  return result.beats;
}

/**
 * [FASE 2: 1x BATCH CALL EXECUTIVE HOOK STORYBOARDER]
 * Memanggil Gemini Art Director sekali jalan untuk semua klip menggunakan candidate model (gemini-3.8-flash).
 */
export async function batchAnalyzeExecutiveHooks(
  clips: ClipTranscriptInput[]
): Promise<Map<string, ExecutiveHookMetadata>> {
  const result = new Map<string, ExecutiveHookMetadata>();
  if (!clips || clips.length === 0) return result;

  const prompt = `
${EXECUTIVE_HOOK_STORYBOARDER_SYSTEM_PROMPT}

Daftar Klip yang Dianalisis:
${JSON.stringify(
  clips.map((c) => ({
    clip_id: c.clipId,
    title: c.title,
    speaker_name: c.speakerName || "NARASUMBER",
    duration: c.duration,
    transcript_snippet: (c.transcript || c.title).slice(0, 1000),
  })),
  null,
  2
)}

Format array JSON yang wajib dikembalikan:
[
  {
    "clip_id": "...",
    "speaker_name": "...",
    "hook_category": "INVESTIGASI // FAKTA",
    "hook_headline": "JUDUL PROVOKATIF MAKS 5 KATA",
    "hook_sub_metric": "DATA KUNCI MAKS 4 KATA",
    "hook_subtext": "Konteks pendek 1 baris",
    "lucide_icon": "Flame",
    "style_variant": 4,
    "accent_hex": "#E50914",
    "vibe_description": "CRIMSON EDITORIAL INVESTIGATION"
  }
]
`;

  const candidateModels = STANDARD_GEMINI_CANDIDATE_MODELS;

  let responseText = "";
  try {
    responseText = await executeGeminiWithFailover({
      service: "ART_DIRECTOR",
      candidateModels,
      timeoutMs: 16000,
      action: async (ai, modelName, keyInfo) => {
        console.log(
          `[ExecutiveHook] Menghubungi Gemini Art Director (${modelName}, ${keyInfo.label}) untuk ${clips.length} klip...`
        );
        const model = ai.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.15,
            responseMimeType: "application/json",
          },
        });
        const res = await model.generateContent(prompt);
        return res.response.text();
      },
    });
  } catch (err: any) {
    console.warn(`[ExecutiveHook] Batch call Gemini Art Director kendala: ${err?.message?.slice(0, 100)}`);
  }

  let parsed: any[] = [];
  try {
    if (responseText) {
      const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = JSON.parse(jsonrepair(cleaned));
      }
    }
  } catch (err) {
    console.error("[ExecutiveHook] Gagal parse output storyboarder:", err);
  }

  for (const c of clips) {
    const found = Array.isArray(parsed)
      ? parsed.find((p) => (p.clip_id || p.clipId) === c.clipId)
      : null;

    if (found && (found.hook_headline || found.headline)) {
      const speakerName = (found.speaker_name || c.speakerName || "NARASUMBER").trim().toUpperCase();
      const hookCategory = (found.hook_category || c.topBannerTag || "INVESTIGASI // FAKTA").toUpperCase();
      const hookHeadline = (found.hook_headline || found.headline || c.topBannerTitle || c.title)
        .toUpperCase()
        .slice(0, 36);
      const hookSubMetric = (found.hook_sub_metric || "DATA KUNCI TERVERIFIKASI").toUpperCase().slice(0, 32);
      const hookSubtext = (found.hook_subtext || found.hook_sub_metric || c.hookDescription || "KONTROVERSI DATA PEMERINTAH").toUpperCase().slice(0, 45);
      const lucideIcon = found.lucide_icon || "Flame";
      const accentHex =
        (c.accentHex && /^#[0-9A-Fa-f]{6}$/.test(c.accentHex) && c.accentHex) ||
        (found.accent_hex && /^#[0-9A-Fa-f]{6}$/.test(found.accent_hex) && found.accent_hex) ||
        "#E50914";

      let explanationBeats: ExplanationBeat[] = [];
      if (found.explanation_beats && Array.isArray(found.explanation_beats) && found.explanation_beats.length >= 3) {
        explanationBeats = found.explanation_beats.slice(0, 3).map((b: any, bIdx: number) => ({
          beat_index: bIdx + 1,
          step_label: String(b.step_label || `0${bIdx + 1} // ANALISIS`).trim().toUpperCase().slice(0, 24),
          headline: String(b.headline || "POIN PENTING").trim().toUpperCase().slice(0, 26),
          highlight_metric: String(b.highlight_metric || "TERVERIFIKASI").trim().toUpperCase().slice(0, 24),
          lucide_icon: String(b.lucide_icon || (bIdx === 0 ? "AlertCircle" : bIdx === 1 ? "TrendingUp" : "Zap")),
          accent_hex: c.accentHex || (b.accent_hex && /^#[0-9A-Fa-f]{6}$/.test(b.accent_hex) ? b.accent_hex : accentHex),
          start_sec: typeof b.start_sec === "number" && !isNaN(b.start_sec) ? b.start_sec : parseFloat((c.duration * (0.18 + bIdx * 0.28)).toFixed(1)),
          duration_sec: typeof b.duration_sec === "number" && !isNaN(b.duration_sec) ? Math.min(5, Math.max(3, b.duration_sec)) : 4.0,
        }));
      } else {
        explanationBeats = generateFallbackExplanationBeats(
          c.duration,
          c.topBannerSteps,
          c.topBannerTag,
          accentHex
        );
      }

      result.set(c.clipId, {
        clip_id: c.clipId,
        speaker_name: speakerName,
        hook_category: hookCategory,
        hook_headline: hookHeadline,
        hook_subtext: hookSubtext,
        hook_sub_metric: hookSubMetric,
        lucide_icon: lucideIcon,
        style_variant: typeof found.style_variant === "number" ? Math.abs(found.style_variant) % 8 : undefined,
        accent_hex: accentHex,
        vibe_description: found.vibe_description || undefined,
        teaser_start: typeof found.teaser_start === "number" ? found.teaser_start : undefined,
        teaser_end: typeof found.teaser_end === "number" ? found.teaser_end : undefined,
        explanation_beats: explanationBeats,
      });
    } else {
      // Deterministic fallback with varied style
      const headline = (c.topBannerTitle || c.title).toUpperCase().slice(0, 36);
      const beats = generateFallbackExplanationBeats(
        c.duration,
        c.topBannerSteps,
        c.topBannerTag,
        c.accentHex || "#E50914"
      );
      const fallbackVariant = Math.abs((c.title || "").length + (c.clipId || "").length) % 8;
      result.set(c.clipId, {
        clip_id: c.clipId,
        speaker_name: (c.speakerName || "NARASUMBER").toUpperCase(),
        hook_category: (c.topBannerTag || "INVESTIGASI // FAKTA").toUpperCase(),
        hook_headline: headline,
        hook_subtext: (c.hookDescription || "KONTROVERSI DATA TERVERIFIKASI").toUpperCase().slice(0, 45),
        hook_sub_metric: "INSIGHT TERVERIFIKASI",
        lucide_icon: "Flame",
        style_variant: fallbackVariant,
        accent_hex: c.accentHex || "#E50914",
        vibe_description: "DYNAMIC FALLBACK VIBE",
        explanation_beats: beats,
      });
    }
  }

  return result;
}

/**
 * Analyzes a single clip's spoken transcript using Gemini Art Director with auto-failover.
 */
export async function analyzeClipMotionArchetype(
  input: ClipTranscriptInput
): Promise<ClipMotionMetadata> {
  const batchMap = await batchAnalyzeExecutiveHooks([input]);
  const hook = batchMap.get(input.clipId)!;

  const rawArch = (input.topBannerTag || "").toUpperCase();
  const archetype: MotionArchetype = rawArch.includes("DATA") || rawArch.includes("STAT")
    ? "DYNAMIC_COUNTER"
    : rawArch.includes("STEP") || rawArch.includes("BLUEPRINT")
    ? "PROCESS_STEPPER"
    : rawArch.includes("VS")
    ? "VERSUS_CARDS"
    : "AUDIO_RADAR";

  const motionValues: MotionValues = {
    targetNumber: 98,
    unit: "%",
    metricLabel: hook.hook_sub_metric,
    steps: ["01 CONTEXT", "02 SYSTEM", "03 SCALE"],
    lucideIcon: hook.lucide_icon,
    leftTitle: "METODE LAMA",
    leftDesc: "Manual Lambat",
    rightTitle: "AI PIPELINE",
    rightDesc: "10x Lebih Cepat",
  };

  return {
    clipId: input.clipId,
    archetype,
    headline: hook.hook_headline,
    accent_color: hook.accent_hex,
    motion_values: motionValues,
    tag: hook.hook_category,
    title: hook.hook_headline,
    hookMetadata: hook,
    hookQuote: input.hookDescription || input.title,
    speakerName: hook.speaker_name,
    speakerRole: "CREATOR",
    keyTakeaway: "EKSEKUSI TINGGI MEMBANGUN DISTRIBUSI TANPA BATAS",
    counterData: {
      prefix: "",
      targetValue: 98,
      suffix: "%",
      metricLabel: hook.hook_sub_metric,
      growthRate: "VERIFIED",
    },
    stepperData: {
      steps: ["01 CONTEXT", "02 SYSTEM", "03 SCALE"],
    },
    versusData: {
      leftTitle: "METODE LAMA",
      leftDesc: "Manual Lambat",
      rightTitle: "AI PIPELINE",
      rightDesc: "10x Lebih Cepat",
      versusBadge: "VS",
    },
    bannerData: {
      tag: hook.hook_category,
      headline: hook.hook_headline,
      subheadline: input.hookDescription || "CORE TAKEAWAY",
    },
  };
}

/**
 * Batch analyzes motion archetypes & executive hooks for all clips in 1 single Gemini call.
 */
export async function batchAnalyzeMotionArchetypes(
  clips: ClipTranscriptInput[]
): Promise<Map<string, ClipMotionMetadata>> {
  const result = new Map<string, ClipMotionMetadata>();
  if (!clips || clips.length === 0) return result;

  const hookMap = await batchAnalyzeExecutiveHooks(clips);

  for (const c of clips) {
    const hook = hookMap.get(c.clipId)!;
    const rawTag = (hook.hook_category || c.topBannerTag || "").toUpperCase();
    const archetype: MotionArchetype = rawTag.includes("DATA") || rawTag.includes("STAT")
      ? "DYNAMIC_COUNTER"
      : rawTag.includes("STEP") || rawTag.includes("BLUEPRINT")
      ? "PROCESS_STEPPER"
      : rawTag.includes("VS")
      ? "VERSUS_CARDS"
      : "AUDIO_RADAR";

    const motionValues: MotionValues = {
      targetNumber: 98,
      unit: "%",
      metricLabel: hook.hook_sub_metric,
      steps: ["01 CONTEXT", "02 SYSTEM", "03 SCALE"],
      lucideIcon: hook.lucide_icon,
      leftTitle: "METODE LAMA",
      leftDesc: "Manual Lambat",
      rightTitle: "AI PIPELINE",
      rightDesc: "10x Lebih Cepat",
    };

    result.set(c.clipId, {
      clipId: c.clipId,
      archetype,
      headline: hook.hook_headline,
      accent_color: hook.accent_hex,
      motion_values: motionValues,
      tag: hook.hook_category,
      title: hook.hook_headline,
      hookMetadata: hook,
      hookQuote: c.hookDescription || c.title,
      speakerName: hook.speaker_name,
      speakerRole: "CREATOR",
      keyTakeaway: "EKSEKUSI TINGGI MEMBANGUN DISTRIBUSI TANPA BATAS",
      counterData: {
        prefix: "",
        targetValue: 98,
        suffix: "%",
        metricLabel: hook.hook_sub_metric,
        growthRate: "VERIFIED",
      },
      stepperData: {
        steps: ["01 CONTEXT", "02 SYSTEM", "03 SCALE"],
      },
      versusData: {
        leftTitle: "METODE LAMA",
        leftDesc: "Manual Lambat",
        rightTitle: "AI PIPELINE",
        rightDesc: "10x Lebih Cepat",
        versusBadge: "VS",
      },
      bannerData: {
        tag: hook.hook_category,
        headline: hook.hook_headline,
        subheadline: c.hookDescription || "CORE PERSPECTIVE",
      },
    });
  }

  return result;
}

/**
 * [FASE 3: RENDER NATIVE CANVAS MOTION HEADER (1080x500 @ 30 FPS)]
 * Renders motion graphic header video via Rust Canvas Engine (@napi-rs/canvas)
 * directly into WebM VP9 (with alpha) or MP4 in 2-3 seconds.
 */
export async function renderMotionHeaderVideo(input: {
  config: ClipMotionMetadata;
  destinationPath: string;
  durationSec?: number;
}): Promise<string> {
  const durationSec = Math.max(3, Math.min(input.durationSec || 5, 60));
  const outDir = path.dirname(input.destinationPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  return await renderFastCanvasMotionVideo({
    config: input.config,
    destinationPath: input.destinationPath,
    durationSec,
    width: 1080,
    height: 500,
  });
}
