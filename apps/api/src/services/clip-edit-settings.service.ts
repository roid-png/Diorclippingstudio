import { eq } from "drizzle-orm";
import type { ClipEditSettingsInput } from "@starter/shared/validators/auto-edit";
import { db } from "../db";
import { clipEditSettings, clips } from "../db/schema";
import { HttpError } from "../lib/http-error";

export interface ResolvedClipEditSettings {
  clipId: string;
  subtitleEnabled: boolean;
  editingStyleId: string;
  motionGraphicId: string;
  subtitleStyleId: string;
  wordByWordAnimation: boolean;
  highlightColor: string;
  fontPosition: string;
  sfxTransitionEnabled: boolean;
  colorGradingFilter: string;
  zoomIntensity: number;
  customOverlayText: string | null;
  updatedAt: string;
}

export const DEFAULT_CLIP_EDIT_SETTINGS: Omit<
  ResolvedClipEditSettings,
  "clipId" | "updatedAt"
> = {
  subtitleEnabled: true,
  editingStyleId: "theo-podcast",
  motionGraphicId: "theo-infographics",
  subtitleStyleId: "theo-red-pill",
  wordByWordAnimation: true,
  highlightColor: "#DC2626",
  fontPosition: "Lower-Third Center (76% Y)",
  sfxTransitionEnabled: true,
  colorGradingFilter: "Warm Studio Contrast + Desaturated Background",
  zoomIntensity: 118,
  customOverlayText: null,
};

export function getDefaultEditSettings() {
  return {
    ...DEFAULT_CLIP_EDIT_SETTINGS,
    presetReference: "THEO 5-FIX.mp4 (Netflix Dark Investigative)",
    availableQuickCombos: [
      {
        id: "theo-5-fix",
        label: "Paket Lengkap THEO 5-FIX",
        editingStyleId: "theo-podcast",
        motionGraphicId: "theo-infographics",
        subtitleStyleId: "theo-red-pill",
        highlightColor: "#DC2626",
      },
      {
        id: "netflix-doc",
        label: "Paket Netflix Documentary",
        editingStyleId: "netflix-doc",
        motionGraphicId: "netflix-hud",
        subtitleStyleId: "netflix-yellow",
        highlightColor: "#FACC15",
      },
      {
        id: "hormozi-viral",
        label: "Paket Hormozi Kinetic",
        editingStyleId: "hormozi",
        motionGraphicId: "dynamic-broll",
        subtitleStyleId: "hormozi-box",
        highlightColor: "#22C55E",
      },
    ],
  };
}

export async function getClipEditSettings(
  clipId: string
): Promise<ResolvedClipEditSettings> {
  const [clip] = await db
    .select()
    .from(clips)
    .where(eq(clips.id, clipId))
    .limit(1);

  if (!clip) {
    throw new HttpError(404, "CLIP_NOT_FOUND", "Klip tidak ditemukan.");
  }

  const [existingSetting] = await db
    .select()
    .from(clipEditSettings)
    .where(eq(clipEditSettings.clipId, clipId))
    .limit(1);

  if (existingSetting) {
    return {
      clipId: existingSetting.clipId,
      subtitleEnabled: existingSetting.subtitleEnabled,
      editingStyleId: existingSetting.editingStyleId,
      motionGraphicId: existingSetting.motionGraphicId,
      subtitleStyleId: existingSetting.subtitleStyleId,
      wordByWordAnimation: existingSetting.wordByWordAnimation,
      highlightColor: existingSetting.highlightColor,
      fontPosition: existingSetting.fontPosition,
      sfxTransitionEnabled: existingSetting.sfxTransitionEnabled,
      colorGradingFilter: existingSetting.colorGradingFilter,
      zoomIntensity: existingSetting.zoomIntensity,
      customOverlayText: existingSetting.customOverlayText,
      updatedAt: existingSetting.updatedAt.toISOString(),
    };
  }

  // Initialize default settings row synchronized with clip columns
  const [createdSetting] = await db
    .insert(clipEditSettings)
    .values({
      clipId: clip.id,
      subtitleEnabled:
        clip.subtitleEnabled ?? DEFAULT_CLIP_EDIT_SETTINGS.subtitleEnabled,
      editingStyleId:
        clip.editingStyleId || DEFAULT_CLIP_EDIT_SETTINGS.editingStyleId,
      motionGraphicId:
        clip.motionGraphicId || DEFAULT_CLIP_EDIT_SETTINGS.motionGraphicId,
      subtitleStyleId:
        clip.subtitleStyleId || DEFAULT_CLIP_EDIT_SETTINGS.subtitleStyleId,
      wordByWordAnimation: DEFAULT_CLIP_EDIT_SETTINGS.wordByWordAnimation,
      highlightColor: DEFAULT_CLIP_EDIT_SETTINGS.highlightColor,
      fontPosition: DEFAULT_CLIP_EDIT_SETTINGS.fontPosition,
      sfxTransitionEnabled: DEFAULT_CLIP_EDIT_SETTINGS.sfxTransitionEnabled,
      colorGradingFilter: DEFAULT_CLIP_EDIT_SETTINGS.colorGradingFilter,
      zoomIntensity: DEFAULT_CLIP_EDIT_SETTINGS.zoomIntensity,
      customOverlayText: DEFAULT_CLIP_EDIT_SETTINGS.customOverlayText,
    })
    .returning();

  return {
    clipId: createdSetting.clipId,
    subtitleEnabled: createdSetting.subtitleEnabled,
    editingStyleId: createdSetting.editingStyleId,
    motionGraphicId: createdSetting.motionGraphicId,
    subtitleStyleId: createdSetting.subtitleStyleId,
    wordByWordAnimation: createdSetting.wordByWordAnimation,
    highlightColor: createdSetting.highlightColor,
    fontPosition: createdSetting.fontPosition,
    sfxTransitionEnabled: createdSetting.sfxTransitionEnabled,
    colorGradingFilter: createdSetting.colorGradingFilter,
    zoomIntensity: createdSetting.zoomIntensity,
    customOverlayText: createdSetting.customOverlayText,
    updatedAt: createdSetting.updatedAt.toISOString(),
  };
}

export async function updateClipEditSettings(
  clipId: string,
  input: ClipEditSettingsInput
) {
  const [targetClip] = await db
    .select()
    .from(clips)
    .where(eq(clips.id, clipId))
    .limit(1);

  if (!targetClip) {
    throw new HttpError(404, "CLIP_NOT_FOUND", "Klip tidak ditemukan.");
  }

  const current = await getClipEditSettings(clipId);

  const merged = {
    subtitleEnabled: input.subtitleEnabled ?? current.subtitleEnabled,
    editingStyleId: input.editingStyleId ?? current.editingStyleId,
    motionGraphicId: input.motionGraphicId ?? current.motionGraphicId,
    subtitleStyleId: input.subtitleStyleId ?? current.subtitleStyleId,
    wordByWordAnimation:
      input.wordByWordAnimation ?? current.wordByWordAnimation,
    highlightColor: input.highlightColor ?? current.highlightColor,
    fontPosition: input.fontPosition ?? current.fontPosition,
    sfxTransitionEnabled:
      input.sfxTransitionEnabled ?? current.sfxTransitionEnabled,
    colorGradingFilter: input.colorGradingFilter ?? current.colorGradingFilter,
    zoomIntensity: input.zoomIntensity ?? current.zoomIntensity,
    customOverlayText:
      input.customOverlayText !== undefined
        ? input.customOverlayText
        : current.customOverlayText,
  };

  const targetClipIds: string[] = [clipId];

  if (input.applyToAllProjectClips) {
    const siblingClips = await db
      .select({ id: clips.id })
      .from(clips)
      .where(eq(clips.projectId, targetClip.projectId));
    for (const sibling of siblingClips) {
      if (!targetClipIds.includes(sibling.id)) {
        targetClipIds.push(sibling.id);
      }
    }
  }

  await db.transaction(async (tx) => {
    for (const id of targetClipIds) {
      await tx
        .update(clips)
        .set({
          subtitleEnabled: merged.subtitleEnabled,
          editingStyleId: merged.editingStyleId,
          motionGraphicId: merged.motionGraphicId,
          subtitleStyleId: merged.subtitleStyleId,
        })
        .where(eq(clips.id, id));

      const [existing] = await tx
        .select({ id: clipEditSettings.id })
        .from(clipEditSettings)
        .where(eq(clipEditSettings.clipId, id))
        .limit(1);

      if (existing) {
        await tx
          .update(clipEditSettings)
          .set(merged)
          .where(eq(clipEditSettings.clipId, id));
      } else {
        await tx.insert(clipEditSettings).values({
          clipId: id,
          ...merged,
        });
      }
    }
  });

  const updatedSetting = await getClipEditSettings(clipId);

  return {
    settings: updatedSetting,
    appliedClipIds: targetClipIds,
    appliedCount: targetClipIds.length,
  };
}

export async function resetClipEditSettingsToDefault(clipId: string) {
  return await updateClipEditSettings(clipId, {
    ...DEFAULT_CLIP_EDIT_SETTINGS,
    applyToAllProjectClips: false,
  });
}
