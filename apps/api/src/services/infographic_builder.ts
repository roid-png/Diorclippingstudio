import fs from "node:fs";
import path from "node:path";
import { jsonrepair } from "jsonrepair";
import { Resvg } from "@resvg/resvg-js";
import { getTempDir } from "./downloader";
import { HttpError } from "../lib/http-error";
import { executeGeminiWithFailover } from "./api_key_manager";

export interface InfographicMetadata {
  category: string;
  title: string;
  steps: string[];
  speaker_name: string;
}

/**
 * Returns the API key dedicated to Agent 2 (Gemini Art Director).
 */
export function getArtDirectorApiKey(): string {
  return (
    process.env.GEMINI_API_KEY_ART_DIRECTOR ||
    process.env.GEMINI_API_KEY_TRANSCRIPTION ||
    process.env.GEMINI_API_KEY ||
    ""
  );
}

/**
 * Calls Gemini Art Director (Agent 2) to analyze spoken text and output clean infographic metadata JSON.
 */
export async function generateInfographicMetadata(input: {
  clipText: string;
  videoTitle?: string;
}): Promise<InfographicMetadata> {
  const prompt = `
You are an expert art director and infographic designer for high-end podcasts ("The Precision" style).
Analyze this short-form podcast clip transcript and extract clean, punchy visual metadata.

Clip Transcript:
"${input.clipText.slice(0, 3000)}"

Video Title: "${input.videoTitle || "Podcast Episode"}"

Instructions:
1. "category": Short upper-case category badge, max 3 words (e.g., "AI REVOLUTION", "SYSTEM BLUEPRINT", "CAREER SHIFT").
2. "title": Punchy, high-impact headline in UPPERCASE summarizing the core revelation of this clip, max 6 words (e.g., "END-TO-END SYSTEM BLUEPRINT", "WHITE COLLAR JOBS TERANCAM").
3. "steps": Exactly 3 upper-case structured steps or framework phases (e.g., ["01 CONTEXT", "02 ARCHITECTURE", "03 EXECUTION"]).
4. "speaker_name": Name of the speaker in UPPERCASE (e.g. from the context, or "NARASUMBER" if unknown).

Return ONLY a pure JSON object matching this exact schema:
{
  "category": "AI REVOLUTION",
  "title": "END-TO-END SYSTEM BLUEPRINT",
  "steps": ["01 CONTEXT", "02 ARCHITECTURE", "03 EXECUTION"],
  "speaker_name": "NARASUMBER"
}
`;

  const candidateModels = [
    "gemini-3.8-flash",      // Rekomendasi Resmi Google Gemini API
    "gemini-3.5-flash",      // Stabil & Akurat
    "gemini-3.6-flash",      // Alternatif Flash
    "gemini-3.5-flash-lite", // Ringan & Cepat
    "gemini-flash-latest",   // Dynamic Latest Pointer
  ];
  let rawResponse = "";

  try {
    rawResponse = await executeGeminiWithFailover({
      service: "ART_DIRECTOR",
      candidateModels,
      timeoutMs: 12000,
      action: async (ai, mName, keyInfo) => {
        console.log(`[ArtDirector] Mengekstrak metadata infografis via ${mName} (${keyInfo.label})...`);
        const model = ai.getGenerativeModel({
          model: mName,
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        });
        const res = await model.generateContent(prompt);
        return res.response.text();
      },
    });
  } catch (err: any) {
    console.warn(
      `[ArtDirector] Failover exhaust untuk metadata infografis: ${err?.message?.slice(0, 100)}. Menggunakan default fallback.`
    );
  }

  let cleanJson = rawResponse.trim();
  if (cleanJson.startsWith("```json")) {
    cleanJson = cleanJson.replace(/^```json/, "").replace(/```$/, "").trim();
  } else if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.replace(/^```/, "").replace(/```$/, "").trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleanJson);
  } catch {
    try {
      parsed = JSON.parse(jsonrepair(cleanJson));
    } catch {
      parsed = {};
    }
  }

  const sanitizeTitle = (str: string) =>
    str
      .replace(/Â/g, "")
      .replace(/\u00A0/g, " ")
      .replace(/\uFFFD/g, "")
      .replace(/^\(\d+\)\s*/, "")
      .replace(/^\[\d+\]\s*/, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();

  const category = (parsed.category || "THE PRECISION").trim().toUpperCase();
  const title = sanitizeTitle(parsed.title || input.videoTitle || "END-TO-END SYSTEM BLUEPRINT");
  const rawSteps = Array.isArray(parsed.steps) && parsed.steps.length > 0 ? parsed.steps : null;
  const steps = rawSteps
    ? rawSteps.slice(0, 3).map((s: any, idx: number) => String(s || `0${idx + 1} STEP`).trim().toUpperCase())
    : ["01 CONTEXT", "02 ARCHITECTURE", "03 EXECUTION"];

  while (steps.length < 3) {
    steps.push(`0${steps.length + 1} EXECUTION`);
  }

  const speaker_name = (parsed.speaker_name || "NARASUMBER").trim().toUpperCase();

  return {
    category,
    title,
    steps,
    speaker_name,
  };
}

/**
 * Escapes XML/SVG special characters.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Splits title text into 1 or 2 lines for 1080px canvas display.
 */
function splitTitleToLines(title: string, maxCharsPerLine = 24): string[] {
  const words = title.split(" ");
  const lines: string[] = [];
  let cur = "";

  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if ((cur + " " + w).length <= maxCharsPerLine) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

/**
 * Builds an SVG vector string (1080x520) matching the podcast infografis aesthetic.
 */
export function buildInfographicSvg(data: InfographicMetadata): string {
  const safeCategory = escapeXml(data.category);
  const titleLines = splitTitleToLines(data.title, 24).map(escapeXml);

  // Pill steps rendering
  const step0 = escapeXml(data.steps[0] || "01 CONTEXT");
  const step1 = escapeXml(data.steps[1] || "02 ARCHITECTURE");
  const step2 = escapeXml(data.steps[2] || "03 EXECUTION");

  const titleY = titleLines.length === 1 ? 210 : 185;

  return `
<svg width="1080" height="520" viewBox="0 0 1080 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Container Box: Dark semi-transparent (#0d1b1e at 0.88 opacity) with red border (#D32F2F) -->
  <rect x="60" y="20" width="960" height="460" rx="16" ry="16"
        fill="#0d1b1e" fill-opacity="0.88"
        stroke="#D32F2F" stroke-width="3"
        filter="url(#shadow)"/>

  <!-- Top Accent Stripe -->
  <path d="M 76 20 L 1004 20" stroke="#D32F2F" stroke-width="6" stroke-linecap="round"/>

  <!-- Category Tag Badge -->
  <g transform="translate(540, 75)">
    <rect x="-140" y="-18" width="280" height="36" rx="18" ry="18" fill="#152429" stroke="#D32F2F" stroke-width="1.5"/>
    <text x="0" y="6" fill="#D32F2F" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="18" text-anchor="middle" letter-spacing="2.5">[ ${safeCategory} ]</text>
  </g>

  <!-- Main Headline Title -->
  <text x="540" y="${titleY}" fill="#FFFFFF" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="36" text-anchor="middle" letter-spacing="1">
    ${titleLines[0]}
  </text>
  ${
    titleLines.length > 1
      ? `<text x="540" y="${titleY + 48}" fill="#FFFFFF" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="36" text-anchor="middle" letter-spacing="1">${titleLines[1]}</text>`
      : ""
  }

  <!-- Step Flow / Horizontal Indicators -->
  <g transform="translate(540, 375)">
    <!-- Step 1 (Active / Red Pill) -->
    <g transform="translate(-320, 0)">
      <rect x="-105" y="-20" width="210" height="40" rx="20" ry="20" fill="#D32F2F"/>
      <text x="0" y="6" fill="#FFFFFF" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="800" font-size="16" text-anchor="middle" letter-spacing="1">${step0}</text>
    </g>

    <!-- Arrow 1 -->
    <text x="-185" y="7" fill="#FFFFFF" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="20" text-anchor="middle">➔</text>

    <!-- Step 2 (Inactive / Dark Pill) -->
    <g transform="translate(0, 0)">
      <rect x="-115" y="-20" width="230" height="40" rx="20" ry="20" fill="#152429" stroke="#2a3f47" stroke-width="1.5"/>
      <text x="0" y="6" fill="#94A3B8" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="15" text-anchor="middle" letter-spacing="1">${step1}</text>
    </g>

    <!-- Arrow 2 -->
    <text x="145" y="7" fill="#64748B" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="20" text-anchor="middle">➔</text>

    <!-- Step 3 (Inactive / Dark Pill) -->
    <g transform="translate(320, 0)">
      <rect x="-105" y="-20" width="210" height="40" rx="20" ry="20" fill="#152429" stroke="#2a3f47" stroke-width="1.5"/>
      <text x="0" y="6" fill="#94A3B8" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="15" text-anchor="middle" letter-spacing="1">${step2}</text>
    </g>
  </g>
</svg>
`.trim();
}

/**
 * Generates an infographic SVG and renders it to a transparent PNG file via Resvg.
 * Returns the absolute path of the generated PNG file.
 */
export async function renderInfographicPng(input: {
  clipId: string;
  metadata: InfographicMetadata;
  outputPngPath?: string;
}): Promise<string> {
  const tempDir = getTempDir("temp/infographics");
  const targetPath = input.outputPngPath || path.join(tempDir, `infographic_${input.clipId}.png`);

  const svgContent = buildInfographicSvg(input.metadata);

  const resvg = new Resvg(svgContent, {
    fitTo: { mode: "width", value: 1080 },
    background: "rgba(0,0,0,0)",
  });

  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  fs.writeFileSync(targetPath, pngBuffer);
  console.log(`[ArtDirector] Infografis PNG berhasil dirender: ${targetPath} (${(pngBuffer.length / 1024).toFixed(1)} KB)`);

  return targetPath;
}
