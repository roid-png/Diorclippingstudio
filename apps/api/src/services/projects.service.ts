import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { projects, quotas, clips, renderJobs } from "../db/schema";
import type { CreateProjectInput } from "@starter/shared/validators/projects";
import { HttpError } from "../lib/http-error";
import { autoCutProjectVideo } from "./video-cutter.service";

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

export async function listUserProjects(userId: string) {
  return await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt));
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
