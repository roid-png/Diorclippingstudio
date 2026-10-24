import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { stylePresets } from "../db/schema";
import { HttpError } from "../lib/http-error";

export interface MotionGraphicPreset {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  description: string;
  overlayLabel: string;
  sfxProfile: string;
  accentColor: string;
  sourceReference: string;
  isCustom?: boolean;
  previewSimulation: {
    hudPosition: "top-left" | "top-right" | "bottom-split" | "none";
    animationStyle: "spring-pop" | "glitch-scan" | "slide-split" | "none";
    sampleMetricBadge: string;
    sampleHudCode: string;
    timelineKeyframes: Array<{
      second: number;
      event: string;
      visualOverlay: string;
      sfxCue: string;
    }>;
  };
}

export const BUILTIN_MOTION_GRAPHIC_PRESETS: MotionGraphicPreset[] = [
  {
    id: "theo-infographics",
    name: "Theo 5-FIX Infographics",
    tagline: "Pop-Up Kartu Data, Bukti & Angka",
    badge: "THEO 5-FIX",
    description:
      "Munculkan kartu statistik merah/emas, badge persentase pajak, panah korelasi, dan kutipan bukti secara dinamis mengikuti kata kunci pembicara.",
    overlayLabel: "DATA BUKTI: PAJAK 50% • AUDIT",
    sfxProfile: "Paper Rustle + Subtle Bass Thud + Typewriter Tick",
    accentColor: "#E50914",
    sourceReference: "THEO 5-FIX.mp4 (Investigative Data Pop-Up)",
    isCustom: false,
    previewSimulation: {
      hudPosition: "top-left",
      animationStyle: "spring-pop",
      sampleMetricBadge: "+84% KEBOCORAN ANGGARAN",
      sampleHudCode: "DATA-VERIFY // THEO-5-FIX",
      timelineKeyframes: [
        {
          second: 1.2,
          event: "Pemicu Kata Kunci Angka",
          visualOverlay: "Pop-up Kartu Statistik Merah (#E50914)",
          sfxCue: "Bass Thud + Paper Flip",
        },
        {
          second: 5.5,
          event: "Kutipan Bukti Dokumen",
          visualOverlay: "Highlight Box + Panah Korelasi",
          sfxCue: "Typewriter Tick",
        },
        {
          second: 11.0,
          event: "Puncak Retensi Narasumber",
          visualOverlay: "Badge Persentase Pajak & Indikator Risiko",
          sfxCue: "Cinematic Sub-Drop",
        },
      ],
    },
  },
  {
    id: "netflix-hud",
    name: "Netflix Evidence HUD",
    tagline: "Lower-Third & Timestamp Investigasi",
    badge: "NETFLIX HUD",
    description:
      "Elemen HUD sinematik ala dokumenter kriminal: penanda waktu REC, klasifikasi dokumen rahasia, dan indikator gelombang suara (audio waveform).",
    overlayLabel: "CLASSIFIED // DOC-092 • REC",
    sfxProfile: "Digital Telemetry Beep + Low Drone + Camera Shutter",
    accentColor: "#F59E0B",
    sourceReference: "Netflix Crime & Financial Documentary",
    isCustom: false,
    previewSimulation: {
      hudPosition: "top-right",
      animationStyle: "glitch-scan",
      sampleMetricBadge: "CLASSIFIED // EVIDENCE #092",
      sampleHudCode: "REC 00:08:14:22 • AUDIO TRACKED",
      timelineKeyframes: [
        {
          second: 0.5,
          event: "Pembukaan Segmen",
          visualOverlay: "Frame REC + Timestamp Dokumenter",
          sfxCue: "Telemetry Beep",
        },
        {
          second: 4.8,
          event: "Identifikasi Pembicara",
          visualOverlay: "Lower-Third Klasifikasi Narasumber",
          sfxCue: "Camera Shutter",
        },
        {
          second: 9.4,
          event: "Penekanan Bukti",
          visualOverlay: "Audio Waveform + Stamp CLASSIFIED",
          sfxCue: "Low Sub-Drone",
        },
      ],
    },
  },
  {
    id: "dynamic-broll",
    name: "Dynamic Split & Emoji Callout",
    tagline: "Callout Visual Cepat + Transisi Kilat",
    badge: "VIRAL CALLOUT",
    description:
      "Menampilkan badge reaksi kontekstual, progress bar retensi di bagian atas layar, dan frame split-screen otomatis saat contoh disebutkan.",
    overlayLabel: "⚡ PEAK HOOK • 99% RETENTION",
    sfxProfile: "Fast Whoosh + Pop Ding + Riser",
    accentColor: "#10B981",
    sourceReference: "Short-Form High-Retention Callouts",
    isCustom: false,
    previewSimulation: {
      hudPosition: "bottom-split",
      animationStyle: "slide-split",
      sampleMetricBadge: "⚡ 99% RETENTION HOOK",
      sampleHudCode: "SPLIT-VIEW // ACTIVE",
      timelineKeyframes: [
        {
          second: 0.0,
          event: "Hook 3 Detik Pertama",
          visualOverlay: "Progress Bar Retensi + Callout Badge",
          sfxCue: "Fast Whoosh",
        },
        {
          second: 6.0,
          event: "Penyebutan Studi Kasus",
          visualOverlay: "Split-Screen Visual B-Roll",
          sfxCue: "Pop Ding",
        },
      ],
    },
  },
  {
    id: "none",
    name: "Clean Tanpa Motion Overlay",
    tagline: "Fokus Murni pada Video & Subtitle",
    badge: "CLEAN",
    description:
      "Menonaktifkan seluruh layer motion graphic tambahan agar fokus penonton 100% tertuju pada ekspresi pembicara dan teks subtitle.",
    overlayLabel: "CLEAN MODE",
    sfxProfile: "Natural Studio Audio Only",
    accentColor: "#71717A",
    sourceReference: "Clean Raw Cut",
    isCustom: false,
    previewSimulation: {
      hudPosition: "none",
      animationStyle: "none",
      sampleMetricBadge: "CLEAN VIEW",
      sampleHudCode: "NO OVERLAY",
      timelineKeyframes: [],
    },
  },
];

const inMemoryCustomMotionPresets: MotionGraphicPreset[] = [];

export async function listMotionGraphicPresets(): Promise<MotionGraphicPreset[]> {
  try {
    const dbCustomRows = await db
      .select()
      .from(stylePresets)
      .where(eq(stylePresets.category, "motion_graphic"));

    const mappedDbPresets: MotionGraphicPreset[] = dbCustomRows.map((row) => {
      const meta = (row.metadataJson || {}) as Record<string, any>;
      return {
        id: row.id,
        name: row.name,
        tagline: row.tagline,
        badge: row.badge,
        description: row.description,
        overlayLabel:
          typeof meta.overlayLabel === "string"
            ? meta.overlayLabel
            : `PRESET // ${row.name.toUpperCase()}`,
        sfxProfile:
          typeof meta.sfxProfile === "string"
            ? meta.sfxProfile
            : "Whoosh + Cinematic Hit + Sub-Bass",
        accentColor: row.accentColor,
        sourceReference: row.sourceReference || "Custom Reference Folder",
        isCustom: row.isCustom,
        previewSimulation: meta.previewSimulation || {
          hudPosition: "top-left",
          animationStyle: "spring-pop",
          sampleMetricBadge: row.badge,
          sampleHudCode: `CUSTOM // ${row.id.toUpperCase()}`,
          timelineKeyframes: [
            {
              second: 1.5,
              event: "Custom Motion Trigger",
              visualOverlay: row.tagline,
              sfxCue: "Whoosh + Hit",
            },
          ],
        },
      };
    });

    const combined = [...BUILTIN_MOTION_GRAPHIC_PRESETS];
    for (const preset of [...mappedDbPresets, ...inMemoryCustomMotionPresets]) {
      if (!combined.some((p) => p.id === preset.id)) {
        combined.push(preset);
      }
    }
    return combined;
  } catch {
    // Graceful fallback when DB is offline in local dev
    return [...BUILTIN_MOTION_GRAPHIC_PRESETS, ...inMemoryCustomMotionPresets];
  }
}

export async function getMotionGraphicPresetById(
  id: string
): Promise<MotionGraphicPreset> {
  const allPresets = await listMotionGraphicPresets();
  const found = allPresets.find((p) => p.id === id);

  if (!found) {
    throw new HttpError(
      404,
      "MOTION_GRAPHIC_NOT_FOUND",
      `Gaya motion graphic dengan ID "${id}" tidak ditemukan.`
    );
  }

  return found;
}

export async function createCustomMotionGraphicPreset(input: {
  name: string;
  referenceFile?: string;
  tagline?: string;
  description?: string;
  accentColor?: string;
}): Promise<MotionGraphicPreset> {
  const slug = `custom-motion-${input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;
  const refName = input.referenceFile?.trim() || "THEO 5-FIX.mp4";

  const newPreset: MotionGraphicPreset = {
    id: slug,
    name: input.name.trim(),
    tagline:
      input.tagline?.trim() || `Adaptasi Motion dari ${refName}`,
    badge: "AI LEARNED",
    description:
      input.description?.trim() ||
      `Hasil ekstraksi pola motion graphic dari referensi "${refName}": pop-up kartu data otomatis, lower-third kontekstual, dan efek suara transisi.`,
    overlayLabel: `REF: ${input.name.trim().toUpperCase()} • HUD`,
    sfxProfile: "Whoosh + Paper Flip + Deep Hit (Extracted)",
    accentColor: input.accentColor || "#F59E0B",
    sourceReference: refName,
    isCustom: true,
    previewSimulation: {
      hudPosition: "top-left",
      animationStyle: "spring-pop",
      sampleMetricBadge: `REF // ${input.name.trim().toUpperCase()}`,
      sampleHudCode: `SOURCE: ${refName}`,
      timelineKeyframes: [
        {
          second: 1.0,
          event: "Deteksi Kata Kunci Utama",
          visualOverlay: `Pop-Up HUD (${input.name.trim()})`,
          sfxCue: "Extracted Whoosh + Hit",
        },
      ],
    },
  };

  try {
    await db.insert(stylePresets).values({
      id: newPreset.id,
      category: "motion_graphic",
      name: newPreset.name,
      tagline: newPreset.tagline,
      description: newPreset.description,
      badge: newPreset.badge,
      accentColor: newPreset.accentColor,
      sourceReference: newPreset.sourceReference,
      isCustom: true,
      metadataJson: {
        overlayLabel: newPreset.overlayLabel,
        sfxProfile: newPreset.sfxProfile,
        previewSimulation: newPreset.previewSimulation,
      },
    });
  } catch {
    inMemoryCustomMotionPresets.push(newPreset);
  }

  return newPreset;
}

