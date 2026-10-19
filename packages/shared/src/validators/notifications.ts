import { z } from "zod";

export const notificationIdSchema = z
  .string()
  .uuid("ID notifikasi harus berupa UUID yang valid.");

export const listNotificationsQuerySchema = z.object({
  type: z.enum(["all", "success", "error", "info"]).optional().default("all"),
  unreadOnly: z
    .preprocess((val) => {
      if (typeof val === "string") return val === "true" || val === "1";
      return Boolean(val);
    }, z.boolean())
    .optional()
    .default(false),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type ListNotificationsQueryInput = z.infer<
  typeof listNotificationsQuerySchema
>;

export const createNotificationSchema = z
  .object({
    type: z.enum(["success", "error", "info"]).default("info"),
    userId: z.string().optional().nullable(),
    title: z.string().trim().min(1, "Judul notifikasi tidak boleh kosong."),
    message: z.string().trim().min(1, "Pesan notifikasi tidak boleh kosong."),
    clipId: z.string().uuid().optional().nullable(),
    renderJobId: z.string().uuid().optional().nullable(),
    fileName: z.string().trim().optional().nullable(),
  })
  .strict();

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export const markNotificationReadSchema = z
  .object({
    isRead: z.boolean().default(true),
  })
  .strict();

export type MarkNotificationReadInput = z.infer<
  typeof markNotificationReadSchema
>;

