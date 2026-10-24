import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getFfmpegPath } from "../utils/ffmpeg-path";
import {
  executeGeminiWithFailover,
  STANDARD_GEMINI_CANDIDATE_MODELS,
} from "./api_key_manager";

const execFileAsync = promisify(execFile);

export interface ColorGradeParameters {
  brightness: number; // e.g. -0.02 to 0.04
  contrast: number; // e.g. 1.01 to 1.10
  saturation: number; // e.g. 0.90 to 1.25
  gamma_r: number; // e.g. 0.95 to 1.05
  gamma_g: number; // e.g. 0.95 to 1.05
  gamma_b: number; // e.g. 0.95 to 1.05
  filmGrainIntensity?: number; // 0.0 s/d 1.0
  lutPath?: string;
  presetName?: string;
}

const PRESET_COLOR_GRADES: Record<string, ColorGradeParameters> = {
  netflix_cinematic: {
    brightness: 0.02,
    contrast: 1.04,
    saturation: 1.08,
    gamma_r: 1.02,
    gamma_g: 1.00,
    gamma_b: 0.98,
    presetName: "Netflix Cinematic",
  },
  moody: {
    brightness: -0.01,
    contrast: 1.06,
    saturation: 0.90,
    gamma_r: 0.98,
    gamma_g: 0.99,
    gamma_b: 1.03,
    presetName: "Moody Sinematik",
  },
  moody_film: {
    brightness: -0.02,
    contrast: 1.08,
    saturation: 0.92,
    gamma_r: 0.98,
    gamma_g: 0.99,
    gamma_b: 1.04,
    filmGrainIntensity: 0.08,
    presetName: "Deep Moody Film",
  },
  contrast_pop: {
    brightness: 0.01,
    contrast: 1.10,
    saturation: 1.15,
    gamma_r: 1.02,
    gamma_g: 1.01,
    gamma_b: 0.98,
    presetName: "High Contrast Pop",
  },
  vintage_warm: {
    brightness: 0.03,
    contrast: 1.04,
    saturation: 1.08,
    gamma_r: 1.06,
    gamma_g: 1.01,
    gamma_b: 0.92,
    filmGrainIntensity: 0.06,
    presetName: "Vintage Warm",
  },
  clean_crisp: {
    brightness: 0.02,
    contrast: 1.03,
    saturation: 1.05,
    gamma_r: 1.00,
    gamma_g: 1.00,
    gamma_b: 1.00,
    presetName: "Clean Crisp Natural",
  },
  warm_glow: {
    brightness: 0.03,
    contrast: 1.03,
    saturation: 1.12,
    gamma_r: 1.05,
    gamma_g: 1.01,
    gamma_b: 0.94,
    presetName: "Warm Glow",
  },
  teal_orange: {
    brightness: 0.01,
    contrast: 1.05,
    saturation: 1.10,
    gamma_r: 1.04,
    gamma_g: 0.99,
    gamma_b: 1.04,
    presetName: "Teal & Orange",
  },
  clean_natural: {
    brightness: 0.02,
    contrast: 1.02,
    saturation: 1.04,
    gamma_r: 1.00,
    gamma_g: 1.00,
    gamma_b: 1.00,
    presetName: "Clean Natural",
  },
};

// Memory cache for analyzed video grading to save token quota and CPU
const gradingCache = new Map<string, ColorGradeParameters>();

/**
 * Builds a single-pass native FFmpeg color filter string.
 * Example: eq=contrast=1.04:brightness=0.02:saturation=1.08,colorbalance=rs=0.02:gs=0.00:bs=-0.02
 */
export function buildFfmpegColorFilter(params: ColorGradeParameters): string {
  const c = Math.max(0.8, Math.min(1.3, params.contrast || 1.03));
  const b = Math.max(-0.1, Math.min(0.1, params.brightness || 0.02));
  const s = Math.max(0.5, Math.min(1.5, params.saturation || 1.06));

  const rs = (params.gamma_r || 1.0) - 1.0;
  const gs = (params.gamma_g || 1.0) - 1.0;
  const bs = (params.gamma_b || 1.0) - 1.0;

  const eqFilter = `eq=contrast=${c.toFixed(2)}:brightness=${b.toFixed(2)}:saturation=${s.toFixed(2)}`;
  const balanceFilter = `colorbalance=rs=${rs.toFixed(3)}:gs=${gs.toFixed(3)}:bs=${bs.toFixed(3)}`;

  let finalFilter = `${eqFilter},${balanceFilter}`;

  if (params.filmGrainIntensity && params.filmGrainIntensity > 0) {
    const grainStrength = Math.max(4, Math.min(24, Math.round(params.filmGrainIntensity * 20)));
    finalFilter += `,noise=alls=${grainStrength}:allf=t`;
  }

  if (params.lutPath && fs.existsSync(params.lutPath)) {
    const escapedLut = params.lutPath.replace(/\\/g, "/").replace(/:/g, "\\:");
    finalFilter += `,lut3d=file='${escapedLut}'`;
  }

  return finalFilter;
}

/**
 * Extracts a lightweight 360p snapshot frame from video for AI grading analysis.
 */
async function extractSnapshotFrame(videoPath: string, destJpg: string): Promise<string> {
  const ffmpegExe = getFfmpegPath();
  const dir = path.dirname(destJpg);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await execFileAsync(ffmpegExe, [
    "-y",
    "-ss", "2.0",
    "-i", videoPath,
    "-vframes", "1",
    "-s", "640x360",
    "-q:v", "4",
    destJpg,
  ], { timeout: 10000 });

  return destJpg;
}

/**
 * Resolves color grading parameters:
 * 1. If preset name provided (e.g. 'netflix_cinematic'), returns immediately from lookup.
 * 2. If 'adaptive' or reference video provided, analyzes visual frame via GEMINI_API_KEY_ART_DIRECTOR.
 */
export async function resolveAdaptiveColorGrading(options: {
  videoPath?: string;
  presetOrMode?: string;
  customParams?: Partial<ColorGradeParameters>;
}): Promise<{ filterString: string; parameters: ColorGradeParameters }> {
  const mode = (options.presetOrMode || "netflix_cinematic").toLowerCase().trim();

  // If known preset
  if (PRESET_COLOR_GRADES[mode]) {
    const p = { ...PRESET_COLOR_GRADES[mode]!, ...options.customParams };
    return {
      filterString: buildFfmpegColorFilter(p),
      parameters: p,
    };
  }

  // If cache exists
  if (options.videoPath && gradingCache.has(options.videoPath)) {
    const cached = gradingCache.get(options.videoPath)!;
    return {
      filterString: buildFfmpegColorFilter(cached),
      parameters: cached,
    };
  }

  // Default fallback
  let params: ColorGradeParameters = {
    ...PRESET_COLOR_GRADES.netflix_cinematic!,
    ...options.customParams,
  };

  // If video provided and adaptive grading requested
  if (options.videoPath && fs.existsSync(options.videoPath) && mode === "adaptive") {
    try {
      const snapPath = path.resolve(process.cwd(), `temp_uploads/grade_snap_${Date.now()}.jpg`);
      await extractSnapshotFrame(options.videoPath, snapPath);

      if (fs.existsSync(snapPath)) {
        const imageBase64 = fs.readFileSync(snapPath).toString("base64");
        try { fs.unlinkSync(snapPath); } catch {}

        const aiResponse = await executeGeminiWithFailover({
          service: "ART_DIRECTOR",
          candidateModels: STANDARD_GEMINI_CANDIDATE_MODELS,
          action: async (ai, modelName) => {
            const model = ai.getGenerativeModel({
              model: modelName,
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2,
              },
            });

            const prompt = `You are a professional video colorist. Analyze this frame from a video clip.
Evaluate the skin tones, dynamic range, highlight rolloff, and color temperature.
Provide optimal subtle color grading parameters for FFmpeg native filters.
Return JSON strictly in this schema:
{
  "brightness": number between -0.03 and 0.04 (e.g. 0.02),
  "contrast": number between 1.01 and 1.08 (e.g. 1.04),
  "saturation": number between 0.95 and 1.15 (e.g. 1.08),
  "gamma_r": number between 0.96 and 1.04 (e.g. 1.02),
  "gamma_g": number between 0.98 and 1.02 (e.g. 1.00),
  "gamma_b": number between 0.96 and 1.04 (e.g. 0.98),
  "tone_summary": string
}`;

            const res = await model.generateContent([
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
              prompt,
            ]);

            return res;
          },
          timeoutMs: 15000,
        });

        const text = aiResponse.response.text();
        const parsed = JSON.parse(text);
        if (typeof parsed.contrast === "number") {
          params = {
            brightness: Number(parsed.brightness) || 0.02,
            contrast: Number(parsed.contrast) || 1.04,
            saturation: Number(parsed.saturation) || 1.08,
            gamma_r: Number(parsed.gamma_r) || 1.02,
            gamma_g: Number(parsed.gamma_g) || 1.00,
            gamma_b: Number(parsed.gamma_b) || 0.98,
            presetName: "AI Adaptive (" + (parsed.tone_summary || "Enhanced") + ")",
          };
          if (options.videoPath) {
            gradingCache.set(options.videoPath, params);
          }
        }
      }
    } catch (err: any) {
      console.warn(`[ColorGrade] AI Adaptive fallback to Netflix Cinematic: ${err?.message}`);
    }
  }

  return {
    filterString: buildFfmpegColorFilter(params),
    parameters: params,
  };
}

