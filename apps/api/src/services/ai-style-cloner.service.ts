import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { getFfmpegPath } from "../utils/ffmpeg-path";
import { getTempDir } from "./downloader";
import { savePreset, type VideoPreset } from "./presets.service";
import { getGeminiApiKey } from "./ai-curator.service";
import { HttpError } from "../lib/http-error";

const execFileAsync = promisify(execFile);

/**
 * Extracts 3 representative frame images from a reference video using FFmpeg.
 */
export async function extractSampleFrames(videoFilePath: string): Promise<string[]> {
  const ffmpegPath = getFfmpegPath();
  const framesDir = getTempDir("temp/clone_frames");
  const baseName = `frame_${Date.now()}`;

  const frameTimestamps = ["0.5", "2.0", "4.0"];
  const framePaths: string[] = [];

  for (let i = 0; i < frameTimestamps.length; i++) {
    const ts = frameTimestamps[i]!;
    const frameOut = path.join(framesDir, `${baseName}_${i}.jpg`);
    try {
      await execFileAsync(ffmpegPath, [
        "-y",
        "-ss",
        ts,
        "-i",
        videoFilePath,
        "-vframes",
        "1",
        "-q:v",
        "2",
        frameOut,
      ], { timeout: 15000 });

      if (fs.existsSync(frameOut)) {
        framePaths.push(frameOut);
      }
    } catch (err: any) {
      console.warn(`[Style Cloner] Gagal ekstrak frame pada detik ${ts}:`, err?.message);
    }
  }

  return framePaths;
}

/**
 * Sends sample frames to Gemini 2.5 Flash multimodal vision to extract subtitle styling
 * and color grading nuances, saving the result into `ai-cloned.json`.
 */
export async function cloneStyleFromVideo(input: {
  videoBuffer?: Buffer;
  videoFilePath?: string;
  presetName?: string;
}): Promise<VideoPreset> {
  const tempDir = getTempDir("temp/clone_uploads");
  let targetVideoPath = input.videoFilePath;

  if (!targetVideoPath && input.videoBuffer) {
    targetVideoPath = path.join(tempDir, `ref_${Date.now()}.mp4`);
    fs.writeFileSync(targetVideoPath, input.videoBuffer);
  }

  if (!targetVideoPath || !fs.existsSync(targetVideoPath)) {
    throw new HttpError(400, "MISSING_VIDEO", "File video referensi (5-15s) tidak ditemukan.");
  }

  const sampleFrames = await extractSampleFrames(targetVideoPath);
  const geminiApiKey = getGeminiApiKey();

  let detectedStyle: Partial<VideoPreset> = {
    id: "ai-cloned",
    name: input.presetName || "AI Cloned Style 🪄",
    description: "Gaya video yang diekstrak dan diduplikasi secara otomatis dari video referensi Anda.",
    format: "9:16",
    colorGrading: "eq=contrast=1.14:brightness=-0.02:saturation=1.20",
    transition: "zoom-in",
    subtitleStyle: {
      fontName: "Impact",
      fontSize: 28,
      primaryColor: "&H00FFFFFF",
      highlightColor: "&H0000FFFF",
      outlineColor: "&H00000000",
      outlineWidth: 3,
      alignment: 2,
      marginV: 90,
      bold: true,
      animation: "bounce-popup",
      bounceScale: 1.2,
    },
    motionGraphic: {
      progressBar: true,
      punchZoom: true,
      punchZoomScale: 1.15,
    },
  };

  if (geminiApiKey && sampleFrames.length > 0) {
    try {
      const parts: any[] = [
        {
          text: `
You are an expert video colorist and motion subtitle designer.
Analyze these ${sampleFrames.length} sample frames extracted from a viral short-form video.
Extract the visual style attributes:
1. Subtitle typography: text primary color (in ASS hex &H00BBGGRR format or standard color), highlight color, outline width, font weight/style.
2. Color grading nuances: estimated FFmpeg eq filter (contrast e.g. 1.05-1.25, brightness e.g. -0.05 to +0.05, saturation e.g. 0.90-1.30).
3. Motion graphic elements: does it have progress bar or punch zoom?

Return ONLY a pure JSON object matching this schema:
{
  "name": "AI Cloned Style",
  "description": "Gaya estetik dari video referensi",
  "colorGrading": "eq=contrast=1.15:brightness=-0.02:saturation=1.20",
  "subtitleStyle": {
    "fontName": "Impact",
    "fontSize": 28,
    "primaryColor": "&H00FFFFFF",
    "highlightColor": "&H0000FFFF",
    "outlineColor": "&H00000000",
    "outlineWidth": 3,
    "alignment": 2,
    "marginV": 90,
    "bold": true,
    "animation": "bounce-popup"
  },
  "motionGraphic": {
    "progressBar": true,
    "punchZoom": true
  }
}
`,
        },
      ];

      for (const framePath of sampleFrames) {
        const frameBuffer = fs.readFileSync(framePath);
        parts.push({
          inline_data: {
            mime_type: "image/jpeg",
            data: frameBuffer.toString("base64"),
          },
        });
      }

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`;
      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      });

      if (response.ok) {
        const jsonRes = (await response.json()) as any;
        const candidateText = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text || "";
        let clean = candidateText.trim();
        if (clean.startsWith("```json")) {
          clean = clean.replace(/^```json/, "").replace(/```$/, "").trim();
        } else if (clean.startsWith("```")) {
          clean = clean.replace(/^```/, "").replace(/```$/, "").trim();
        }

        const parsed = JSON.parse(clean);
        detectedStyle = {
          ...detectedStyle,
          ...parsed,
          id: "ai-cloned",
          name: input.presetName || parsed.name || "AI Cloned Style 🪄",
        };
      }
    } catch (err: any) {
      console.warn("[Style Cloner] Gemini visual analysis error, fallback:", err?.message);
    }
  }

  // Clean up extracted sample frames
  sampleFrames.forEach((fp) => {
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch {}
  });

  // Save the cloned preset to ai-cloned.json in presets dir
  const saved = await savePreset(detectedStyle);
  return saved;
}

