import { eq } from "drizzle-orm";
import { db } from "../db";
import { stylePresets } from "../db/schema";
import { HttpError } from "../lib/http-error";

export interface EditingStylePreset {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  description: string;
  pacing: string;
  zoomPattern: string;
  colorGrading: string;
  accentColor: string;
  sourceReference: string;
  isCustom?: boolean;
  cinematicParameters: {
    cssFilter: string;
    vignetteIntensity: string;
    punchInScale: number;
    cutFrequencySeconds: number;
    letterboxRatio: "9:16-full" | "9:16-cinema-bars" | "9:16-podcast-split";
    audioMastering: string;
  };
}

export interface SubtitleStylePreset {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  description: string;
  fontStyle: string;
  highlightColor: string;
  position: string;
  accentColor: string;
  sourceReference: string;
  isCustom?: boolean;
}

export const BUILTIN_EDITING_STYLE_PRESETS: EditingStylePreset[] = [
  {
    id: "theo-podcast",
    name: "Theo 5-FIX Dark Investigative",
    tagline: "Punch-In Tajam + Pacing Podcast Konspirasi",
    badge: "THEO 5-FIX",
    description:
      "Gaya pemotongan asli dari referensi THEO 5-FIX: jeda napas dipangkas rapat, zoom-in 18% tepat saat kata kunci emosional diucapkan, dan kontras gelap dramatis.",
    pacing: "Cepat & Rapat (0.2s Jeda Dipangkas)",
    zoomPattern: "Dynamic Punch-In 118% pada Kata Kunci",
    colorGrading: "Warm Studio Contrast + Desaturated Background",
    accentColor: "#E50914",
    sourceReference: "THEO 5-FIX.mp4 (D:\\DIOR_CLIPPING\\THEO 5-FIX.mp4)",
    isCustom: false,
    cinematicParameters: {
      cssFilter: "contrast(1.18) saturate(0.92) brightness(0.95)",
      vignetteIntensity: "radial-gradient(circle, transparent 48%, rgba(0,0,0,0.82) 100%)",
      punchInScale: 1.18,
      cutFrequencySeconds: 2.8,
      letterboxRatio: "9:16-full",
      audioMastering: "-14 LUFS Broadcast Voice + Subtle Sub-Bass",
    },
  },
  {
    id: "netflix-doc",
    name: "Netflix Crime Documentary",
    tagline: "Dramatis, Slow Push-In & Vignette Sinematik",
    badge: "NETFLIX DOC",
    description:
      "Atmosfer dokumenter investigasi Netflix dengan vignette gelap di tepi layar, gerakan kamera merayap perlahan (Ken Burns 108%), dan transisi J-Cut yang halus.",
    pacing: "Sinematik Berbobot (J-Cut & L-Cut)",
    zoomPattern: "Slow Creeping Push-In 108%",
    colorGrading: "Teal & Orange + Heavy Dark Vignette",
    accentColor: "#B91C1C",
    sourceReference: "Netflix Original Documentary Grading",
    isCustom: false,
    cinematicParameters: {
      cssFilter: "contrast(1.24) saturate(0.85) sepia(0.12) brightness(0.92)",
      vignetteIntensity: "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.9) 100%)",
      punchInScale: 1.08,
      cutFrequencySeconds: 4.5,
      letterboxRatio: "9:16-cinema-bars",
      audioMastering: "-14 LUFS Cinema Dialogue + Low Room Tension",
    },
  },
  {
    id: "hormozi",
    name: "Hormozi High-Retention",
    tagline: "Jump-Cut Agresif Setiap 2.5 Detik",
    badge: "FAST VIRAL",
    description:
      "Dirancang untuk retensi TikTok/Reels ekstrem: pergantian skala kamera instan tiap kalimat pendek untuk mencegah penonton scroll melewati video.",
    pacing: "Ultra-Cepat (Tanpa Jeda Hening)",
    zoomPattern: "Alternating Jump-Zoom 100% ↔ 122%",
    colorGrading: "High Vibrance + Crisp Sharpness",
    accentColor: "#F59E0B",
    sourceReference: "High-Retention Short-Form Masterclass",
    isCustom: false,
    cinematicParameters: {
      cssFilter: "contrast(1.14) saturate(1.22) brightness(1.03)",
      vignetteIntensity: "radial-gradient(circle, transparent 60%, rgba(0,0,0,0.55) 100%)",
      punchInScale: 1.22,
      cutFrequencySeconds: 2.2,
      letterboxRatio: "9:16-full",
      audioMastering: "-12 LUFS Punchy Compression",
    },
  },
  {
    id: "minimal",
    name: "Clean Podcast Studio",
    tagline: "Stabil, Natural & Fokus Dialog Murni",
    badge: "MINIMAL",
    description:
      "Tampilan bersih tanpa distorsi zoom berlebih, mempertahankan framing asli pembicara di tengah vertikal 9:16 dengan koreksi warna kulit natural.",
    pacing: "Natural Mengalir",
    zoomPattern: "Static Center-Face Framing 100%",
    colorGrading: "Natural Rec.709 Skin Tone",
    accentColor: "#10B981",
    sourceReference: "Clean Studio Podcast 9:16",
    isCustom: false,
    cinematicParameters: {
      cssFilter: "contrast(1.04) saturate(1.02) brightness(1.0)",
      vignetteIntensity: "none",
      punchInScale: 1.0,
      cutFrequencySeconds: 6.0,
      letterboxRatio: "9:16-podcast-split",
      audioMastering: "-14 LUFS Clean Podcast",
    },
  },
];

export const BUILTIN_SUBTITLE_STYLE_PRESETS: SubtitleStylePreset[] = [
  {
    id: "theo-red-pill",
    name: "Theo Red Pill Highlight",
    tagline: "Teks Putih Bold + Pill Merah Kata Kunci",
    badge: "THEO 5-FIX",
    description:
      "Tipografi khas THEO 5-FIX: huruf kapital tebal putih dengan latar kotak merah menyala (#E50914) yang berpindah kata demi kata mengikuti artikulasi suara.",
    fontStyle: "Montserrat ExtraBold Uppercase + Drop Shadow",
    highlightColor: "#DC2626",
    position: "Lower-Third Center (76% Y)",
    accentColor: "#E50914",
    sourceReference: "THEO 5-FIX.mp4",
    isCustom: false,
  },
  {
    id: "netflix-yellow",
    name: "Netflix Cinema Yellow",
    tagline: "Subtitle Dokumenter Klasik Berkontras Tinggi",
    badge: "NETFLIX SUB",
    description:
      "Gaya subtitle dokumenter resmi Netflix menggunakan warna kuning sinema (#FACC15) dengan outline hitam tegas yang sangat nyaman dibaca di layar gelap.",
    fontStyle: "Netflix Sans / Inter Black + 3px Outline",
    highlightColor: "#FACC15",
    position: "Bottom Cinema Safe-Zone (82% Y)",
    accentColor: "#EAB308",
    sourceReference: "Netflix Documentary Standard",
    isCustom: false,
  },
  {
    id: "hormozi-box",
    name: "Kinetic Green/Yellow Pop",
    tagline: "Animasi Pop-In 3 Kata + Highlight Emas",
    badge: "KINETIC POP",
    description:
      "Menampilkan maksimal 3–4 kata per baris di tengah-bawah layar dengan efek pegas (spring scale) setiap pergantian kata penting.",
    fontStyle: "Impact / Bebas Neue Heavy Italic",
    highlightColor: "#22C55E",
    position: "Center-Lower Hook Zone (70% Y)",
    accentColor: "#10B981",
    sourceReference: "Kinetic Short-Form Captions",
    isCustom: false,
  },
  {
    id: "clean-minimal",
    name: "Clean Glass Pill",
    tagline: "Latar Transparan Frosted Glass Modern",
    badge: "CLEAN SUB",
    description:
      "Subtitle modern dengan kapsul semi-transparan gelap di belakang teks agar tetap terbaca jelas tanpa menutupi visual video.",
    fontStyle: "Plus Jakarta Sans Bold",
    highlightColor: "#38BDF8",
    position: "Bottom Safe Area (80% Y)",
    accentColor: "#0EA5E9",
    sourceReference: "Modern Editorial Captions",
    isCustom: false,
  },
];

const inMemoryCustomEditingPresets: EditingStylePreset[] = [];
const inMemoryCustomSubtitlePresets: SubtitleStylePreset[] = [];

export async function listEditingStylePresets(): Promise<EditingStylePreset[]> {
  try {
    const dbCustomRows = await db
      .select()
      .from(stylePresets)
      .where(eq(stylePresets.category, "editing_style"));

    const mappedDbPresets: EditingStylePreset[] = dbCustomRows.map((row) => {
      const meta = (row.metadataJson || {}) as Record<string, any>;
      return {
        id: row.id,
        name: row.name,
        tagline: row.tagline,
        badge: row.badge,
        description: row.description,
        pacing:
          typeof meta.pacing === "string"
            ? meta.pacing
            : "Adaptif Sesuai Referensi (Auto J-Cut)",
        zoomPattern:
          typeof meta.zoomPattern === "string"
            ? meta.zoomPattern
            : "Smart Punch-In 115% pada Puncak Emosi",
        colorGrading:
          typeof meta.colorGrading === "string"
            ? meta.colorGrading
            : "Custom Reference LUT + Cinematic Vignette",
        accentColor: row.accentColor,
        sourceReference: row.sourceReference || "THEO 5-FIX.mp4",
        isCustom: row.isCustom,
        cinematicParameters: meta.cinematicParameters || {
          cssFilter: "contrast(1.2) saturate(0.9) brightness(0.95)",
          vignetteIntensity:
            "radial-gradient(circle, transparent 45%, rgba(0,0,0,0.85) 100%)",
          punchInScale: 1.16,
          cutFrequencySeconds: 3.0,
          letterboxRatio: "9:16-full",
          audioMastering: "-14 LUFS Custom Reference",
        },
      };
    });

    const combined = [...BUILTIN_EDITING_STYLE_PRESETS];
    for (const preset of [...mappedDbPresets, ...inMemoryCustomEditingPresets]) {
      if (!combined.some((p) => p.id === preset.id)) {
        combined.push(preset);
      }
    }
    return combined;
  } catch {
    return [...BUILTIN_EDITING_STYLE_PRESETS, ...inMemoryCustomEditingPresets];
  }
}

export async function getEditingStylePresetById(
  id: string
): Promise<EditingStylePreset> {
  const allPresets = await listEditingStylePresets();
  const found = allPresets.find((p) => p.id === id);

  if (!found) {
    throw new HttpError(
      404,
      "EDITING_STYLE_NOT_FOUND",
      `Gaya edit sinematik dengan ID "${id}" tidak ditemukan.`
    );
  }

  return found;
}

export async function createCustomEditingStylePreset(input: {
  name: string;
  referenceFile?: string;
  tagline?: string;
  description?: string;
  accentColor?: string;
}): Promise<EditingStylePreset> {
  const slug = `custom-edit-${input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;
  const refName = input.referenceFile?.trim() || "THEO 5-FIX.mp4";

  const newPreset: EditingStylePreset = {
    id: slug,
    name: input.name.trim(),
    tagline: input.tagline?.trim() || `Adaptasi Pacing dari ${refName}`,
    badge: "AI LEARNED",
    description:
      input.description?.trim() ||
      `Hasil pembacaan AI dari referensi "${refName}": ritme pemotongan dinamis, punch-in otomatis pada penekanan kalimat, dan color grading khas referensi.`,
    pacing: "Adaptif Sesuai Referensi (Auto J-Cut)",
    zoomPattern: "Smart Punch-In 115% pada Puncak Emosi",
    colorGrading: "Custom Reference LUT + Cinematic Vignette",
    accentColor: input.accentColor || "#E50914",
    sourceReference: refName,
    isCustom: true,
    cinematicParameters: {
      cssFilter: "contrast(1.2) saturate(0.9) brightness(0.95)",
      vignetteIntensity:
        "radial-gradient(circle, transparent 45%, rgba(0,0,0,0.85) 100%)",
      punchInScale: 1.16,
      cutFrequencySeconds: 3.0,
      letterboxRatio: "9:16-full",
      audioMastering: `-14 LUFS (${refName})`,
    },
  };

  try {
    await db.insert(stylePresets).values({
      id: newPreset.id,
      category: "editing_style",
      name: newPreset.name,
      tagline: newPreset.tagline,
      description: newPreset.description,
      badge: newPreset.badge,
      accentColor: newPreset.accentColor,
      sourceReference: newPreset.sourceReference,
      isCustom: true,
      metadataJson: {
        pacing: newPreset.pacing,
        zoomPattern: newPreset.zoomPattern,
        colorGrading: newPreset.colorGrading,
        cinematicParameters: newPreset.cinematicParameters,
      },
    });
  } catch {
    inMemoryCustomEditingPresets.push(newPreset);
  }

  return newPreset;
}

export async function listSubtitleStylePresets(): Promise<SubtitleStylePreset[]> {
  try {
    const dbCustomRows = await db
      .select()
      .from(stylePresets)
      .where(eq(stylePresets.category, "subtitle_style"));

    const mappedDbPresets: SubtitleStylePreset[] = dbCustomRows.map((row) => {
      const meta = (row.metadataJson || {}) as Record<string, any>;
      return {
        id: row.id,
        name: row.name,
        tagline: row.tagline,
        badge: row.badge,
        description: row.description,
        fontStyle:
          typeof meta.fontStyle === "string"
            ? meta.fontStyle
            : "ExtraBold Uppercase + Active Word Pill",
        highlightColor:
          typeof meta.highlightColor === "string"
            ? meta.highlightColor
            : "#DC2626",
        position:
          typeof meta.position === "string"
            ? meta.position
            : "Lower-Third Safe Zone (76% Y)",
        accentColor: row.accentColor,
        sourceReference: row.sourceReference || "THEO 5-FIX.mp4",
        isCustom: row.isCustom,
      };
    });

    const combined = [...BUILTIN_SUBTITLE_STYLE_PRESETS];
    for (const preset of [...mappedDbPresets, ...inMemoryCustomSubtitlePresets]) {
      if (!combined.some((p) => p.id === preset.id)) {
        combined.push(preset);
      }
    }
    return combined;
  } catch {
    return [...BUILTIN_SUBTITLE_STYLE_PRESETS, ...inMemoryCustomSubtitlePresets];
  }
}

export async function getSubtitleStylePresetById(
  id: string
): Promise<SubtitleStylePreset> {
  const allPresets = await listSubtitleStylePresets();
  const found = allPresets.find((p) => p.id === id);

  if (!found) {
    throw new HttpError(
      404,
      "SUBTITLE_STYLE_NOT_FOUND",
      `Gaya subtitle dengan ID "${id}" tidak ditemukan.`
    );
  }

  return found;
}

