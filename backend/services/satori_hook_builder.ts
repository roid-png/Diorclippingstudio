import fs from "node:fs";
import path from "node:path";
import satori from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import * as culori from "culori";
import * as LucideIcons from "lucide-static";
import type { ExecutiveHookMetadata, ExplanationBeat } from "./motion_director";
import { cleanTextForRender } from "./motion_director";
import { getFontsDirPath } from "./ass-generator.service";

let cachedCinzelFont: Buffer | null = null;
let cachedMontserratFont: Buffer | null = null;
let cachedCinemaFramePath: string | null = null;

function loadFonts() {
  if (cachedCinzelFont && cachedMontserratFont) {
    return { cinzel: cachedCinzelFont, montserrat: cachedMontserratFont };
  }
  const fontsDir = getFontsDirPath();

  const cinzelCandidate = path.join(fontsDir, "Cinzel-Bold.ttf");
  const montserratCandidate = path.join(fontsDir, "Montserrat-ExtraBold.ttf");

  if (fs.existsSync(cinzelCandidate)) {
    cachedCinzelFont = fs.readFileSync(cinzelCandidate);
  } else {
    cachedCinzelFont = fs.readFileSync(montserratCandidate);
  }

  cachedMontserratFont = fs.readFileSync(montserratCandidate);
  return { cinzel: cachedCinzelFont, montserrat: cachedMontserratFont };
}

/**
 * Computes harmonious visual colors (glow, border, subtle background tint) using culori.
 */
export function getHarmoniousColors(accentHex = "#E50914") {
  const parsed = culori.parse(accentHex) || culori.parse("#E50914");
  const hex = culori.formatHex(parsed) || "#E50914";
  return {
    hex,
    bg: culori.formatRgb({ ...parsed, alpha: 0.16 }),
    glow: culori.formatRgb({ ...parsed, alpha: 0.38 }),
    subtleBg: culori.formatRgb({ ...parsed, alpha: 0.08 }),
  };
}

/**
 * Helper to split headline into 1 or 2 lines cleanly.
 */
function splitHeadlineLines(text: string, maxCharsPerLine = 24): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length <= 3 && text.length <= maxCharsPerLine) return [text];
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(" ");
  const line2 = words.slice(mid).join(" ");
  return line2 ? [line1, line2] : [line1];
}

/**
 * [FASE 2: CARD 0 - GUARANTEED TOP HOOK BANNER (1080x520 px)]
 * Merender Top Hook Banner sinematik berlatar glassmorphism semi-transparan:
 * 1. Top Badge Pill (Y=90): Kotak kapsul merah menyala (#E50914) dengan teks kategori huruf tebal (22px).
 * 2. Main Hook Title (Y=180-320): Judul besar provokatif (50-52px, Cinzel-Bold).
 * 3. Accent Line & Subtext (Y=360): Garis aksen merah + subtext abu-abu terang (#CBD5E1, 24px).
 */
export interface TopHookBannerOptions {
  hook_category?: string;
  category?: string;
  hook_headline?: string;
  headline?: string;
  hook_subtext?: string;
  subtext?: string;
  accent_hex?: string;
  accentColor?: string;
  outputPath: string;
}

export async function renderTopHookBannerPng(options: TopHookBannerOptions): Promise<string> {
  const t0 = Date.now();
  const rawHex = options.accent_hex || options.accentColor || "#E50914";
  const accentHex = rawHex && /^#[0-9A-Fa-f]{6}$/.test(rawHex) ? rawHex : "#E50914";

  // Sanitize all inputs with cleanTextForRender
  const rawCat = options.hook_category || options.category || "FAKTA LAPANGAN // KLIMAKS";
  const category = (cleanTextForRender(rawCat) || "FAKTA LAPANGAN // KLIMAKS").toUpperCase();

  const rawHead = options.hook_headline || options.headline || "FAKTA LAPANGAN TERVERIFIKASI";
  let headline = cleanTextForRender(rawHead);
  if (!headline || headline.length < 4 || headline.includes(".mp4")) {
    headline = "FAKTA LAPANGAN TERVERIFIKASI";
  }
  headline = headline.toUpperCase();

  const rawSub = options.hook_subtext || options.subtext || "DATA KUNCI TERVERIFIKASI";
  const subtext = (cleanTextForRender(rawSub) || "DATA KUNCI TERVERIFIKASI").toUpperCase();

  const outDir = path.dirname(options.outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const lines = splitHeadlineLines(headline, 22);

  let renderedSuccessfully = false;
  try {
    const { cinzel, montserrat } = loadFonts();
    const colors = getHarmoniousColors(accentHex);

    const template = html`
      <div
        style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 1080px; height: 520px; background: transparent; padding: 20px;"
      >
        <!-- Glassmorphism Dark Plate -->
        <div
          style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 980px; height: 440px; background: rgba(10, 15, 18, 0.84); border: 1.5px solid rgba(255, 255, 255, 0.22); border-radius: 24px; padding: 24px 40px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.88);"
        >
          <!-- Top Badge Pill (Y=90) -->
          <div
            style="display: flex; align-items: center; justify-content: center; background: ${colors.hex}; border-radius: 50px; padding: 7px 28px; margin-bottom: 20px; box-shadow: 0 0 20px ${colors.glow};"
          >
            <span
              style="font-family: Montserrat; font-weight: 800; font-size: 22px; color: #FFFFFF; letter-spacing: 3px;"
            >
              ${category}
            </span>
          </div>

          <!-- Main Hook Title (Y=180-320) -->
          <div
            style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 18px;"
          >
            <div
              style="display: flex; font-family: Cinzel; font-weight: 700; font-size: 50px; color: #FFFFFF; letter-spacing: 2.5px; text-align: center; line-height: 1.25; text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95);"
            >
              ${lines[0] || ""}
            </div>
            <div
              style="display: ${lines[1] ? "flex" : "none"}; font-family: Cinzel; font-weight: 700; font-size: 50px; color: #FFFFFF; letter-spacing: 2.5px; text-align: center; line-height: 1.25; text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95); margin-top: 6px;"
            >
              ${lines[1] || ""}
            </div>
          </div>

          <!-- Accent Line & Subtext (Y=360) -->
          <div
            style="display: flex; width: 180px; height: 3px; background: ${colors.hex}; margin-bottom: 14px; box-shadow: 0 0 12px ${colors.hex}; border-radius: 2px;"
          ></div>

          <div
            style="display: flex; align-items: center; justify-content: center;"
          >
            <span
              style="font-family: Montserrat; font-weight: 800; font-size: 24px; color: #CBD5E1; letter-spacing: 2px;"
            >
              ${subtext}
            </span>
          </div>
        </div>
      </div>
    `;

    const svg = await satori(template as any, {
      width: 1080,
      height: 520,
      fonts: [
        { name: "Cinzel", data: cinzel, weight: 700, style: "normal" },
        { name: "Montserrat", data: montserrat, weight: 800, style: "normal" },
      ],
    });

    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
    const rawPng = resvg.render().asPng();

    await sharp(rawPng)
      .png({ compressionLevel: 6 })
      .toFile(options.outputPath);

    if (fs.existsSync(options.outputPath) && fs.statSync(options.outputPath).size >= 4096) {
      renderedSuccessfully = true;
    }
  } catch (satoriErr: any) {
    console.warn("[TopHookBanner] Satori render notice:", satoriErr?.message);
  }

  // Bulletproof Sharp Pure SVG Buffer Fallback
  if (!renderedSuccessfully) {
    const escapedCategory = category.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const escapedLine1 = (lines[0] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const escapedLine2 = (lines[1] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const escapedSubtext = subtext.replace(/&/g, "&amp;").replace(/</g, "&lt;");

    const titleSvg = lines.length === 1
      ? `<text x="540" y="270" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="52" fill="#FFFFFF" letter-spacing="2.5" filter="url(#dropShadow)">${escapedLine1}</text>`
      : `<text x="540" y="240" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="50" fill="#FFFFFF" letter-spacing="2.5" filter="url(#dropShadow)">${escapedLine1}</text>
         <text x="540" y="302" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="50" fill="#FFFFFF" letter-spacing="2.5" filter="url(#dropShadow)">${escapedLine2}</text>`;

    const pureSvg = `
<svg width="1080" height="520" viewBox="0 0 1080 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.9" />
    </filter>
  </defs>

  <rect x="50" y="40" width="980" height="440" rx="24" fill="rgba(10, 15, 18, 0.85)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1.5" filter="url(#dropShadow)" />

  <g transform="translate(540, 105)">
    <rect x="-180" y="-22" width="360" height="44" rx="22" fill="${accentHex}" filter="url(#dropShadow)" />
    <text x="0" y="7" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="22" fill="#FFFFFF" letter-spacing="3">${escapedCategory}</text>
  </g>

  ${titleSvg}

  <rect x="440" y="360" width="200" height="3" rx="1.5" fill="${accentHex}" />
  <text x="540" y="408" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="24" fill="#CBD5E1" letter-spacing="2">${escapedSubtext}</text>
</svg>
`;

    const resvg = new Resvg(pureSvg, { fitTo: { mode: "width", value: 1080 } });
    const buffer = resvg.render().asPng();

    await sharp(buffer)
      .png({ compressionLevel: 6 })
      .toFile(options.outputPath);
  }

  const finalStat = fs.statSync(options.outputPath);
  const elapsed = Date.now() - t0;
  console.log(`[Card0Hook] card_0_hook.png dibuat: ${options.outputPath} (${finalStat.size} bytes, ${elapsed}ms)`);
  return options.outputPath;
}

/**
 * [FASE 2: CARD 1 - TIMELINE / CONTEXT CARD (1080x520 px)]
 * - Header: [ POIN 01 // KONTEKS UTAMA ] + Indikator Hijau/Merah menyala
 * - Judul Poin 1 (Cinzel-Bold 38px)
 * - Visual: 3 kotak alur horizontal (Box 1 menyala terang)
 * - Progress Bar: 33%
 */
export interface Beat1TimelineOptions {
  step_badge?: string;
  title?: string;
  steps?: string[];
  accent_hex?: string;
  outputPath: string;
}

export async function renderBeat1TimelineCardPng(options: Beat1TimelineOptions): Promise<string> {
  const t0 = Date.now();
  const accentHex = options.accent_hex && /^#[0-9A-Fa-f]{6}$/.test(options.accent_hex) ? options.accent_hex : "#E50914";
  const stepBadge = (cleanTextForRender(options.step_badge) || "POIN 01 // SUBSTANSI").toUpperCase();
  const title = (cleanTextForRender(options.title) || "SOROTAN UTAMA TOPIK").toUpperCase();

  const rawSteps = options.steps && options.steps.length >= 3
    ? options.steps
    : ["TAHAP AWAL", "PROSES INTI", "RESOLUSI AKHIR"];
  const steps = rawSteps.map((s) => (cleanTextForRender(s) || "TAHAP").toUpperCase().slice(0, 16));

  const outDir = path.dirname(options.outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const lines = splitHeadlineLines(title, 24);
  let renderedSuccessfully = false;

  try {
    const { cinzel, montserrat } = loadFonts();
    const colors = getHarmoniousColors(accentHex);

    const template = html`
      <div
        style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 1080px; height: 520px; background: transparent; padding: 20px;"
      >
        <div
          style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; width: 980px; height: 440px; background: rgba(10, 15, 22, 0.88); border: 1.5px solid rgba(255, 255, 255, 0.22); border-radius: 24px; padding: 22px 36px; box-shadow: 0 16px 44px rgba(0, 0, 0, 0.92);"
        >
          <!-- Top Header Row -->
          <div
            style="display: flex; align-items: center; justify-content: space-between; width: 908px; margin-bottom: 8px;"
          >
            <div
              style="display: flex; align-items: center; background: ${colors.hex}; border-radius: 50px; padding: 6px 22px; box-shadow: 0 0 16px ${colors.glow};"
            >
              <div
                style="display: flex; width: 10px; height: 10px; border-radius: 5px; background: #22C55E; margin-right: 10px; box-shadow: 0 0 10px #22C55E;"
              ></div>
              <span
                style="font-family: Montserrat; font-weight: 800; font-size: 18px; color: #FFFFFF; letter-spacing: 2px;"
              >
                ${stepBadge}
              </span>
            </div>
            <div
              style="display: flex; align-items: center; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 50px; padding: 5px 16px;"
            >
              <span
                style="font-family: Montserrat; font-weight: 700; font-size: 15px; color: #94A3B8; letter-spacing: 1px;"
              >
                33% PROGRES
              </span>
            </div>
          </div>

          <!-- Main Title -->
          <div
            style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 908px; margin-bottom: 8px;"
          >
            <div
              style="display: flex; font-family: Cinzel; font-weight: 700; font-size: 38px; color: #FFFFFF; letter-spacing: 2px; text-align: center; line-height: 1.22; text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95);"
            >
              ${lines[0] || ""}
            </div>
            <div
              style="display: ${lines[1] ? "flex" : "none"}; font-family: Cinzel; font-weight: 700; font-size: 38px; color: #FFFFFF; letter-spacing: 2px; text-align: center; line-height: 1.22; text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95); margin-top: 4px;"
            >
              ${lines[1] || ""}
            </div>
          </div>

          <!-- Timeline 3-Flow Horizontal Boxes -->
          <div
            style="display: flex; align-items: center; justify-content: center; width: 908px; margin-bottom: 12px;"
          >
            <!-- Box 1 (Active Illuminated) -->
            <div
              style="display: flex; align-items: center; justify-content: center; background: ${colors.hex}; border: 1.5px solid #FFFFFF; border-radius: 12px; padding: 10px 22px; box-shadow: 0 0 16px ${colors.glow};"
            >
              <span
                style="font-family: Montserrat; font-weight: 800; font-size: 17px; color: #FFFFFF; letter-spacing: 1.5px;"
              >
                ${steps[0]}
              </span>
            </div>

            <!-- Arrow 1 -->
            <span
              style="font-family: Montserrat; font-weight: 900; font-size: 22px; color: ${colors.hex}; margin: 0 12px;"
            >
              ➔
            </span>

            <!-- Box 2 -->
            <div
              style="display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 12px; padding: 10px 20px;"
            >
              <span
                style="font-family: Montserrat; font-weight: 700; font-size: 16px; color: #94A3B8; letter-spacing: 1.5px;"
              >
                ${steps[1]}
              </span>
            </div>

            <!-- Arrow 2 -->
            <span
              style="font-family: Montserrat; font-weight: 900; font-size: 22px; color: rgba(255, 255, 255, 0.35); margin: 0 12px;"
            >
              ➔
            </span>

            <!-- Box 3 -->
            <div
              style="display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 12px; padding: 10px 20px;"
            >
              <span
                style="font-family: Montserrat; font-weight: 700; font-size: 16px; color: #94A3B8; letter-spacing: 1.5px;"
              >
                ${steps[2]}
              </span>
            </div>
          </div>

          <!-- Bottom Stepper Progress Bar (33%) -->
          <div
            style="display: flex; width: 908px; height: 6px; background: rgba(255, 255, 255, 0.12); border-radius: 3px; overflow: hidden;"
          >
            <div
              style="display: flex; width: 33%; height: 6px; background: ${colors.hex}; box-shadow: 0 0 12px ${colors.glow}; border-radius: 3px;"
            ></div>
          </div>
        </div>
      </div>
    `;

    const svg = await satori(template as any, {
      width: 1080,
      height: 520,
      fonts: [
        { name: "Cinzel", data: cinzel, weight: 700, style: "normal" },
        { name: "Montserrat", data: montserrat, weight: 800, style: "normal" },
      ],
    });

    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
    const rawPng = resvg.render().asPng();

    await sharp(rawPng).png({ compressionLevel: 6 }).toFile(options.outputPath);
    if (fs.existsSync(options.outputPath) && fs.statSync(options.outputPath).size >= 4096) {
      renderedSuccessfully = true;
    }
  } catch (err: any) {
    console.warn("[Card1Timeline] Satori notice:", err?.message);
  }

  // Pure SVG Fallback
  if (!renderedSuccessfully) {
    const escapedStep = stepBadge.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const escapedLine1 = (lines[0] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const escapedLine2 = (lines[1] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const s0 = (steps[0] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const s1 = (steps[1] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const s2 = (steps[2] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

    const titleSvg = lines.length === 1
      ? `<text x="540" y="240" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="40" fill="#FFFFFF" letter-spacing="2">${escapedLine1}</text>`
      : `<text x="540" y="215" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="38" fill="#FFFFFF" letter-spacing="2">${escapedLine1}</text>
         <text x="540" y="265" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="38" fill="#FFFFFF" letter-spacing="2">${escapedLine2}</text>`;

    const pureSvg = `
<svg width="1080" height="520" viewBox="0 0 1080 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow1" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.9" />
    </filter>
  </defs>

  <rect x="50" y="40" width="980" height="440" rx="24" fill="rgba(10, 15, 22, 0.88)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1.5" filter="url(#shadow1)" />

  <!-- Header -->
  <g transform="translate(86, 75)">
    <rect x="0" y="0" width="310" height="38" rx="19" fill="${accentHex}" filter="url(#shadow1)" />
    <circle cx="22" cy="19" r="5" fill="#22C55E" />
    <text x="165" y="25" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="17" fill="#FFFFFF" letter-spacing="2">${escapedStep}</text>
  </g>
  <text x="994" y="100" text-anchor="end" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="15" fill="#94A3B8">33% PROGRES</text>

  ${titleSvg}

  <!-- Flow Boxes -->
  <g transform="translate(140, 330)">
    <!-- Box 1 Active -->
    <rect x="0" y="0" width="220" height="44" rx="12" fill="${accentHex}" stroke="#FFFFFF" stroke-width="1.5" filter="url(#shadow1)" />
    <text x="110" y="28" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="16" fill="#FFFFFF" letter-spacing="1.5">${s0}</text>

    <text x="250" y="30" font-family="Montserrat, Arial, sans-serif" font-weight="900" font-size="22" fill="${accentHex}">➔</text>

    <!-- Box 2 -->
    <rect x="280" y="0" width="220" height="44" rx="12" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" stroke-width="1" />
    <text x="390" y="28" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="15" fill="#94A3B8" letter-spacing="1.5">${s1}</text>

    <text x="530" y="30" font-family="Montserrat, Arial, sans-serif" font-weight="900" font-size="22" fill="rgba(255,255,255,0.35)">➔</text>

    <!-- Box 3 -->
    <rect x="560" y="0" width="220" height="44" rx="12" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" stroke-width="1" />
    <text x="670" y="28" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="15" fill="#94A3B8" letter-spacing="1.5">${s2}</text>
  </g>

  <!-- Progress Bar (33%) -->
  <rect x="86" y="440" width="908" height="6" rx="3" fill="rgba(255,255,255,0.12)" />
  <rect x="86" y="440" width="300" height="6" rx="3" fill="${accentHex}" />
</svg>
`;

    const resvg = new Resvg(pureSvg, { fitTo: { mode: "width", value: 1080 } });
    const buffer = resvg.render().asPng();
    await sharp(buffer).png({ compressionLevel: 6 }).toFile(options.outputPath);
  }

  const finalStat = fs.statSync(options.outputPath);
  const elapsed = Date.now() - t0;
  console.log(`[Card1Beat1] card_1_beat1.png dibuat: ${options.outputPath} (${finalStat.size} bytes, ${elapsed}ms)`);
  return options.outputPath;
}

/**
 * [FASE 2: CARD 2 - VERSUS / CONTRAST CARD (1080x520 px)]
 * - Header: [ POIN 02 // FAKTA VS TUDUHAN ]
 * - Judul Poin 2 (Cinzel-Bold 38px)
 * - Visual: 2 Kotak Perbandingan Berdampingan (Kiri: FAKTA vs Kanan: TUDUHAN)
 * - Progress Bar: 66%
 */
export interface Beat2VersusOptions {
  step_badge?: string;
  title?: string;
  leftTitle?: string;
  leftText?: string;
  rightTitle?: string;
  rightText?: string;
  accent_hex?: string;
  outputPath: string;
}

export async function renderBeat2VersusCardPng(options: Beat2VersusOptions): Promise<string> {
  const t0 = Date.now();
  const accentHex = options.accent_hex && /^#[0-9A-Fa-f]{6}$/.test(options.accent_hex) ? options.accent_hex : "#E50914";
  const stepBadge = (cleanTextForRender(options.step_badge) || "POIN 02 // ANALISIS DATA").toUpperCase();
  const title = (cleanTextForRender(options.title) || "KOMPARASI DUA PERSPEKTIF").toUpperCase();

  const leftTag = (cleanTextForRender(options.leftTitle) || "FAKTA UTAMA").toUpperCase();
  const leftText = (cleanTextForRender(options.leftText) || "ARGUMEN KUNCI PEMBICARA").toUpperCase().slice(0, 36);

  const rightTag = (cleanTextForRender(options.rightTitle) || "ISU / KONTRA").toUpperCase();
  const rightText = (cleanTextForRender(options.rightText) || "TANTANGAN DI LAPANGAN").toUpperCase().slice(0, 36);

  const outDir = path.dirname(options.outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const lines = splitHeadlineLines(title, 24);
  let renderedSuccessfully = false;

  try {
    const { cinzel, montserrat } = loadFonts();
    const colors = getHarmoniousColors(accentHex);

    const template = html`
      <div
        style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 1080px; height: 520px; background: transparent; padding: 20px;"
      >
        <div
          style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; width: 980px; height: 440px; background: rgba(10, 15, 22, 0.88); border: 1.5px solid rgba(255, 255, 255, 0.22); border-radius: 24px; padding: 22px 36px; box-shadow: 0 16px 44px rgba(0, 0, 0, 0.92);"
        >
          <!-- Top Header Row -->
          <div
            style="display: flex; align-items: center; justify-content: space-between; width: 908px; margin-bottom: 8px;"
          >
            <div
              style="display: flex; align-items: center; background: #F59E0B; border-radius: 50px; padding: 6px 22px; box-shadow: 0 0 16px rgba(245, 158, 11, 0.45);"
            >
              <span
                style="font-family: Montserrat; font-weight: 800; font-size: 18px; color: #FFFFFF; letter-spacing: 2px;"
              >
                ${stepBadge}
              </span>
            </div>
            <div
              style="display: flex; align-items: center; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 50px; padding: 5px 16px;"
            >
              <span
                style="font-family: Montserrat; font-weight: 700; font-size: 15px; color: #94A3B8; letter-spacing: 1px;"
              >
                66% PROGRES
              </span>
            </div>
          </div>

          <!-- Main Title -->
          <div
            style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 908px; margin-bottom: 8px;"
          >
            <div
              style="display: flex; font-family: Cinzel; font-weight: 700; font-size: 38px; color: #FFFFFF; letter-spacing: 2px; text-align: center; line-height: 1.22; text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95);"
            >
              ${lines[0] || ""}
            </div>
            <div
              style="display: ${lines[1] ? "flex" : "none"}; font-family: Cinzel; font-weight: 700; font-size: 38px; color: #FFFFFF; letter-spacing: 2px; text-align: center; line-height: 1.22; text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95); margin-top: 4px;"
            >
              ${lines[1] || ""}
            </div>
          </div>

          <!-- Versus Comparison 2 Boxes -->
          <div
            style="display: flex; align-items: center; justify-content: space-between; width: 908px; margin-bottom: 12px;"
          >
            <!-- Left Box (Fakta) -->
            <div
              style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 418px; height: 104px; background: rgba(32, 178, 170, 0.14); border: 1.5px solid #20B2AA; border-radius: 14px; padding: 10px 16px; box-shadow: 0 0 16px rgba(32, 178, 170, 0.22);"
            >
              <span
                style="font-family: Montserrat; font-weight: 800; font-size: 13px; color: #20B2AA; letter-spacing: 2px; margin-bottom: 6px;"
              >
                ${leftTag}
              </span>
              <span
                style="font-family: Montserrat; font-weight: 800; font-size: 24px; color: #F8FAFC; text-align: center; line-height: 1.25;"
              >
                ${leftText}
              </span>
            </div>

            <!-- VS Pill in Center -->
            <div
              style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 22px; background: ${colors.hex}; border: 1.5px solid #FFFFFF; box-shadow: 0 0 14px ${colors.glow};"
            >
              <span
                style="font-family: Montserrat; font-weight: 900; font-size: 16px; color: #FFFFFF;"
              >
                VS
              </span>
            </div>

            <!-- Right Box (Tuduhan) -->
            <div
              style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 418px; height: 104px; background: rgba(229, 9, 20, 0.14); border: 1.5px solid #E50914; border-radius: 14px; padding: 10px 16px; box-shadow: 0 0 16px rgba(229, 9, 20, 0.22);"
            >
              <span
                style="font-family: Montserrat; font-weight: 800; font-size: 13px; color: #EF4444; letter-spacing: 2px; margin-bottom: 6px;"
              >
                ${rightTag}
              </span>
              <span
                style="font-family: Montserrat; font-weight: 800; font-size: 24px; color: #F8FAFC; text-align: center; line-height: 1.25;"
              >
                ${rightText}
              </span>
            </div>
          </div>

          <!-- Bottom Stepper Progress Bar (66%) -->
          <div
            style="display: flex; width: 908px; height: 6px; background: rgba(255, 255, 255, 0.12); border-radius: 3px; overflow: hidden;"
          >
            <div
              style="display: flex; width: 66%; height: 6px; background: #F59E0B; box-shadow: 0 0 12px rgba(245, 158, 11, 0.5); border-radius: 3px;"
            ></div>
          </div>
        </div>
      </div>
    `;

    const svg = await satori(template as any, {
      width: 1080,
      height: 520,
      fonts: [
        { name: "Cinzel", data: cinzel, weight: 700, style: "normal" },
        { name: "Montserrat", data: montserrat, weight: 800, style: "normal" },
      ],
    });

    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
    const rawPng = resvg.render().asPng();

    await sharp(rawPng).png({ compressionLevel: 6 }).toFile(options.outputPath);
    if (fs.existsSync(options.outputPath) && fs.statSync(options.outputPath).size >= 4096) {
      renderedSuccessfully = true;
    }
  } catch (err: any) {
    console.warn("[Card2Versus] Satori notice:", err?.message);
  }

  // Pure SVG Fallback
  if (!renderedSuccessfully) {
    const escapedStep = stepBadge.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const escapedLine1 = (lines[0] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const escapedLine2 = (lines[1] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const eLeftTag = leftTag.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const eLeftText = leftText.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const eRightTag = rightTag.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const eRightText = rightText.replace(/&/g, "&amp;").replace(/</g, "&lt;");

    const titleSvg = lines.length === 1
      ? `<text x="540" y="240" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="40" fill="#FFFFFF" letter-spacing="2">${escapedLine1}</text>`
      : `<text x="540" y="215" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="38" fill="#FFFFFF" letter-spacing="2">${escapedLine1}</text>
         <text x="540" y="265" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="38" fill="#FFFFFF" letter-spacing="2">${escapedLine2}</text>`;

    const pureSvg = `
<svg width="1080" height="520" viewBox="0 0 1080 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow2" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.9" />
    </filter>
  </defs>

  <rect x="50" y="40" width="980" height="440" rx="24" fill="rgba(10, 15, 22, 0.88)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1.5" filter="url(#shadow2)" />

  <g transform="translate(86, 75)">
    <rect x="0" y="0" width="330" height="38" rx="19" fill="#F59E0B" filter="url(#shadow2)" />
    <text x="165" y="25" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="17" fill="#FFFFFF" letter-spacing="2">${escapedStep}</text>
  </g>
  <text x="994" y="100" text-anchor="end" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="15" fill="#94A3B8">66% PROGRES</text>

  ${titleSvg}

  <!-- Versus Row -->
  <g transform="translate(86, 310)">
    <!-- Left Box -->
    <rect x="0" y="0" width="418" height="100" rx="14" fill="rgba(32, 178, 170, 0.14)" stroke="#20B2AA" stroke-width="1.5" />
    <text x="209" y="30" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="13" fill="#20B2AA" letter-spacing="2">${eLeftTag}</text>
    <text x="209" y="66" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="24" fill="#F8FAFC">${eLeftText}</text>

    <!-- VS Badge -->
    <circle cx="454" cy="50" r="22" fill="${accentHex}" stroke="#FFFFFF" stroke-width="1.5" filter="url(#shadow2)" />
    <text x="454" y="56" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="900" font-size="16" fill="#FFFFFF">VS</text>

    <!-- Right Box -->
    <rect x="490" y="0" width="418" height="100" rx="14" fill="rgba(229, 9, 20, 0.14)" stroke="#E50914" stroke-width="1.5" />
    <text x="699" y="30" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="13" fill="#EF4444" letter-spacing="2">${eRightTag}</text>
    <text x="699" y="66" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="24" fill="#F8FAFC">${eRightText}</text>
  </g>

  <!-- Progress Bar (66%) -->
  <rect x="86" y="440" width="908" height="6" rx="3" fill="rgba(255,255,255,0.12)" />
  <rect x="86" y="440" width="600" height="6" rx="3" fill="#F59E0B" />
</svg>
`;

    const resvg = new Resvg(pureSvg, { fitTo: { mode: "width", value: 1080 } });
    const buffer = resvg.render().asPng();
    await sharp(buffer).png({ compressionLevel: 6 }).toFile(options.outputPath);
  }

  const finalStat = fs.statSync(options.outputPath);
  const elapsed = Date.now() - t0;
  console.log(`[Card2Beat2] card_2_beat2.png dibuat: ${options.outputPath} (${finalStat.size} bytes, ${elapsed}ms)`);
  return options.outputPath;
}

/**
 * [FASE 2: CARD 3 - DATA & KEY TAKEAWAY CARD (1080x520 px)]
 * - Header: [ POIN 03 // DATA HISTORIS ]
 * - Judul Poin 3 (Cinzel-Bold 38px)
 * - Visual: Highlight angka/fakta kunci (1999 - 2003 // KORPORASI & PEMILIK MODAL)
 * - Progress Bar: 100%
 */
export interface Beat3DataOptions {
  step_badge?: string;
  title?: string;
  highlight_metric?: string;
  accent_hex?: string;
  outputPath: string;
}

export async function renderBeat3DataCardPng(options: Beat3DataOptions): Promise<string> {
  const t0 = Date.now();
  const accentHex = options.accent_hex && /^#[0-9A-Fa-f]{6}$/.test(options.accent_hex) ? options.accent_hex : "#20B2AA";
  const stepBadge = (cleanTextForRender(options.step_badge) || "POIN 03 // DATA HISTORIS").toUpperCase();
  const title = (cleanTextForRender(options.title) || "EKSPANSI SAWIT 1999 - 2003").toUpperCase();
  const highlightMetric = (cleanTextForRender(options.highlight_metric) || "1999 - 2003 // KORPORASI & PEMILIK MODAL").toUpperCase().slice(0, 42);

  const outDir = path.dirname(options.outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const lines = splitHeadlineLines(title, 24);
  let renderedSuccessfully = false;

  try {
    const { cinzel, montserrat } = loadFonts();

    const template = html`
      <div
        style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 1080px; height: 520px; background: transparent; padding: 20px;"
      >
        <div
          style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; width: 980px; height: 440px; background: rgba(10, 15, 22, 0.88); border: 1.5px solid rgba(255, 255, 255, 0.22); border-radius: 24px; padding: 22px 36px; box-shadow: 0 16px 44px rgba(0, 0, 0, 0.92);"
        >
          <!-- Top Header Row -->
          <div
            style="display: flex; align-items: center; justify-content: space-between; width: 908px; margin-bottom: 8px;"
          >
            <div
              style="display: flex; align-items: center; background: #20B2AA; border-radius: 50px; padding: 6px 22px; box-shadow: 0 0 16px rgba(32, 178, 170, 0.45);"
            >
              <span
                style="font-family: Montserrat; font-weight: 800; font-size: 18px; color: #FFFFFF; letter-spacing: 2px;"
              >
                ${stepBadge}
              </span>
            </div>
            <div
              style="display: flex; align-items: center; background: rgba(32, 178, 170, 0.15); border: 1px solid #20B2AA; border-radius: 50px; padding: 5px 16px;"
            >
              <span
                style="font-family: Montserrat; font-weight: 800; font-size: 15px; color: #20B2AA; letter-spacing: 1px;"
              >
                100% PROGRES
              </span>
            </div>
          </div>

          <!-- Main Title -->
          <div
            style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 908px; margin-bottom: 8px;"
          >
            <div
              style="display: flex; font-family: Cinzel; font-weight: 700; font-size: 38px; color: #FFFFFF; letter-spacing: 2px; text-align: center; line-height: 1.22; text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95);"
            >
              ${lines[0] || ""}
            </div>
            <div
              style="display: ${lines[1] ? "flex" : "none"}; font-family: Cinzel; font-weight: 700; font-size: 38px; color: #FFFFFF; letter-spacing: 2px; text-align: center; line-height: 1.22; text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95); margin-top: 4px;"
            >
              ${lines[1] || ""}
            </div>
          </div>

          <!-- Data Highlight Card Plate -->
          <div
            style="display: flex; align-items: center; justify-content: space-between; width: 908px; background: rgba(15, 23, 30, 0.88); border: 1.5px solid rgba(255, 255, 255, 0.25); border-radius: 16px; padding: 14px 28px; box-shadow: 0 8px 24px rgba(0,0,0,0.7); margin-bottom: 12px;"
          >
            <div style="display: flex; flex-direction: column; align-items: flex-start;">
              <span
                style="font-family: Montserrat; font-weight: 800; font-size: 13px; color: #20B2AA; letter-spacing: 2px; margin-bottom: 4px;"
              >
                TEMUAN DATA &amp; DOKUMEN KUNCI
              </span>
              <span
                style="font-family: Montserrat; font-weight: 800; font-size: 24px; color: #F8FAFC; letter-spacing: 1.5px;"
              >
                ${highlightMetric}
              </span>
            </div>

            <div
              style="display: flex; align-items: center; background: rgba(32, 178, 170, 0.15); border: 1px solid #20B2AA; border-radius: 20px; padding: 6px 18px;"
            >
              <span
                style="font-family: Montserrat; font-weight: 800; font-size: 15px; color: #20B2AA; letter-spacing: 1px;"
              >
                TERVERIFIKASI
              </span>
            </div>
          </div>

          <!-- Bottom Stepper Progress Bar (100%) -->
          <div
            style="display: flex; width: 908px; height: 6px; background: rgba(255, 255, 255, 0.12); border-radius: 3px; overflow: hidden;"
          >
            <div
              style="display: flex; width: 100%; height: 6px; background: #20B2AA; box-shadow: 0 0 12px rgba(32, 178, 170, 0.6); border-radius: 3px;"
            ></div>
          </div>
        </div>
      </div>
    `;

    const svg = await satori(template as any, {
      width: 1080,
      height: 520,
      fonts: [
        { name: "Cinzel", data: cinzel, weight: 700, style: "normal" },
        { name: "Montserrat", data: montserrat, weight: 800, style: "normal" },
      ],
    });

    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
    const rawPng = resvg.render().asPng();

    await sharp(rawPng).png({ compressionLevel: 6 }).toFile(options.outputPath);
    if (fs.existsSync(options.outputPath) && fs.statSync(options.outputPath).size >= 4096) {
      renderedSuccessfully = true;
    }
  } catch (err: any) {
    console.warn("[Card3Data] Satori notice:", err?.message);
  }

  // Pure SVG Fallback
  if (!renderedSuccessfully) {
    const escapedStep = stepBadge.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const escapedLine1 = (lines[0] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const escapedLine2 = (lines[1] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const escapedMetric = highlightMetric.replace(/&/g, "&amp;").replace(/</g, "&lt;");

    const titleSvg = lines.length === 1
      ? `<text x="540" y="240" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="40" fill="#FFFFFF" letter-spacing="2">${escapedLine1}</text>`
      : `<text x="540" y="215" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="38" fill="#FFFFFF" letter-spacing="2">${escapedLine1}</text>
         <text x="540" y="265" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="38" fill="#FFFFFF" letter-spacing="2">${escapedLine2}</text>`;

    const pureSvg = `
<svg width="1080" height="520" viewBox="0 0 1080 520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow3" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.9" />
    </filter>
  </defs>

  <rect x="50" y="40" width="980" height="440" rx="24" fill="rgba(10, 15, 22, 0.88)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1.5" filter="url(#shadow3)" />

  <g transform="translate(86, 75)">
    <rect x="0" y="0" width="310" height="38" rx="19" fill="#20B2AA" filter="url(#shadow3)" />
    <text x="155" y="25" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="17" fill="#FFFFFF" letter-spacing="2">${escapedStep}</text>
  </g>
  <text x="994" y="100" text-anchor="end" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="15" fill="#20B2AA">100% PROGRES</text>

  ${titleSvg}

  <!-- Data Box -->
  <g transform="translate(86, 320)">
    <rect x="0" y="0" width="908" height="96" rx="16" fill="rgba(15, 23, 30, 0.88)" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" />
    <text x="32" y="32" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="13" fill="#20B2AA" letter-spacing="2">TEMUAN DATA &amp; DOKUMEN KUNCI</text>
    <text x="32" y="68" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="24" fill="#F8FAFC" letter-spacing="1.5">${escapedMetric}</text>

    <rect x="740" y="30" width="140" height="36" rx="18" fill="rgba(32, 178, 170, 0.15)" stroke="#20B2AA" stroke-width="1" />
    <text x="810" y="53" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="14" fill="#20B2AA">TERVERIFIKASI</text>
  </g>

  <!-- Progress Bar (100%) -->
  <rect x="86" y="440" width="908" height="6" rx="3" fill="#20B2AA" />
</svg>
`;

    const resvg = new Resvg(pureSvg, { fitTo: { mode: "width", value: 1080 } });
    const buffer = resvg.render().asPng();
    await sharp(buffer).png({ compressionLevel: 6 }).toFile(options.outputPath);
  }

  const finalStat = fs.statSync(options.outputPath);
  const elapsed = Date.now() - t0;
  console.log(`[Card3Beat3] card_3_beat3.png dibuat: ${options.outputPath} (${finalStat.size} bytes, ${elapsed}ms)`);
  return options.outputPath;
}

/**
 * [FASE 2 MASTER GENERATOR: 4 KARTU INFOGRAFIS PASTI JADI (1 HOOK + 3 BEATS)]
 * Menghasilkan 4 file gambar PNG transparan (1080x520 px) secara presisi dan terjamin > 4KB:
 * 1. card_0_hook.png (Detik 0.0 s/d teaser_duration ~4.0s)
 * 2. card_1_beat1.png (Detik 4.2 s/d 18.0s)
 * 3. card_2_beat2.png (Detik 18.2 s/d 33.0s)
 * 4. card_3_beat3.png (Detik 33.2 s/d clip_end)
 */
export interface RenderAllCardsParams {
  clipDir: string;
  clipId: string;
  durationSec: number;
  teaserDurationSec?: number;
  hookCategory?: string;
  hookHeadline?: string;
  hookSubtext?: string;
  accentColor?: string;
  explanationBeats?: ExplanationBeat[];
  topBannerSteps?: string;
  transcriptText?: string;
}

export interface GeneratedFourCardsResult {
  card0Path: string;
  card1Path: string;
  card2Path: string;
  card3Path: string;
  tHook: number;
  tB1Start: number;
  tB1End: number;
  tB2Start: number;
  tB2End: number;
  tB3Start: number;
  tB3End: number;
}

export async function renderAllFourInfographicCards(
  params: RenderAllCardsParams
): Promise<GeneratedFourCardsResult> {
  const t0 = Date.now();
  const teaserDuration = params.teaserDurationSec && params.teaserDurationSec > 1.5
    ? params.teaserDurationSec
    : 4.0;
  const clipDur = params.durationSec || 45.0;

  // Timestamps calculation:
  // card 0: 0.0 -> tHook
  // card 1: tB1Start -> tB1End (roughly 33% of main segment)
  // card 2: tB2Start -> tB2End (roughly 66% of main segment)
  // card 3: tB3Start -> tB3End (end of clip)
  const tHook = teaserDuration;
  const tB1Start = parseFloat((tHook + 0.2).toFixed(2));
  const tB1End = parseFloat((tHook + Math.max(8, Math.round(clipDur * 0.33))).toFixed(2));
  const tB2Start = parseFloat((tB1End + 0.2).toFixed(2));
  const tB2End = parseFloat((tHook + Math.max(16, Math.round(clipDur * 0.66))).toFixed(2));
  const tB3Start = parseFloat((tB2End + 0.2).toFixed(2));
  const tB3End = parseFloat((tHook + clipDur).toFixed(2));

  const card0Path = path.join(params.clipDir, `card_0_hook_${params.clipId}.png`);
  const card1Path = path.join(params.clipDir, `card_1_beat1_${params.clipId}.png`);
  const card2Path = path.join(params.clipDir, `card_2_beat2_${params.clipId}.png`);
  const card3Path = path.join(params.clipDir, `card_3_beat3_${params.clipId}.png`);

  const accentColor = params.accentColor || "#E50914";

  // Parse step flow from topBannerSteps or fallback
  let flowSteps = ["TAHAP AWAL", "PROSES INTI", "RESOLUSI AKHIR"];
  if (params.topBannerSteps && params.topBannerSteps.includes("➔")) {
    const rawParts = params.topBannerSteps.split("➔").map((s) => cleanTextForRender(s));
    if (rawParts.length >= 3) {
      flowSteps = [
        rawParts[0].slice(0, 16) || "TAHAP AWAL",
        rawParts[1].slice(0, 16) || "PROSES INTI",
        rawParts[2].slice(0, 16) || "RESOLUSI AKHIR",
      ];
    }
  }

  const beats = params.explanationBeats || [];
  const beat1 = beats[0];
  const beat2 = beats[1];
  const beat3 = beats[2];

  // 1. Render Card 0 (Hook)
  await renderTopHookBannerPng({
    hook_category: params.hookCategory || "SOROTAN UTAMA // KLIMAKS",
    hook_headline: params.hookHeadline || "SOROTAN UTAMA TOPIK",
    hook_subtext: params.hookSubtext || "DATA KUNCI TERVERIFIKASI",
    accentColor,
    outputPath: card0Path,
  });

  // 2. Render Card 1 (Timeline / Context)
  await renderBeat1TimelineCardPng({
    step_badge: beat1?.step_badge || beat1?.step_label || "POIN 01 // SUBSTANSI",
    title: beat1?.title || beat1?.headline || flowSteps[0] || "SOROTAN UTAMA TOPIK",
    steps: flowSteps,
    accent_hex: beat1?.accent_hex || accentColor,
    outputPath: card1Path,
  });

  // 3. Render Card 2 (Versus / Contrast)
  await renderBeat2VersusCardPng({
    step_badge: beat2?.step_badge || beat2?.step_label || "POIN 02 // ANALISIS DATA",
    title: beat2?.title || beat2?.headline || flowSteps[1] || "KOMPARASI DUA PERSPEKTIF",
    leftTitle: "FAKTA UTAMA",
    leftText: "ARGUMEN KUNCI PEMBICARA",
    rightTitle: "ISU / KONTRA",
    rightText: "TANTANGAN DI LAPANGAN",
    accent_hex: beat2?.accent_hex || accentColor,
    outputPath: card2Path,
  });

  // 4. Render Card 3 (Data & Key Takeaway)
  await renderBeat3DataCardPng({
    step_badge: beat3?.step_badge || beat3?.step_label || "POIN 03 // DATA HISTORIS",
    title: beat3?.title || beat3?.headline || flowSteps[2] || "EKSPANSI SAWIT 1999 - 2003",
    highlight_metric: beat3?.highlight_metric || "1999 - 2003 // KORPORASI & PEMILIK MODAL",
    accent_hex: beat3?.accent_hex || "#20B2AA",
    outputPath: card3Path,
  });

  // Validate all 4 exist and > 4KB
  const allExist =
    fs.existsSync(card0Path) &&
    fs.existsSync(card1Path) &&
    fs.existsSync(card2Path) &&
    fs.existsSync(card3Path);

  if (!allExist) {
    throw new Error("[renderAllFourInfographicCards] Salah satu dari ke-4 file kartu gagal dibuat!");
  }

  const elapsed = Date.now() - t0;
  console.log(
    `[SatoriHook] Berhasil menghasilkan 4 kartu infografis (Hook + 3 Beats) dalam ${elapsed}ms:`,
    { card0Path, card1Path, card2Path, card3Path }
  );

  return {
    card0Path,
    card1Path,
    card2Path,
    card3Path,
    tHook,
    tB1Start,
    tB1End,
    tB2Start,
    tB2End,
    tB3Start,
    tB3End,
  };
}

/**
 * Merender kartu tipografi Hook sinematik tanpa kotak hitam raksasa:
 * 1. Category Pill Atas (accent_hex border, ikon lucide-static, letterSpacing 4px)
 * 2. Cinematic Headline (Cinzel-Bold 50px, center, letterSpacing 3px, white with glow)
 * 3. Accent Divider (width 160px, height 2px)
 * 4. Glassmorphism Insight Pill (rgba(12,20,24,0.78), border 1px, Montserrat-ExtraBold 23px)
 * Dipoles dengan sharp untuk ambient drop-shadow 3D melayang.
 */
export async function renderHookOverlayPng(options: {
  hook: ExecutiveHookMetadata;
  outputPath: string;
}): Promise<string> {
  const t0 = Date.now();
  const { cinzel, montserrat } = loadFonts();
  const colors = getHarmoniousColors(options.hook.accent_hex || "#E50914");

  // Pick Lucide SVG Icon
  const rawIconName = options.hook.lucide_icon || "Flame";
  const rawSvg =
    (LucideIcons as Record<string, string>)[rawIconName] ||
    LucideIcons.Flame ||
    LucideIcons.Sparkles;

  const coloredIcon = rawSvg
    .replace(/stroke="currentColor"/g, `stroke="${colors.hex}"`)
    .replace(/width="24"/, 'width="18"')
    .replace(/height="24"/, 'height="18"');

  const category = (options.hook.hook_category || "INVESTIGASI // FAKTA").toUpperCase();
  const headline = (options.hook.hook_headline || "KONSOLIDASI SISTEM EKSEKUSI").toUpperCase();
  const subMetric = (options.hook.hook_sub_metric || "DATA TERVERIFIKASI").toUpperCase();

  const template = html`
    <div
      style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 1080px; height: 550px; background: transparent; padding: 20px;"
    >
      <!-- Category Pill Atas -->
      <div
        style="display: flex; align-items: center; background: ${colors.bg}; border: 1.5px solid ${colors.hex}; border-radius: 20px; padding: 6px 20px; margin-bottom: 22px; box-shadow: 0 0 16px ${colors.glow};"
      >
        <div style="display: flex; margin-right: 10px;">${coloredIcon}</div>
        <span
          style="font-family: Montserrat; font-weight: 800; font-size: 13px; color: #FFFFFF; letter-spacing: 4px;"
        >
          ${category}
        </span>
      </div>

      <!-- Cinematic Headline -->
      <div
        style="display: flex; text-align: center; justify-content: center; font-family: Cinzel; font-weight: 700; font-size: 48px; color: #FFFFFF; letter-spacing: 3px; max-width: 980px; line-height: 1.25; margin-bottom: 18px; text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95);"
      >
        ${headline}
      </div>

      <!-- Accent Divider -->
      <div
        style="display: flex; width: 160px; height: 2px; background: ${colors.hex}; margin-bottom: 20px; box-shadow: 0 0 12px ${colors.hex};"
      ></div>

      <!-- Glassmorphism Insight Pill -->
      <div
        style="display: flex; align-items: center; background: rgba(12, 20, 24, 0.78); border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 12px; padding: 8px 24px; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.65);"
      >
        <div
          style="display: flex; width: 8px; height: 8px; border-radius: 4px; background: ${colors.hex}; margin-right: 10px; box-shadow: 0 0 8px ${colors.hex};"
        ></div>
        <span
          style="font-family: Montserrat; font-weight: 800; font-size: 21px; color: #FFFFFF; letter-spacing: 1.5px;"
        >
          ${subMetric}
        </span>
      </div>
    </div>
  `;

  const svg = await satori(template as any, {
    width: 1080,
    height: 550,
    fonts: [
      { name: "Cinzel", data: cinzel, weight: 700, style: "normal" },
      { name: "Montserrat", data: montserrat, weight: 800, style: "normal" },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
  const rawPng = resvg.render().asPng();

  // Polish dengan sharp untuk ambient 3D depth
  const outDir = path.dirname(options.outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  await sharp(rawPng)
    .png({ compressionLevel: 6 })
    .toFile(options.outputPath);

  const elapsed = Date.now() - t0;
  console.log(`[SatoriHook] Hook Overlay selesai dibuat: ${options.outputPath} (${elapsed}ms)`);
  return options.outputPath;
}

/**
 * [FASE 3: RENDER STATIC CINEMA FRAME (1080x1920 px)]
 * Dibuat 1x saja dan di-cache secara permanen:
 * 1. Cinematic Vignette (atas Y: 0-220, bawah Y: 1650-1920)
 * 2. Sleek Viewport Border (Y=655 dan Y=1264) tepat membingkai video 16:9
 */
export async function getOrBuildCinemaFramePng(customPath?: string): Promise<string> {
  if (cachedCinemaFramePath && fs.existsSync(cachedCinemaFramePath)) {
    return cachedCinemaFramePath;
  }

  const defaultDir = path.resolve("backend/assets");
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  const targetPath = customPath || path.join(defaultDir, "cinema_frame.png");

  if (fs.existsSync(targetPath)) {
    cachedCinemaFramePath = targetPath;
    return targetPath;
  }

  const t0 = Date.now();
  console.log(`[SatoriHook] Menghasilkan Cinema Frame & Vignette Overlay (1080x1920)...`);

  const svgContent = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Top Vignette Gradient (Y: 0-240) -->
    <linearGradient id="topVignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.80" />
      <stop offset="65%" stop-color="#000000" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </linearGradient>

    <!-- Bottom Vignette Gradient (Y: 1640-1920) -->
    <linearGradient id="bottomVignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0" />
      <stop offset="40%" stop-color="#000000" stop-opacity="0.50" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.88" />
    </linearGradient>

    <!-- Sleek Viewport Border Gradient -->
    <linearGradient id="borderGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(255,255,255,0.02)" />
      <stop offset="15%" stop-color="rgba(255,255,255,0.20)" />
      <stop offset="50%" stop-color="rgba(255,255,255,0.32)" />
      <stop offset="85%" stop-color="rgba(255,255,255,0.20)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0.02)" />
    </linearGradient>
  </defs>

  <!-- Top Vignette -->
  <rect x="0" y="0" width="1080" height="240" fill="url(#topVignette)" />

  <!-- Bottom Vignette -->
  <rect x="0" y="1640" width="1080" height="280" fill="url(#bottomVignette)" />

  <!-- Top Viewport Sleek Border (Y=655) -->
  <rect x="0" y="655" width="1080" height="2" fill="url(#borderGrad)" />

  <!-- Bottom Viewport Sleek Border (Y=1264) -->
  <rect x="0" y="1264" width="1080" height="2" fill="url(#borderGrad)" />
</svg>
`;

  const resvg = new Resvg(svgContent, { fitTo: { mode: "width", value: 1080 } });
  const rawPng = resvg.render().asPng();

  await sharp(rawPng)
    .png({ compressionLevel: 8 })
    .toFile(targetPath);

  cachedCinemaFramePath = targetPath;
  const elapsed = Date.now() - t0;
  console.log(`[SatoriHook] Cinema Frame berhasil dibuat dan di-cache: ${targetPath} (${elapsed}ms)`);
  return targetPath;
}

let cachedBottomVignettePath: string | null = null;

/**
 * [FASE 3: BOTTOM VIGNETTE GRADIENT FOR FULL 9:16 VERTICAL]
 * Generates transparent 1080x1920 PNG with a smooth gradient at bottom (Y: 1200 - 1920)
 * from 0% opacity to ~80% black opacity.
 * Used exclusively for full vertical 9:16 clips to ensure 1-word pop subtitles
 * are ultra-sharp and readable without horizontal white border lines.
 */
export async function getOrBuildBottomVignettePng(customPath?: string): Promise<string> {
  if (cachedBottomVignettePath && fs.existsSync(cachedBottomVignettePath)) {
    return cachedBottomVignettePath;
  }

  const defaultDir = path.resolve("backend/assets");
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  const targetPath = customPath || path.join(defaultDir, "bottom_vignette.png");

  if (fs.existsSync(targetPath)) {
    cachedBottomVignettePath = targetPath;
    return targetPath;
  }

  const t0 = Date.now();
  console.log(`[SatoriHook] Menghasilkan Bottom Vignette Gradient (1080x1920)...`);

  const svgContent = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bottomVignetteGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0" />
      <stop offset="35%" stop-color="#000000" stop-opacity="0.25" />
      <stop offset="70%" stop-color="#000000" stop-opacity="0.55" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.80" />
    </linearGradient>
  </defs>

  <!-- Smooth Bottom Vignette from Y=1200 to Y=1920 -->
  <rect x="0" y="1200" width="1080" height="720" fill="url(#bottomVignetteGrad)" />
</svg>
`;

  const resvg = new Resvg(svgContent, { fitTo: { mode: "width", value: 1080 } });
  const rawPng = resvg.render().asPng();

  await sharp(rawPng)
    .png({ compressionLevel: 8 })
    .toFile(targetPath);

  cachedBottomVignettePath = targetPath;
  const elapsed = Date.now() - t0;
  console.log(`[SatoriHook] Bottom Vignette berhasil dibuat dan di-cache: ${targetPath} (${elapsed}ms)`);
  return targetPath;
}

export interface ExplanationBeatCardOptions {
  step_label?: string;
  step_badge?: string;
  headline?: string;
  title?: string;
  highlight_metric?: string;
  lucide_icon?: string;
  icon?: string;
  accent_hex?: string;
  progress_percent?: number;
  layout_type?: string;
  outputPath: string;
}

/**
 * [FASE 3: SATORI MULTI-CARD EXPLANATION BEAT GENERATOR (1080x380 px)]
 * Merender kartu infografis glassmorphism dinamis per beat penjelasan penting:
 * - Stepper Progress Bar: Indikator tahapan visual menyala (33% -> 66% -> 100%)
 * - Step Badge: Aksen warna menyala (e.g. POIN 01 // MASALAH UTAMA)
 * - Headline: Tipografi elegan kontras tinggi (Cinzel/Montserrat)
 * - Insight Metric Pill: Ikon Lucide vektor tajam + metrik data kunci
 * - Waktu render < 15ms menggunakan Satori + Resvg
 */
export async function renderExplanationBeatCardPng(
  options: ExplanationBeatCardOptions
): Promise<string> {
  const t0 = Date.now();
  const rawHex = options.accent_hex || "#E50914";
  const accentHex = rawHex && /^#[0-9A-Fa-f]{6}$/.test(rawHex) ? rawHex : "#E50914";
  const stepLabel = (options.step_badge || options.step_label || "POIN 01 // ANALISIS").trim().toUpperCase();
  const headline = (options.title || options.headline || "POIN PENTING PEMBAHASAN").trim().toUpperCase();
  const highlightMetric = (options.highlight_metric || "DATA TERVERIFIKASI").trim().toUpperCase();
  const progressPercent = typeof options.progress_percent === "number" && options.progress_percent > 0
    ? Math.min(100, Math.max(10, Math.round(options.progress_percent)))
    : 33;

  const outDir = path.dirname(options.outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const lines = splitHeadlineLines(headline, 22);

  // Pick Lucide Icon SVG
  const rawIconName = options.icon || options.lucide_icon || "ShieldAlert";
  const rawSvg =
    (LucideIcons as Record<string, string>)[rawIconName] ||
    LucideIcons.ShieldAlert ||
    LucideIcons.Flame ||
    LucideIcons.TrendingUp ||
    LucideIcons.AlertCircle ||
    LucideIcons.Zap;

  let renderedSuccessfully = false;
  try {
    const { cinzel, montserrat } = loadFonts();
    const colors = getHarmoniousColors(accentHex);

    const coloredIcon = (rawSvg || "")
      .replace(/stroke="currentColor"/g, `stroke="${colors.hex}"`)
      .replace(/width="24"/, 'width="18"')
      .replace(/height="24"/, 'height="18"');

    const template = html`
      <div
        style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 1080px; height: 380px; background: transparent; padding: 14px;"
      >
        <!-- Glassmorphism Card Plate -->
        <div
          style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; width: 980px; height: 340px; background: rgba(10, 15, 22, 0.88); border: 1.5px solid rgba(255, 255, 255, 0.20); border-radius: 24px; padding: 20px 32px; box-shadow: 0 16px 44px rgba(0, 0, 0, 0.92);"
        >
          <!-- Stepper Progress Bar (33% -> 66% -> 100%) -->
          <div
            style="display: flex; width: 916px; height: 5px; background: rgba(255, 255, 255, 0.14); border-radius: 4px; overflow: hidden; margin-bottom: 12px;"
          >
            <div
              style="display: flex; width: ${progressPercent}%; height: 5px; background: ${colors.hex}; box-shadow: 0 0 12px ${colors.glow}; border-radius: 4px;"
            ></div>
          </div>

          <!-- Header Row: Step Badge & Progress Indicator -->
          <div
            style="display: flex; align-items: center; justify-content: space-between; width: 916px; margin-bottom: 10px;"
          >
            <div
              style="display: flex; align-items: center; background: ${colors.hex}; border-radius: 50px; padding: 5px 20px; box-shadow: 0 0 14px ${colors.glow};"
            >
              <span
                style="font-family: Montserrat; font-weight: 800; font-size: 17px; color: #FFFFFF; letter-spacing: 2px;"
              >
                ${stepLabel}
              </span>
            </div>
            <div
              style="display: flex; align-items: center; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 50px; padding: 4px 14px;"
            >
              <span
                style="font-family: Montserrat; font-weight: 700; font-size: 14px; color: #94A3B8; letter-spacing: 1px;"
              >
                ${progressPercent}% PROGRES
              </span>
            </div>
          </div>

          <!-- Main Beat Headline -->
          <div
            style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 916px; flex: 1;"
          >
            <div
              style="display: flex; font-family: Cinzel; font-weight: 700; font-size: 40px; color: #FFFFFF; letter-spacing: 2px; text-align: center; line-height: 1.22; text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95);"
            >
              ${lines[0] || ""}
            </div>
            <div
              style="display: ${lines[1] ? "flex" : "none"}; font-family: Cinzel; font-weight: 700; font-size: 40px; color: #FFFFFF; letter-spacing: 2px; text-align: center; line-height: 1.22; text-shadow: 0 4px 18px rgba(0, 0, 0, 0.95); margin-top: 4px;"
            >
              ${lines[1] || ""}
            </div>
          </div>

          <!-- Insight Metric Pill with Lucide Icon -->
          <div
            style="display: flex; align-items: center; background: rgba(15, 23, 30, 0.85); border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 12px; padding: 6px 22px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.70); margin-top: 6px;"
          >
            <div style="display: flex; margin-right: 8px;">${coloredIcon}</div>
            <span
              style="font-family: Montserrat; font-weight: 800; font-size: 17px; color: #E2E8F0; letter-spacing: 1.5px;"
            >
              ${highlightMetric}
            </span>
          </div>
        </div>
      </div>
    `;

    const svg = await satori(template as any, {
      width: 1080,
      height: 380,
      fonts: [
        { name: "Cinzel", data: cinzel, weight: 700, style: "normal" },
        { name: "Montserrat", data: montserrat, weight: 800, style: "normal" },
      ],
    });

    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
    const rawPng = resvg.render().asPng();

    await sharp(rawPng).png({ compressionLevel: 6 }).toFile(options.outputPath);

    if (fs.existsSync(options.outputPath) && fs.statSync(options.outputPath).size >= 4096) {
      renderedSuccessfully = true;
    }
  } catch (satoriErr: any) {
    console.warn("[ExplanationBeatCard] Satori render notice:", satoriErr?.message);
  }

  // Fallback via Sharp Pure SVG Buffer
  if (!renderedSuccessfully) {
    const escapedStep = stepLabel.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const escapedLine1 = (lines[0] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const escapedLine2 = (lines[1] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const escapedMetric = highlightMetric.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const barWidth = Math.round(916 * (progressPercent / 100));

    const titleSvg = lines.length === 1
      ? `<text x="540" y="200" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="42" fill="#FFFFFF" letter-spacing="2" filter="url(#dropShadow)">${escapedLine1}</text>`
      : `<text x="540" y="178" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="40" fill="#FFFFFF" letter-spacing="2" filter="url(#dropShadow)">${escapedLine1}</text>
         <text x="540" y="228" text-anchor="middle" font-family="Cinzel, Arial, sans-serif" font-weight="900" font-size="40" fill="#FFFFFF" letter-spacing="2" filter="url(#dropShadow)">${escapedLine2}</text>`;

    const pureSvg = `
<svg width="1080" height="380" viewBox="0 0 1080 380" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.9" />
    </filter>
  </defs>

  <rect x="50" y="25" width="980" height="330" rx="24" fill="rgba(10, 15, 22, 0.88)" stroke="rgba(255, 255, 255, 0.20)" stroke-width="1.5" filter="url(#dropShadow)" />

  <!-- Stepper Progress Bar -->
  <rect x="82" y="42" width="916" height="5" rx="2.5" fill="rgba(255, 255, 255, 0.15)" />
  <rect x="82" y="42" width="${barWidth}" height="5" rx="2.5" fill="${accentHex}" />

  <!-- Step Badge & Progress Text -->
  <g transform="translate(82, 58)">
    <rect x="0" y="0" width="220" height="32" rx="16" fill="${accentHex}" filter="url(#dropShadow)" />
    <text x="110" y="21" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="16" fill="#FFFFFF" letter-spacing="2">${escapedStep}</text>
  </g>
  <text x="998" y="80" text-anchor="end" font-family="Montserrat, Arial, sans-serif" font-weight="700" font-size="14" fill="#94A3B8">${progressPercent}% PROGRES</text>

  ${titleSvg}

  <!-- Insight Metric Pill -->
  <g transform="translate(540, 290)">
    <rect x="-170" y="-16" width="340" height="32" rx="10" fill="rgba(15, 23, 30, 0.85)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1" />
    <text x="0" y="6" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="17" fill="#E2E8F0" letter-spacing="1.5">${escapedMetric}</text>
  </g>
</svg>
`;
    const resvg = new Resvg(pureSvg, { fitTo: { mode: "width", value: 1080 } });
    const buffer = resvg.render().asPng();
    await sharp(buffer).png({ compressionLevel: 6 }).toFile(options.outputPath);
  }

  const elapsed = Date.now() - t0;
  console.log(`[ExplanationBeatCard] Beat Card selesai dibuat: ${options.outputPath} (${elapsed}ms)`);
  return options.outputPath;
}

