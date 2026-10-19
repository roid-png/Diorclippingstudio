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
}

export interface PresetMotionGraphic {
  progressBar: boolean;
  punchZoom: boolean;
  punchZoomScale?: number;
}

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
  isCustom?: boolean;
  createdAt?: string;
}

function getPresetsDir(): string {
  // Check local apps/api/presets first
  const localDir = path.resolve(process.cwd(), "presets");
  if (fs.existsSync(localDir)) {
    return localDir;
  }
  // Check monorepo backend/presets
  const backendDir = path.resolve(process.cwd(), "../../backend/presets");
  if (fs.existsSync(backendDir)) {
    return backendDir;
  }
  const rootBackendDir = path.resolve(process.cwd(), "backend/presets");
  if (fs.existsSync(rootBackendDir)) {
    return rootBackendDir;
  }
  fs.mkdirSync(localDir, { recursive: true });
  return localDir;
}

export async function listAllPresets(): Promise<VideoPreset[]> {
  const dir = getPresetsDir();
  const files = fs.readdirSync(dir);
  const presets: VideoPreset[] = [];

  for (const file of files) {
    if (file.endsWith(".json")) {
      try {
        const fullPath = path.join(dir, file);
        const content = fs.readFileSync(fullPath, "utf-8");
        const parsed = JSON.parse(content) as VideoPreset;
        if (parsed.id && parsed.name) {
          presets.push(parsed);
        }
      } catch (err) {
        console.warn(`[Presets] Gagal membaca preset ${file}:`, err);
      }
    }
  }

  // Ensure stable order (netflix, viral, aesthetic, theo, ai-cloned, then others)
  const priorityOrder = [
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
    return a.name.localeCompare(b.name);
  });

  return presets;
}

export async function getPresetById(id: string): Promise<VideoPreset | null> {
  const all = await listAllPresets();
  return all.find((p) => p.id === id) || null;
}

export async function savePreset(preset: Partial<VideoPreset>): Promise<VideoPreset> {
  if (!preset.id || !preset.name) {
    throw new HttpError(400, "INVALID_PRESET", "Preset wajib memiliki id dan name.");
  }

  const safeId = preset.id
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "-");

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
      fontName: preset.subtitleStyle?.fontName || "Arial",
      fontSize: preset.subtitleStyle?.fontSize || 24,
      primaryColor: preset.subtitleStyle?.primaryColor || "&H00FFFFFF",
      highlightColor: preset.subtitleStyle?.highlightColor || "&H0000FFFF",
      outlineColor: preset.subtitleStyle?.outlineColor || "&H00000000",
      outlineWidth: preset.subtitleStyle?.outlineWidth || 2,
      alignment: preset.subtitleStyle?.alignment || 2,
      marginV: preset.subtitleStyle?.marginV || 80,
      bold: preset.subtitleStyle?.bold ?? true,
      animation: preset.subtitleStyle?.animation || "bounce-popup",
      bounceScale: preset.subtitleStyle?.bounceScale || 1.15,
    },
    motionGraphic: {
      progressBar: preset.motionGraphic?.progressBar ?? true,
      punchZoom: preset.motionGraphic?.punchZoom ?? false,
      punchZoomScale: preset.motionGraphic?.punchZoomScale || 1.15,
    },
    isCustom: true,
    createdAt: new Date().toISOString(),
  };

  const primaryDir = getPresetsDir();
  const filePath = path.join(primaryDir, `${safeId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(fullPreset, null, 2), "utf-8");

  // Also mirror to secondary if exists
  const backendDir = path.resolve(process.cwd(), "../../backend/presets");
  if (fs.existsSync(backendDir)) {
    try {
      fs.writeFileSync(
        path.join(backendDir, `${safeId}.json`),
        JSON.stringify(fullPreset, null, 2),
        "utf-8"
      );
    } catch {}
  }

  return fullPreset;
}

