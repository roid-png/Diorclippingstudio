import { HttpError } from "../lib/http-error";
import {
  type WordTimestamp,
  type TranscriptionSegment,
  type WordLevelTranscription,
  transcribeAudioWithGemini,
  getGeminiTranscriptionApiKey,
  getGeminiCurationApiKey,
} from "./transcriber";
import {
  curateViralMomentsWithGemini as curateViralMoments,
  curateViralMomentsFromFullAudioFile as curateFullAudio,
  type CuratedViralClip,
  type CurateAudioFileInput,
} from "./viral_analyzer";

export type { WordTimestamp, TranscriptionSegment, WordLevelTranscription, CuratedViralClip, CurateAudioFileInput };

/**
 * Returns Gemini Curation Key (Account 2 - Viral Analysis & Vision).
 */
export function getGeminiApiKey(): string {
  return getGeminiCurationApiKey();
}

/**
 * [FASE 3: SINGLE-CALL FULL AUDIO CURATION VIA GEMINI FILE API]
 */
export async function curateViralMomentsFromFullAudioFile(
  input: CurateAudioFileInput
): Promise<CuratedViralClip[]> {
  return await curateFullAudio(input);
}

/**
 * Sends real audio to Google Gemini Speech-to-Text via File API (Account 1: GEMINI_API_KEY_TRANSCRIPTION)
 * to extract word-level and segment-level timestamps.
 * Groq dependency has been completely removed.
 */
export async function transcribeAudioWordLevel(audioFilePath: string): Promise<WordLevelTranscription> {
  console.log(`[AI Curator] Memulai transkripsi audio presisi via Gemini File API...`);
  return await transcribeAudioWithGemini(audioFilePath);
}

/**
 * Uses Google Gemini (gemini-3.5-flash-lite) with Account 2 (GEMINI_API_KEY_CURATION)
 * to curate top viral moments from real word-level transcript with normalized 0.00s offsets.
 */
export async function curateViralMomentsWithGemini(input: {
  transcription: WordLevelTranscription;
  targetDurationSec: number; // 30, 45, or 60
  maxClips: number; // 1 to 10
  videoTitle?: string;
}): Promise<CuratedViralClip[]> {
  return await curateViralMoments(input);
}

