import { Router, type Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import {
  createNotificationSchema,
  listNotificationsQuerySchema,
  markNotificationReadSchema,
  notificationIdSchema,
} from "@starter/shared/validators/notifications";
import { auth } from "../lib/auth";
import { jsonBody } from "../middleware/body";
import {
  clearAllNotifications,
  createNotification,
  deleteNotification,
  listUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notifications.service";

export const notificationsRouter = Router();

async function getOptionalUserId(req: Request): Promise<string | null> {
  try {
    if (req.auth?.user?.id) return req.auth.user.id;
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      query: { disableCookieCache: true },
    });
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// List notifications with optional filtering (type, unreadOnly, limit)
notificationsRouter.get("/", async (req, res) => {
  const query = listNotificationsQuerySchema.parse(req.query);
  const userId = await getOptionalUserId(req);
  const result = await listUserNotifications(userId, query);
  res.json({ data: result });
});

// Create a new notification manually or from rendering events
notificationsRouter.post("/", jsonBody, async (req, res) => {
  const input = createNotificationSchema.parse(req.body);
  const userId = (await getOptionalUserId(req)) || input.userId || undefined;
  const result = await createNotification({
    ...input,
    userId,
  });
  res.status(201).json({ data: result });
});

// Mark all notifications as read
notificationsRouter.patch("/read-all", async (req, res) => {
  const userId = await getOptionalUserId(req);
  const result = await markAllNotificationsAsRead(userId);
  res.json({ data: result });
});

notificationsRouter.post("/mark-all-read", async (req, res) => {
  const userId = await getOptionalUserId(req);
  const result = await markAllNotificationsAsRead(userId);
  res.json({ data: result });
});

// Mark single notification as read/unread
notificationsRouter.patch("/:id/read", jsonBody, async (req, res) => {
  const id = notificationIdSchema.parse(req.params.id);
  const input = markNotificationReadSchema.parse(req.body || {});
  const userId = await getOptionalUserId(req);
  const result = await markNotificationAsRead(id, input.isRead, userId);
  res.json({ data: result });
});

// Clear all notifications
notificationsRouter.delete("/clear", async (req, res) => {
  const userId = await getOptionalUserId(req);
  const result = await clearAllNotifications(userId);
  res.json({ data: result });
});

notificationsRouter.post("/clear", async (req, res) => {
  const userId = await getOptionalUserId(req);
  const result = await clearAllNotifications(userId);
  res.json({ data: result });
});

// Delete single notification
notificationsRouter.delete("/:id", async (req, res) => {
  const id = notificationIdSchema.parse(req.params.id);
  const userId = await getOptionalUserId(req);
  const result = await deleteNotification(id, userId);
  res.json({ data: result });
});

