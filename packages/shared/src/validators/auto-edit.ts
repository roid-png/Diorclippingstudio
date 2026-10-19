import { z } from "zod";

export const clipEditSettingsInputSchema = z
  .object({
    subtitleEnabled: z.boolean().optional(),
    editingStyleId: z.string().trim().min(1).optional(),
    motionGraphicId: z.string().trim().min(1).optional(),
    subtitleStyleId: z.string().trim().min(1).optional(),
    wordByWordAnimation: z.boolean().optional(),
    highlightColor: z.string().trim().min(1).optional(),
    fontPosition: z.string().trim().min(1).optional(),
    sfxTransitionEnabled: z.boolean().optional(),
    colorGradingFilter: z.string().trim().min(1).optional(),
    zoomIntensity: z.number().int().min(100).max(200).optional(),
    customOverlayText: z.string().trim().nullable().optional(),
    applyToAllProjectClips: z.boolean().optional().default(false),
  })
  .strict();

export type ClipEditSettingsInput = z.infer<typeof clipEditSettingsInputSchema>;

export const batchApplyEditSettingsSchema = z
  .object({
    projectId: z.string().uuid().optional(),
    clipIds: z.array(z.string().uuid()).max(10).optional(),
    settings: clipEditSettingsInputSchema,
  })
  .strict();

export type BatchApplyEditSettingsInput = z.infer<
  typeof batchApplyEditSettingsSchema
>;
