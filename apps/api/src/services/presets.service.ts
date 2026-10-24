import fs from "node:fs";
import path from "node:path";
import { HttpError } from "../lib/http-error";

export interface PresetSubtitleStyle {
  fontName: string;
  fontSize: number;
  primaryColor: string;
  highlightColor: string;
  outlineColor: string;
  outlineWidth: number;
  alignment: number;
  marginV: number;
  bold: boolean;
  animation?: string;
  bounceScale?: number;
  showSpeakerTag?: boolean; // Default FALSE: HANYA subtitle bersih, tanpa pill narasumber/host
}

export interface PresetMotionGraphic {
  progressBar: boolean;
  punchZoom: boolean;
  punchZoomScale?: number;
}

export type LayoutArchitecture =
  | "IN_SCENE_KINETIC_CLIPPER"
  | "TOP_INFOGRAPHIC_PODCAST"
  | "FULL_VERTICAL_CROP";

export type SubtitleBehavior =
  | "SINGLE_WORD_POP"
  | "PHRASE_HIGHLIGHT_BOX"
  | "CLEAN_CINEMATIC_LINE"
  | "DUAL_COLOR_DYNAMIC";

export type HookTypographyStyle =
  | "GLOWING_STACKED_IMPACT"
  | "EDITORIAL_SERIF_BANNER";

export interface VideoPreset {
  id: string;
  name: string;
  description: string;
  format: string;
  width: number;
  height: number;
  colorGrading: string;
  transition: string;
  subtitleStyle: PresetSubtitleStyle;
  motionGraphic: PresetMotionGraphic;
  pipelineMode?: "netflix_editorial" | "clean_subtitles" | "raw_cut" | "clone_only" | string;
  accentColor?: string;
  enableHook?: boolean;
  enableTopMotion?: boolean;
  enablePolish?: boolean;
  badge?: string;
  isCustom?: boolean;
  isCloned?: boolean;
  isUniversalClone?: boolean;
  isHolistic?: boolean;
  holistic_dna?: any;
  blueprint?: any;
  createdAt?: string;

  // Polymorphic Style Engine & Clone Adaptation (Fase 1-5)
  layoutArchitecture?: LayoutArchitecture;
  subtitleBehavior?: SubtitleBehavior;
  hookTypographyStyle?: HookTypographyStyle;
  styleVariant?: number; // 0: GLOWING_KINETIC_TYPOGRAPHY, 1: CYBER_GLASS, 2: WARM_GOLD_HUD, 3: MINIMAL_APPLE, 4: CRIMSON_SPLIT

  // Universal Clone Blueprint (Fase 5)
  cameraFraming?: "FULL_9_16_SPEAKER_TRACK" | "LETTERBOX_16_9_BLUR_BG" | "SPLIT_SCREEN_TOP_BOTTOM" | "CENTER_16_9_BLUR_BG";
  hasTopInfographicCard?: boolean;
  hookVisualType?: "IN_SCENE_GLOW_TYPOGRAPHY" | "IN_SCENE_KINETIC_HOOK" | "TOP_BANNER_CARD" | "NONE";
  primaryAccentHex?: string;
  secondaryAccentHex?: string;
  colorMood?: "DARK_MOODY_CONTRAST" | "WARM_CINEMATIC" | "NATURAL_CRISP" | string;
}

/**
 * Returns all preset directories across the repository to ensure physical synchronization.
 */
export function getPresetsDirs(): string[] {
  const dirs: string[] = [];

  const candidates = [
    path.resolve(process.cwd(), "presets"),
    path.resolve(process.cwd(), "../../backend/presets"),
    path.resolve(process.cwd(), "../backend/presets"),
    path.resolve(process.cwd(), "backend/presets"),
    "d:/DIOR_CLIPPING/backend/presets",
    "d:/DIOR_CLIPPING/website-tahapan-dengan-kemauan-ku/apps/api/presets",
    "d:/DIOR_CLIPPING/website-tahapan-dengan-kemauan-ku/backend/presets",
  ];

  for (const c of candidates) {
    const normalized = path.normalize(c);
    if (!dirs.includes(normalized)) {
      dirs.push(normalized);
    }
  }

  // Ensure directories exist
  for (const d of dirs) {
    try {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
    } catch {}
  }

  return dirs;
}

/**
 * Lists all available presets from physical directories, deduplicated by ID.
 */
export async function listAllPresets(): Promise<VideoPreset[]> {
  const dirs = getPresetsDirs();
  const presetsMap = new Map<string, VideoPreset>();

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const fullPath = path.join(dir, file);
            const content = fs.readFileSync(fullPath, "utf-8");
            const parsed = JSON.parse(content) as VideoPreset;
            if (parsed.id && parsed.name && !presetsMap.has(parsed.id)) {
              if (!parsed.accentColor) {
                parsed.accentColor = parsed.id === "viral-motion" ? "#FACC15" : "#E50914";
              }

              // Ensure robust fallbacks
              if (!parsed.subtitleStyle) {
                parsed.subtitleStyle = {
                  fontName: "Montserrat ExtraBold",
                  fontSize: 26,
                  primaryColor: "&H00FFFFFF",
                  highlightColor: parsed.accentColor,
                  outlineColor: "&H00000000",
                  outlineWidth: 2,
                  alignment: 2,
                  marginV: 370,
                  bold: true,
                };
              } else {
                if (!parsed.subtitleStyle.fontName) {
                  parsed.subtitleStyle.fontName = "Montserrat ExtraBold";
                }
                // Normalize legacy marginV if too small (< 250) to bottom sweet spot (370)
                if (typeof parsed.subtitleStyle.marginV !== "number" || parsed.subtitleStyle.marginV < 250) {
                  parsed.subtitleStyle.marginV = 370;
                }
                // Sync legacy highlightColor to accentColor
                if (!parsed.subtitleStyle.highlightColor || parsed.subtitleStyle.highlightColor === "&H0000FFFF" || parsed.subtitleStyle.highlightColor === "&H0000D4FF") {
                  parsed.subtitleStyle.highlightColor = parsed.accentColor;
                }
              }

              // Normalize badge
              if (!parsed.badge) {
                if (parsed.id === "netflix-cinematic" || parsed.id === "viral-motion") {
                  parsed.badge = "Default 9:16";
                } else if (parsed.id.startsWith("cloned-") || parsed.id === "ai-cloned" || parsed.isCloned) {
                  parsed.badge = "AI Cloned";
                } else if (parsed.isCustom) {
                  parsed.badge = "Kustom";
                }
              }
              presetsMap.set(parsed.id, parsed);
            }
          } catch (err) {
            console.warn(`[Presets] Gagal membaca preset ${file} di ${dir}:`, err);
          }
        }
      }
    } catch (err) {
      console.warn(`[Presets] Gagal membaca folder ${dir}:`, err);
    }
  }

  const presets = Array.from(presetsMap.values());

  // Ensure stable order (renx-viral-clipper first, then netflix, viral, aesthetic, theo, ai-cloned, then cloned-*, then custom)
  const priorityOrder = [
    "renx-viral-clipper",
    "netflix-cinematic",
    "viral-motion",
    "aesthetic-soft-film",
    "theo-podcast",
    "ai-cloned",
  ];

  presets.sort((a, b) => {
    const idxA = priorityOrder.indexOf(a.id);
    const idxB = priorityOrder.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;

    // AI Cloned presets after defaults
    const isClonedA = a.id.startsWith("cloned-") || a.isCloned;
    const isClonedB = b.id.startsWith("cloned-") || b.isCloned;
    if (isClonedA && !isClonedB) return -1;
    if (!isClonedA && isClonedB) return 1;

    // Newer createdAt first
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }

    return a.name.localeCompare(b.name);
  });

  return presets;
}

export async function getPresetById(id: string): Promise<VideoPreset | null> {
  const all = await listAllPresets();
  return all.find((p) => p.id === id) || null;
}

/**
 * Saves or updates a preset configuration physically across all preset directories.
 */
export async function savePreset(preset: Partial<VideoPreset>): Promise<VideoPreset> {
  if (!preset.id || !preset.name) {
    throw new HttpError(400, "INVALID_PRESET", "Preset wajib memiliki id dan name.");
  }

  const safeId = preset.id
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "-");

  const isClonedPreset = safeId.startsWith("cloned-") || safeId === "ai-cloned" || preset.isCloned;

  const fullPreset: VideoPreset = {
    id: safeId,
    name: preset.name.trim(),
    description: preset.description || "Custom preset Dior Clipping",
    format: preset.format || "9:16",
    width: preset.width || 1080,
    height: preset.height || 1920,
    colorGrading:
      preset.colorGrading || "eq=contrast=1.05:brightness=0.0:saturation=1.05",
    transition: preset.transition || "fade",
    subtitleStyle: {
      fontName: preset.subtitleStyle?.fontName || "Montserrat ExtraBold",
      fontSize: preset.subtitleStyle?.fontSize || 26,
      primaryColor: preset.subtitleStyle?.primaryColor || "&H00FFFFFF",
      highlightColor:
        preset.subtitleStyle?.highlightColor && !preset.subtitleStyle.highlightColor.startsWith("&H")
          ? preset.subtitleStyle.highlightColor
          : (preset.accentColor || "#E50914"),
      outlineColor: preset.subtitleStyle?.outlineColor || "&H00000000",
      outlineWidth: preset.subtitleStyle?.outlineWidth || 2,
      alignment: preset.subtitleStyle?.alignment || 2,
      marginV:
        typeof preset.subtitleStyle?.marginV === "number" && preset.subtitleStyle.marginV >= 250
          ? preset.subtitleStyle.marginV
          : 370,
      bold: preset.subtitleStyle?.bold ?? true,
      animation: preset.subtitleStyle?.animation || "bounce-popup",
      bounceScale: preset.subtitleStyle?.bounceScale || 1.15,
      showSpeakerTag: preset.subtitleStyle?.showSpeakerTag ?? false,
    },
    motionGraphic: {
      progressBar: preset.motionGraphic?.progressBar ?? true,
      punchZoom: preset.motionGraphic?.punchZoom ?? false,
      punchZoomScale: preset.motionGraphic?.punchZoomScale || 1.15,
    },
    pipelineMode: preset.pipelineMode || "netflix_editorial",
    accentColor: preset.accentColor || "#E50914",
    enableHook: preset.enableHook !== false,
    enableTopMotion: preset.enableTopMotion !== false,
    enablePolish: preset.enablePolish !== false,
    badge: preset.badge || (isClonedPreset ? "AI Cloned" : "Kustom"),
    isCustom: preset.isCustom ?? true,
    isCloned: isClonedPreset,
    createdAt: preset.createdAt || new Date().toISOString(),

    // Polymorphic Style Engine & Clone Adaptation (Fase 1-5)
    layoutArchitecture: preset.layoutArchitecture || (safeId === "renx-viral-clipper" ? "IN_SCENE_KINETIC_CLIPPER" : "TOP_INFOGRAPHIC_PODCAST"),
    subtitleBehavior: preset.subtitleBehavior || (safeId === "renx-viral-clipper" ? "SINGLE_WORD_POP" : "PHRASE_HIGHLIGHT_BOX"),
    hookTypographyStyle: preset.hookTypographyStyle || (safeId === "renx-viral-clipper" ? "GLOWING_STACKED_IMPACT" : "EDITORIAL_SERIF_BANNER"),
    styleVariant: preset.styleVariant !== undefined ? preset.styleVariant : (safeId === "renx-viral-clipper" ? 0 : undefined),

    // Universal Clone Blueprint (Fase 5)
    cameraFraming: preset.cameraFraming || (safeId === "renx-viral-clipper" ? "FULL_9_16_SPEAKER_TRACK" : "CENTER_16_9_BLUR_BG"),
    hasTopInfographicCard: preset.hasTopInfographicCard ?? (safeId === "renx-viral-clipper" ? false : true),
    hookVisualType: preset.hookVisualType || (safeId === "renx-viral-clipper" ? "IN_SCENE_GLOW_TYPOGRAPHY" : "TOP_BANNER_CARD"),
    primaryAccentHex: preset.primaryAccentHex || preset.accentColor || (safeId === "renx-viral-clipper" ? "#FF6B00" : "#E50914"),
    secondaryAccentHex: preset.secondaryAccentHex,
    colorMood: preset.colorMood || "DARK_MOODY_CONTRAST",
  };

  const dirs = getPresetsDirs();
  for (const d of dirs) {
    try {
      const filePath = path.join(d, `${safeId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(fullPreset, null, 2), "utf-8");
    } catch (err: any) {
      console.warn(`[Presets] Gagal menyimpan ke ${d}:`, err?.message);
    }
  }

  console.log(`[Presets] Preset "${fullPreset.name}" (${safeId}) berhasil disimpan ke ${dirs.length} direktori.`);
  return fullPreset;
}

/**
 * Deletes a preset JSON file physically across all preset directories.
 * Protects system default presets (renx-viral-clipper, netflix-cinematic, and viral-motion).
 */
export async function deletePreset(id: string): Promise<{ success: boolean; id: string }> {
  const safeId = id.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "-");

  if (safeId === "renx-viral-clipper" || safeId === "netflix-cinematic" || safeId === "viral-motion") {
    throw new HttpError(
      400,
      "CANNOT_DELETE_DEFAULT",
      "Preset default sistem (Renx Viral Clipper, Netflix Cinematic & Viral Motion) tidak dapat dihapus agar sistem selalu memiliki fallback."
    );
  }

  const dirs = getPresetsDirs();
  let deletedCount = 0;

  for (const d of dirs) {
    const filePath = path.join(d, `${safeId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        deletedCount++;
      } catch (err: any) {
        console.warn(`[Presets] Gagal menghapus file ${filePath}:`, err?.message);
      }
    }
  }

  if (deletedCount === 0) {
    throw new HttpError(404, "PRESET_NOT_FOUND", `Preset "${id}" tidak ditemukan di server.`);
  }

  console.log(`[Presets] Preset "${safeId}" berhasil dihapus dari ${deletedCount} direktori.`);
  return { success: true, id: safeId };
}
