import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { projects, quotas, clips, renderJobs } from "../db/schema";
import type {
  CreateProjectInput,
  ListProjectsQueryInput,
} from "@starter/shared/validators/projects";
import { HttpError } from "../lib/http-error";
import { autoCutProjectVideo, getProjectClips } from "./video-cutter.service";

export async function getUserQuota(userId: string) {
  const [existingQuota] = await db
    .select()
    .from(quotas)
    .where(eq(quotas.userId, userId))
    .limit(1);

  if (existingQuota) {
    return {
      totalQuota: existingQuota.totalQuota,
      usedQuota: existingQuota.usedQuota,
      remainingQuota: Math.max(0, existingQuota.totalQuota - existingQuota.usedQuota),
      resetDate: existingQuota.resetDate,
    };
  }

  // Initialize quota for new user (default: 50 total quota)
  const [createdQuota] = await db
    .insert(quotas)
    .values({
      userId,
      totalQuota: 50,
      usedQuota: 0,
    })
    .returning();

  return {
    totalQuota: createdQuota.totalQuota,
    usedQuota: createdQuota.usedQuota,
    remainingQuota: createdQuota.totalQuota - createdQuota.usedQuota,
    resetDate: createdQuota.resetDate,
  };
}

export async function createProjectJob(userId: string, input: CreateProjectInput) {
  // 1. Quota Check
  const quota = await getUserQuota(userId);

  if (input.maxClips > quota.remainingQuota) {
    throw new HttpError(
      400,
      "INSUFFICIENT_QUOTA",
      `Jumlah klip yang dipilih (${input.maxClips}) melebihi sisa kuota Anda (${quota.remainingQuota} klip). Silakan kurangi limit klip.`
    );
  }

  // 2. Database transaction to create project and deduct quota
  const result = await db.transaction(async (tx) => {
    // Insert Project
    const [project] = await tx
      .insert(projects)
      .values({
        userId,
        youtubeUrl: input.youtubeUrl,
        videoTitle: input.videoTitle || "Video Sumber YouTube",
        videoDuration: input.videoDuration || 600,
        clipDuration: input.clipDuration,
        maxClips: input.maxClips,
        status: "processing",
      })
      .returning();

    // Update Quota
    const newUsedQuota = quota.usedQuota + input.maxClips;
    await tx
      .update(quotas)
      .set({ usedQuota: newUsedQuota })
      .where(eq(quotas.userId, userId));

    return {
      project,
      quota: {
        totalQuota: quota.totalQuota,
        usedQuota: newUsedQuota,
        remainingQuota: Math.max(0, quota.totalQuota - newUsedQuota),
      },
    };
  });

  // 3. Automatically cut video segments based on calculated viral potential
  const generatedClips = await autoCutProjectVideo(result.project.id);

  return {
    ...result,
    clips: generatedClips,
  };
}

function getEditingStyleName(id?: string | null) {
  switch (id) {
    case "mrbeast-hyper":
      return "MrBeast Fast Pacing";
    case "netflix-doc":
      return "Netflix Documentary Style";
    case "ali-abdaal-clean":
      return "Clean Minimalist Studio";
    case "theo-podcast":
    default:
      return "THEO 5-FIX (Podcast Dark)";
  }
}

function getMotionGraphicName(id?: string | null) {
  switch (id) {
    case "vox-explainer":
      return "VOX Split Screen & Kinetic Text";
    case "tiktok-pop":
      return "TikTok Pop-in Stickers & Highlights";
    case "cinematic-lowerthird":
      return "Cinematic Minimal Lower Third";
    case "theo-infographics":
    default:
      return "THEO Neon Infographics & Counter";
  }
}

function getSubtitleStyleName(id?: string | null) {
  switch (id) {
    case "hormozi-green":
      return "Alex Hormozi Impact Green";
    case "netflix-yellow":
      return "Netflix Classic Yellow Subtitle";
    case "clean-white":
      return "Clean White Minimal Sans";
    case "theo-red-pill":
    default:
      return "THEO Neon Red & Yellow Highlight";
  }
}

function formatDurationLabel(seconds?: number | null) {
  const total = Number(seconds) || 600;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function listUserProjects(
  userId: string,
  options: ListProjectsQueryInput = {
    source: "all",
    stage: "all",
    duration: "all",
    limit: 50,
  }
) {
  const conditions = [eq(projects.userId, userId)];

  if (options.source && options.source !== "all") {
    conditions.push(eq(projects.sourceType, options.source));
  }

  if (options.stage && options.stage !== "all") {
    conditions.push(eq(projects.stage, options.stage));
  }

  if (options.duration && options.duration !== "all") {
    const durNum = Number(options.duration);
    if (!isNaN(durNum) && durNum > 0) {
      conditions.push(eq(projects.clipDuration, durNum));
    }
  }

  const rawProjects = await db
    .select()
    .from(projects)
    .where(and(...conditions))
    .orderBy(desc(projects.isPinned), desc(projects.createdAt))
    .limit(options.limit || 50);

  const projectIds = rawProjects.map((p) => p.id);

  const allClips =
    projectIds.length > 0
      ? await db
          .select()
          .from(clips)
          .where(inArray(clips.projectId, projectIds))
          .orderBy(desc(clips.viralScore))
      : [];

  const allRenderJobs =
    allClips.length > 0
      ? await db
          .select()
          .from(renderJobs)
          .where(inArray(renderJobs.clipId, allClips.map((c) => c.id)))
      : [];

  const renderJobMap = new Map<string, (typeof allRenderJobs)[0]>();
  for (const job of allRenderJobs) {
    renderJobMap.set(job.clipId, job);
  }

  const clipsByProjectId = new Map<string, typeof allClips>();
  for (const clip of allClips) {
    const existing = clipsByProjectId.get(clip.projectId) || [];
    existing.push(clip);
    clipsByProjectId.set(clip.projectId, existing);
  }

  const results = rawProjects.map((proj) => {
    const projClips = clipsByProjectId.get(proj.id) || [];
    const completedClips = projClips.filter((c) => {
      const job = renderJobMap.get(c.id);
      return job?.status === "completed";
    });

    const viralScores = projClips.map((c) => Number(c.viralScore) || 0);
    const topViralScore = viralScores.length > 0 ? Math.max(...viralScores) : 92;
    const avgViralScore =
      viralScores.length > 0
        ? Math.round(
            viralScores.reduce((acc, score) => acc + score, 0) /
              viralScores.length
          )
        : 88;

    const mappedClips = projClips.map((c) => {
      const job = renderJobMap.get(c.id);
      return {
        id: c.id,
        rank: c.rank,
        title: c.title,
        durationSec: (c.duration === 30 || c.duration === 60
          ? c.duration
          : 45) as 30 | 45 | 60,
        viralScore: Number(c.viralScore) || 90,
        status: (job?.status || "ready") as
          | "completed"
          | "rendering"
          | "ready"
          | "failed",
        editingStyleName: getEditingStyleName(proj.editStyle),
        motionGraphicName: getMotionGraphicName(proj.motionGraphicStyle),
        subtitleStyleName: getSubtitleStyleName(proj.subtitleStyle),
        videoUrl: job?.outputUrl || `/api/clips/${c.id}/stream`,
        fileSizeMb: Number(job?.fileSizeMb) || 18.4,
      };
    });

    return {
      id: proj.id,
      title: proj.videoTitle || "Video Sumber YouTube",
      channelOrCreator: proj.channelOrCreator || "YouTube Creator",
      sourceType: (proj.sourceType as "youtube" | "upload") || "youtube",
      sourceUrl: proj.youtubeUrl,
      sourceFileName: proj.sourceFileName ?? undefined,
      thumbnailUrl:
        proj.thumbnailUrl ||
        `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80`,
      originalDurationLabel: formatDurationLabel(proj.videoDuration),
      targetClipDurationSec: (proj.clipDuration === 30 || proj.clipDuration === 60
        ? proj.clipDuration
        : 45) as 30 | 45 | 60,
      requestedClipsCount: proj.maxClips,
      completedClipsCount: completedClips.length,
      topViralScore,
      avgViralScore,
      stage: (proj.stage as any) || "auto-edit",
      stageLabel: proj.stageLabel || "Auto-Edit Siap",
      createdAt: proj.createdAt.toISOString(),
      updatedAt: proj.updatedAt.toISOString(),
      isPinned: proj.isPinned,
      defaultPillarSummary: {
        editingStyleName: getEditingStyleName(proj.editStyle),
        motionGraphicName: getMotionGraphicName(proj.motionGraphicStyle),
        subtitleStyleName: getSubtitleStyleName(proj.subtitleStyle),
      },
      clips: mappedClips,
    };
  });

  if (options.search && options.search.trim() !== "") {
    const q = options.search.trim().toLowerCase();
    return results.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.channelOrCreator.toLowerCase().includes(q) ||
        p.defaultPillarSummary.editingStyleName.toLowerCase().includes(q) ||
        p.defaultPillarSummary.motionGraphicName.toLowerCase().includes(q) ||
        p.defaultPillarSummary.subtitleStyleName.toLowerCase().includes(q)
    );
  }

  return results;
}

export async function getProjectById(userId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) return null;

  const projectClips = await db
    .select()
    .from(clips)
    .where(eq(clips.projectId, project.id))
    .orderBy(desc(clips.viralScore));

  return {
    ...project,
    clips: projectClips,
  };
}

export async function getProjectStatusAndClips(userId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) return null;

  const projectClips = await getProjectClips(project.id);

  let progress = 0;
  let stepMessage = "Menunggu antrean pemrosesan...";

  switch (project.status) {
    case "pending":
      progress = 10;
      stepMessage = "Menyiapkan antrean pemotongan video...";
      break;
    case "downloading":
      progress = 30;
      stepMessage = `Langkah 1/3: Mengunduh audio & video "${project.videoTitle || 'YouTube'}"...`;
      break;
    case "analyzing":
      progress = 60;
      stepMessage = "Langkah 2/3: Menganalisis momen puncak viral & sentimen...";
      break;
    case "processing":
      progress = 85;
      stepMessage = `Langkah 3/3: Memotong ${project.maxClips} klip 9:16 & sinkronisasi subtitle...`;
      break;
    case "completed":
      progress = 100;
      stepMessage = `Selesai! Berhasil memotong ${projectClips.length} klip berpotensi viral (${project.clipDuration}s).`;
      break;
    case "failed":
      progress = 0;
      stepMessage = "Gagal memproses video YouTube.";
      break;
    default:
      progress = 50;
      stepMessage = "Sedang memproses...";
  }

  return {
    id: project.id,
    youtubeUrl: project.youtubeUrl,
    videoTitle: project.videoTitle,
    status: project.status,
    progress,
    stepMessage,
    clipDuration: project.clipDuration,
    maxClips: project.maxClips,
    clips: projectClips,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export async function updateProjectMaxClips(
  userId: string,
  projectId: string,
  maxClips: number,
  regenerateClips = false
) {
  if (!Number.isInteger(maxClips) || maxClips < 1 || maxClips > 10) {
    throw new HttpError(
      400,
      "INVALID_MAX_CLIPS",
      "Parameter jumlah klip (maxClips) harus berupa bilangan bulat antara 1 hingga 10."
    );
  }

  const [existingProject] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!existingProject) {
    throw new HttpError(404, "NOT_FOUND", "Proyek tidak ditemukan.");
  }

  const [updatedProject] = await db
    .update(projects)
    .set({ maxClips })
    .where(eq(projects.id, projectId))
    .returning();

  const existingClips = await db
    .select()
    .from(clips)
    .where(eq(clips.projectId, projectId));

  if (regenerateClips || existingClips.length < maxClips) {
    await autoCutProjectVideo(projectId, maxClips);
  }

  const slicedClips = await getProjectClips(projectId, { maxClips });

  return {
    project: updatedProject,
    maxClips,
    clips: slicedClips,
  };
}
