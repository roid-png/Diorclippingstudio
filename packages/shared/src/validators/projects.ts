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

