import fs from "node:fs";
import path from "node:path";
import { HttpError } from "../lib/http-error";

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WordTimestamp[];
}

export interface WordLevelTranscription {
  text: string;
  duration: number;
  words: WordTimestamp[];
  segments: TranscriptionSegment[];
}

export interface CuratedViralClip {
  rank: number;
  title: string;
  start_time: number;
  end_time: number;
  duration: number;
  viral_score: number;
  viral_reason: string;
  hook_description: string;
  words?: WordTimestamp[];
}

/**
 * Sends real audio downloaded via yt-dlp to Groq Whisper-large-v3 to extract
 * word-level and segment-level timestamps.
 * No mock or dummy fallbacks: throws clear error if API fails.
 */
export async function transcribeAudioWordLevel(audioFilePath: string): Promise<WordLevelTranscription> {
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!groqApiKey || !groqApiKey.startsWith("gsk_")) {
    throw new HttpError(
      500,
      "GROQ_API_KEY_INVALID",
      "GROQ_API_KEY belum disetel atau tidak valid di .env.local. Masukkan Groq API Key yang aktif untuk transkripsi audio asli."
    );
  }

  if (!audioFilePath || !fs.existsSync(audioFilePath)) {
    throw new HttpError(
      404,
      "AUDIO_FILE_NOT_FOUND",
      `File audio hasil unduhan yt-dlp tidak ditemukan di "${audioFilePath}".`
    );
  }

  const stat = fs.statSync(audioFilePath);
  if (stat.size === 0) {
    throw new HttpError(
      400,
      "AUDIO_FILE_EMPTY",
      "File audio kosong (0 bytes). Pastikan link YouTube memiliki track audio yang dapat diunduh."
    );
  }

  const audioBuffer = fs.readFileSync(audioFilePath);
  const blob = new Blob([audioBuffer], { type: "audio/mpeg" });

  const formData = new FormData();
  formData.append("file", blob, path.basename(audioFilePath) || "audio.mp3");
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");
  formData.append("timestamp_granularities[]", "segment");

  console.log(`[AI Curator] Mengirim file audio (${Math.round(stat.size / 1024)} KB) ke Groq Whisper-large-v3...`);

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[AI Curator] Groq API response error:", response.status, errText);
    throw new HttpError(
      502,
      "GROQ_TRANSCRIPTION_FAILED",
      `Gagal mentranskripsi audio melalui Groq Cloud (${response.status}): ${errText}`
    );
  }

  const data = (await response.json()) as any;
  const rawWords: any[] = data.words || [];
  const rawSegments: any[] = data.segments || [];

  if (!rawWords || rawWords.length === 0) {
    throw new HttpError(
      422,
      "NO_SPEECH_WORDS_FOUND",
      "Tidak ada kata/ucapan yang berhasil terdeteksi dari file audio YouTube ini."
    );
  }

  const words: WordTimestamp[] = rawWords.map((w) => ({
    word: String(w.word || "").trim(),
    start: Number(w.start) || 0,
    end: Number(w.end) || (Number(w.start) || 0) + 0.25,
  }));

  const segments: TranscriptionSegment[] = rawSegments.map((s, idx) => ({
    id: s.id ?? idx,
    start: Number(s.start) || 0,
    end: Number(s.end) || 0,
    text: String(s.text || "").trim(),
  }));

  const totalDuration = Number(data.duration) || (words.length > 0 ? words[words.length - 1]!.end : 300);

  console.log(`[AI Curator] Berhasil mentranskripsi ${words.length} kata dan ${segments.length} segmen dari Groq Whisper!`);

  return {
    text: data.text || "",
    duration: totalDuration,
    words,
    segments,
  };
}

/**
 * Uses Google Gemini (gemini-3.5-flash-lite) to curate top viral moments from real word-level transcript.
 * Throws clear error if Gemini fails. No mock fallbacks.
 */
export async function curateViralMomentsWithGemini(input: {
  transcription: WordLevelTranscription;
  targetDurationSec: number; // 30, 45, or 60
  maxClips: number; // 1 to 10
  videoTitle?: string;
}): Promise<CuratedViralClip[]> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new HttpError(
      500,
      "GEMINI_API_KEY_MISSING",
      "GEMINI_API_KEY belum disetel di .env.local untuk kurasi viral AI."
    );
  }

  const targetDuration = [30, 45, 60].includes(input.targetDurationSec)
    ? input.targetDurationSec
    : 45;
  const clipLimit = Math.min(Math.max(1, input.maxClips || 5), 10);

  const promptText = `
You are an elite short-form video curator for TikTok, Reels, and YouTube Shorts.
Analyze this video transcription with word-level segments and find the TOP ${clipLimit} most engaging and viral moments.

Video Title: "${input.videoTitle || 'YouTube Video'}"
Target Duration per Clip: ~${targetDuration} seconds (acceptable range: ${Math.max(15, targetDuration - 5)}s to ${targetDuration + 5}s).
Max Clips requested: ${clipLimit}.
Total video duration: ${Math.round(input.transcription.duration)}s.

Transcription text:
"${input.transcription.text.slice(0, 15000)}"

Segments overview:
${JSON.stringify(input.transcription.segments.slice(0, 40), null, 2)}

Requirements:
1. Identify high-energy hooks in the first 3 seconds of each clip.
2. Choose exact start_time and end_time (in seconds as floats or ints) within 0 to ${Math.round(input.transcription.duration)}.
3. Rate viral_score from 75 to 99 based on hook, curiosity gap, emotional peak, or revelation.
4. Provide Indonesian 'title', 'viral_reason', and 'hook_description'.
5. Return ONLY a pure JSON array with no extra markdown wrapping.

Schema:
[
  {
    "rank": 1,
    "title": "Judul Menarik Singkat (maks 8 kata)",
    "start_time": 10.0,
    "end_time": ${10 + targetDuration},
    "duration": ${targetDuration},
    "viral_score": 96,
    "viral_reason": "Alasan spesifik potensi viral dalam bahasa Indonesia",
    "hook_description": "Kalimat pembuka hook 3 detik yang mengikat perhatian"
  }
]
`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`;
  const response = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[AI Curator] Gemini API error:", response.status, errText);
    throw new HttpError(
      502,
      "GEMINI_CURATION_FAILED",
      `Gagal mengkurasi momen viral melalui Gemini API (${response.status}): ${errText}`
    );
  }

  const jsonRes = (await response.json()) as any;
  const candidateText = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text || "";

  let cleanJson = candidateText.trim();
  if (cleanJson.startsWith("```json")) {
    cleanJson = cleanJson.replace(/^```json/, "").replace(/```$/, "").trim();
  } else if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.replace(/^```/, "").replace(/```$/, "").trim();
  }

  let parsed: any[];
  try {
    parsed = JSON.parse(cleanJson);
  } catch (err: any) {
    console.error("[AI Curator] Gagal mem-parse output JSON Gemini:", cleanJson);
    throw new HttpError(
      502,
      "GEMINI_PARSE_ERROR",
      `Output Gemini tidak berformat JSON valid: ${err?.message}`
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new HttpError(
      502,
      "GEMINI_EMPTY_RESPONSE",
      "Gemini tidak mengembalikan daftar momen viral."
    );
  }

  const curated: CuratedViralClip[] = parsed.slice(0, clipLimit).map((item, index) => {
    const start = Math.max(0, Number(item.start_time) || 0);
    const end = Math.min(
      input.transcription.duration || 600,
      Math.max(start + 15, Number(item.end_time) || start + targetDuration)
    );
    const actualDur = Math.round(end - start);

    // Filter matching word timestamps for this clip
    const clipWords = input.transcription.words.filter(
      (w) => w.start >= start && w.end <= end
    );

    return {
      rank: index + 1,
      title: item.title || `Momen Viral #${index + 1}`,
      start_time: start,
      end_time: end,
      duration: actualDur,
      viral_score: Math.min(99, Math.max(70, Number(item.viral_score) || (95 - index * 2))),
      viral_reason: item.viral_reason || "Hook kuat dengan eskalasi narasi yang mempertahankan retensi.",
      hook_description: item.hook_description || "Pernyataan pembuka yang mengejutkan penonton dalam 3 detik pertama.",
      words: clipWords,
    };
  });

  return curated;
}
