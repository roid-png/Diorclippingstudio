import { z } from "zod";

export const youtubeUrlRegex =
  /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{5,15})([?&][\w=.-]*)*$/;

export const validateYouTubeUrlSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Silakan masukkan link video YouTube terlebih dahulu.")
    .refine((val) => {
      try {
        const parsed = new URL(val.startsWith("http") ? val : `https://${val}`);
        const host = parsed.hostname.toLowerCase();
        return (
          (host.includes("youtube.com") || host.includes("youtu.be")) &&
          (parsed.searchParams.has("v") ||
            parsed.pathname.length > 1 ||
            youtubeUrlRegex.test(val))
        );
      } catch {
        return false;
      }
    }, "Link YouTube tidak valid. Gunakan format seperti: https://www.youtube.com/watch?v=... atau https://youtu.be/..."),
});

export type ValidateYouTubeUrlInput = z.infer<typeof validateYouTubeUrlSchema>;

export interface YouTubeMetadataResponse {
  videoId: string;
  url: string;
  title: string;
  channelTitle: string;
  durationSeconds: number;
  durationFormatted: string;
  thumbnailUrl: string;
  viewCount?: string;
  isConfirmed: boolean;
}

