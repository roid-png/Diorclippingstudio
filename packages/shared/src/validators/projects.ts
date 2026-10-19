import { z } from "zod";

export const createProjectSchema = z
  .object({
    youtubeUrl: z
      .string()
      .trim()
      .min(1, "Link YouTube tidak boleh kosong."),
    videoTitle: z.string().trim().optional(),
    videoDuration: z.number().int().positive().optional(),
    clipDuration: z.union([z.literal(30), z.literal(45), z.literal(60)]).default(45),
    maxClips: z.number().int().min(1).max(10).default(10),
    editStyle: z.string().trim().default("theo-podcast"),
    motionGraphicStyle: z.string().trim().default("theo-infographics"),
    subtitleStyle: z.string().trim().default("theo-red-pill"),
  })
  .strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const projectIdSchema = z.string().uuid("ID proyek harus berupa UUID yang valid.");

export const clipIdSchema = z.string().uuid("ID klip harus berupa UUID yang valid.");

export const toggleFavoriteClipSchema = z
  .object({
    isSelected: z.boolean().optional(),
  })
  .strict();

export type ToggleFavoriteClipInput = z.infer<typeof toggleFavoriteClipSchema>;

export const batchSelectFavoriteClipsSchema = z
  .object({
    clipIds: z
      .array(z.string().uuid("ID klip harus berupa UUID yang valid."))
      .max(10, "Maksimal 10 klip favorit yang dapat dipilih."),
  })
  .strict();

export type BatchSelectFavoriteClipsInput = z.infer<typeof batchSelectFavoriteClipsSchema>;

export const maxClipsParamSchema = z.coerce
  .number()
  .int("Jumlah klip harus berupa bilangan bulat.")
  .min(1, "Jumlah klip minimal 1.")
  .max(10, "Jumlah klip maksimal 10.")
  .default(10);

export const updateProjectMaxClipsSchema = z
  .object({
    maxClips: z.coerce
      .number()
      .int("Jumlah klip harus berupa bilangan bulat.")
      .min(1, "Jumlah klip minimal 1.")
      .max(10, "Jumlah klip maksimal 10."),
    regenerateClips: z.boolean().optional().default(false),
  })
  .strict();

export type UpdateProjectMaxClipsInput = z.infer<typeof updateProjectMaxClipsSchema>;

export const listClipsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  sortBy: z
    .enum(["viral-desc", "viral-asc", "timeline-asc", "duration-desc"])
    .optional()
    .default("viral-desc"),
  category: z.string().optional().default("all"),
  maxClips: maxClipsParamSchema.optional(),
  limit: maxClipsParamSchema.optional(),
});

export type ListClipsQueryInput = z.infer<typeof listClipsQuerySchema>;

export const listProjectsQuerySchema = z.object({
  search: z.string().trim().optional(),
  source: z.enum(["all", "youtube", "upload"]).optional().default("all"),
  stage: z
    .enum([
      "all",
      "completed",
      "rendering",
      "auto-edit",
      "viral-detected",
      "failed",
    ])
    .optional()
    .default("all"),
  duration: z.coerce.string().optional().default("all"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type ListProjectsQueryInput = z.infer<typeof listProjectsQuerySchema>;


