import { desc, eq } from "drizzle-orm";
import type { ClipEditSettingsInput } from "@starter/shared/validators/auto-edit";
import { db } from "../db";
import { clips, renderJobs } from "../db/schema";
import { HttpError } from "../lib/http-error";
import {
  getClipEditSettings,
  updateClipEditSettings,
} from "./clip-edit-settings.service";
import {
  getEditingStylePresetById,
  getSubtitleStylePresetById,
} from "./editing-style-presets.service";
import { getMotionGraphicPresetById } from "./motion-graphic-presets.service";
import { getClipSubtitlesWithWordTimings } from "./subtitle-transcription.service";

export interface CompiledRenderPipelineSpec {
  clipId: string;
  projectId: string;
  clipTitle: string;
  durationSeconds: number;
  aspectRatio: "9:16";
  resolution: "1080x1920";
  fps: 60;
  streamUrl: string;
  activePillarSummary: {
    editingStyle: {
      id: string;
      name: string;
      badge: string;
      pacing: string;
      zoomPattern: string;
      colorGrading: string;
    };
    motionGraphic: {
      id: string;
      name: string;
      badge: string;
      overlayLabel: string;
      sfxProfile: string;
    };
    subtitle: {
      enabled: boolean;
      id: string;
      name: string;
      badge: string;
      fontStyle: string;
      highlightColor: string;
      position: string;
      wordByWordAnimation: boolean;
    };
  };
  previewLayers: {
    cssFilter: string;
    vignetteOverlay: string;
    zoomScale: number;
    hudBadgeText: string;
    hudAccentColor: string;
    sfxEnabled: boolean;
    subtitleSegmentsCount: number;
  };
  ffmpegFilterGraph: {
    videoFilter: string;
    audioFilter: string;
    subtitleFilter: string | null;
    commandPreview: string;
  };
}

/**
 * Compiles the 3-pillar auto-edit settings (Editing Style, Motion Graphic, Subtitle)
 * into a unified render pipeline specification and preview descriptor for a clip.
 */
export async function buildClipRenderPipelineSpec(
  clipId: string,
  overrideSettings?: ClipEditSettingsInput
): Promise<CompiledRenderPipelineSpec> {
  if (overrideSettings && Object.keys(overrideSettings).length > 0) {
    await updateClipEditSettings(clipId, overrideSettings);
  }

  const [clip] = await db
    .select()
    .from(clips)
    .where(eq(clips.id, clipId))
    .limit(1);

  if (!clip) {
    throw new HttpError(404, "CLIP_NOT_FOUND", "Klip tidak ditemukan.");
  }

  const settings = await getClipEditSettings(clipId);
  const [editingPreset, motionPreset, subtitlePreset, subtitleData] =
    await Promise.all([
      getEditingStylePresetById(settings.editingStyleId).catch(() =>
        getEditingStylePresetById("theo-podcast")
      ),
      getMotionGraphicPresetById(settings.motionGraphicId).catch(() =>
        getMotionGraphicPresetById("theo-infographics")
      ),
      getSubtitleStylePresetById(settings.subtitleStyleId).catch(() =>
        getSubtitleStylePresetById("theo-red-pill")
      ),
      getClipSubtitlesWithWordTimings(clipId),
    ]);

  const zoomScale = Number((settings.zoomIntensity / 100).toFixed(2));
  const videoCropAndScale = `crop=ih*9/16:ih,scale=1080:1920,zoompan=z='min(zoom+0.0015,${zoomScale})':d=1:s=1080x1920`;
  const eqGrading =
    editingPreset.id === "theo-podcast" || editingPreset.id === "netflix-doc"
      ? "eq=contrast=1.18:brightness=-0.03:saturation=0.90,vignette=PI/4"
      : "eq=contrast=1.10:saturation=1.12";
  const hudFilter =
    motionPreset.id !== "none"
      ? `,drawbox=x=40:y=80:w=460:h=64:color=${motionPreset.accentColor}@0.85:t=fill`
      : "";
  const subtitleBurnFilter = settings.subtitleEnabled
    ? `subtitles=storage/subtitles/${clipId}.ass:force_style='FontName=Montserrat,Bold=1,PrimaryColour=&H00FFFFFF,BackColour=&H80000000'`
    : null;

  const fullVideoFilter = [
    videoCropAndScale,
    eqGrading + hudFilter,
    subtitleBurnFilter,
  ]
    .filter(Boolean)
    .join(",");

  const audioFilter = settings.sfxTransitionEnabled
    ? "loudnorm=I=-14:TP=-1.5:LRA=11,acompressor=threshold=-18dB:ratio=3"
    : "loudnorm=I=-14:TP=-1.5:LRA=11";

  const commandPreview = `ffmpeg -ss ${clip.startTime} -t ${clip.duration} -i input.mp4 -vf "${fullVideoFilter}" -af "${audioFilter}" -c:v libx264 -preset ultrafast -crf 20 -r 60 storage/clips/${clip.id}.mp4`;

  return {
    clipId: clip.id,
    projectId: clip.projectId,
    clipTitle: clip.title,
    durationSeconds: clip.duration,
    aspectRatio: "9:16",
    resolution: "1080x1920",
    fps: 60,
    streamUrl: `/api/clips/${clip.id}/stream`,
    activePillarSummary: {
      editingStyle: {
        id: editingPreset.id,
        name: editingPreset.name,
        badge: editingPreset.badge,
        pacing: editingPreset.pacing,
        zoomPattern: editingPreset.zoomPattern,
        colorGrading: settings.colorGradingFilter || editingPreset.colorGrading,
      },
      motionGraphic: {
        id: motionPreset.id,
        name: motionPreset.name,
        badge: motionPreset.badge,
        overlayLabel:
          settings.customOverlayText || motionPreset.overlayLabel,
        sfxProfile: motionPreset.sfxProfile,
      },
      subtitle: {
        enabled: settings.subtitleEnabled,
        id: subtitlePreset.id,
        name: subtitlePreset.name,
        badge: subtitlePreset.badge,
        fontStyle: subtitlePreset.fontStyle,
        highlightColor:
          settings.highlightColor || subtitlePreset.highlightColor,
        position: settings.fontPosition || subtitlePreset.position,
        wordByWordAnimation: settings.wordByWordAnimation,
      },
    },
    previewLayers: {
      cssFilter: editingPreset.cinematicParameters.cssFilter,
      vignetteOverlay: editingPreset.cinematicParameters.vignetteIntensity,
      zoomScale,
      hudBadgeText:
        settings.customOverlayText || motionPreset.overlayLabel,
      hudAccentColor: motionPreset.accentColor,
      sfxEnabled: settings.sfxTransitionEnabled,
      subtitleSegmentsCount: subtitleData.segmentCount,
    },
    ffmpegFilterGraph: {
      videoFilter: fullVideoFilter,
      audioFilter,
      subtitleFilter: subtitleBurnFilter,
      commandPreview,
    },
  };
}

/**
 * Applies the clip's auto-edit settings into the render pipeline and records/updates a render_jobs entry.
 */
export async function applyEditSettingsToRenderPipeline(
  clipId: string,
  overrideSettings?: ClipEditSettingsInput
) {
  const pipelineSpec = await buildClipRenderPipelineSpec(
    clipId,
    overrideSettings
  );

  const [existingJob] = await db
    .select()
    .from(renderJobs)
    .where(eq(renderJobs.clipId, clipId))
    .orderBy(desc(renderJobs.createdAt))
    .limit(1);

  const jobPayload = {
    clipId,
    subtitleEnabled: pipelineSpec.activePillarSummary.subtitle.enabled,
    motionGraphicStyle: pipelineSpec.activePillarSummary.motionGraphic.id,
    editStyle: pipelineSpec.activePillarSummary.editingStyle.id,
    status: "completed",
    progress: 100,
    outputUrl: pipelineSpec.streamUrl,
    completedAt: new Date(),
  };

  const [renderJob] = existingJob
    ? await db
        .update(renderJobs)
        .set(jobPayload)
        .where(eq(renderJobs.id, existingJob.id))
        .returning()
    : await db.insert(renderJobs).values(jobPayload).returning();

  return {
    renderJob,
    pipelineSpec,
  };
}

