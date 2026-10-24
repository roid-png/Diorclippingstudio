import { and, desc, eq } from "drizzle-orm";
import type { ListNotificationsQueryInput } from "@starter/shared/validators/notifications";
import { db } from "../db";
import { clips, notifications, projects, user } from "../db/schema";
import { HttpError } from "../lib/http-error";

export interface CreateNotificationParams {
  userId?: string | null;
  clipId?: string | null;
  renderJobId?: string | null;
  type?: "success" | "error" | "info";
  title: string;
  message: string;
  fileName?: string | null;
}

/**
 * List notifications for a given user or global notifications
 */
export async function listUserNotifications(
  userId?: string | null,
  options: ListNotificationsQueryInput = { type: "all", unreadOnly: false, limit: 50 }
) {
  const conditions = [];

  if (userId) {
    conditions.push(eq(notifications.userId, userId));
  }

  if (options.type && options.type !== "all") {
    conditions.push(eq(notifications.type, options.type));
  }

  if (options.unreadOnly) {
    conditions.push(eq(notifications.isRead, false));
  }

  const query = db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(options.limit || 50);

  const items = conditions.length > 0
    ? await query.where(and(...conditions))
    : await query;

  // Calculate unread count
  const unreadConditions = [eq(notifications.isRead, false)];
  if (userId) {
    unreadConditions.push(eq(notifications.userId, userId));
  }
  const unreadItems = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(...unreadConditions));

  return {
    items: items.map((item) => ({
      id: item.id,
      userId: item.userId,
      clipId: item.clipId ?? undefined,
      renderJobId: item.renderJobId ?? undefined,
      type: (item.type as "success" | "error" | "info") || "info",
      title: item.title,
      message: item.message,
      fileName: item.fileName ?? undefined,
      isRead: item.isRead,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    total: items.length,
    unreadCount: unreadItems.length,
  };
}

/**
 * Mark a single notification as read or unread
 */
export async function markNotificationAsRead(
  notificationId: string,
  isRead: boolean = true,
  userId?: string | null
) {
  const conditions = [eq(notifications.id, notificationId)];
  if (userId) {
    conditions.push(eq(notifications.userId, userId));
  }

  const [existing] = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .limit(1);

  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Notifikasi tidak ditemukan.");
  }

  const [updated] = await db
    .update(notifications)
    .set({
      isRead,
      updatedAt: new Date(),
    })
    .where(eq(notifications.id, notificationId))
    .returning();

  return {
    id: updated.id,
    isRead: updated.isRead,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

/**
 * Mark all notifications for a user as read
 */
export async function markAllNotificationsAsRead(userId?: string | null) {
  const conditions = [eq(notifications.isRead, false)];
  if (userId) {
    conditions.push(eq(notifications.userId, userId));
  }

  const updatedRows = await db
    .update(notifications)
    .set({
      isRead: true,
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning({ id: notifications.id });

  return {
    success: true,
    markedCount: updatedRows.length,
  };
}

/**
 * Create a new notification (e.g. render completed, render failed, clipping ready)
 */
export async function createNotification(params: CreateNotificationParams) {
  let resolvedUserId = params.userId;

  // If userId not provided, try resolving from clip -> project -> userId
  if (!resolvedUserId && params.clipId) {
    const [clip] = await db
      .select({ projectId: clips.projectId })
      .from(clips)
      .where(eq(clips.id, params.clipId))
      .limit(1);

    if (clip?.projectId) {
      const [proj] = await db
        .select({ userId: projects.userId })
        .from(projects)
        .where(eq(projects.id, clip.projectId))
        .limit(1);

      resolvedUserId = proj?.userId;
    }
  }

  // Fallback to first user in database if still null
  if (!resolvedUserId) {
    const [firstUser] = await db.select({ id: user.id }).from(user).limit(1);
    resolvedUserId = firstUser?.id;
  }

  if (!resolvedUserId) {
    throw new HttpError(
      400,
      "USER_REQUIRED",
      "Tidak dapat membuat notifikasi tanpa pengguna yang valid."
    );
  }

  const [created] = await db
    .insert(notifications)
    .values({
      userId: resolvedUserId,
      clipId: params.clipId ?? null,
      renderJobId: params.renderJobId ?? null,
      type: params.type || "info",
      title: params.title,
      message: params.message,
      fileName: params.fileName ?? null,
      isRead: false,
    })
    .returning();

  return {
    id: created.id,
    userId: created.userId,
    clipId: created.clipId ?? undefined,
    renderJobId: created.renderJobId ?? undefined,
    type: created.type as "success" | "error" | "info",
    title: created.title,
    message: created.message,
    fileName: created.fileName ?? undefined,
    isRead: created.isRead,
    createdAt: created.createdAt.toISOString(),
  };
}

/**
 * Clear all notifications (or delete a specific notification)
 */
export async function deleteNotification(
  notificationId: string,
  userId?: string | null
) {
  const conditions = [eq(notifications.id, notificationId)];
  if (userId) {
    conditions.push(eq(notifications.userId, userId));
  }

  const [deleted] = await db
    .delete(notifications)
    .where(and(...conditions))
    .returning({ id: notifications.id });

  if (!deleted) {
    throw new HttpError(404, "NOT_FOUND", "Notifikasi tidak ditemukan.");
  }

  return { success: true, deletedId: deleted.id };
}

/**
 * Clear all notifications for user
 */
export async function clearAllNotifications(userId?: string | null) {
  const conditions = [];
  if (userId) {
    conditions.push(eq(notifications.userId, userId));
  }

  const deletedRows = conditions.length > 0
    ? await db.delete(notifications).where(and(...conditions)).returning({ id: notifications.id })
    : await db.delete(notifications).returning({ id: notifications.id });

  return { success: true, clearedCount: deletedRows.length };
}

