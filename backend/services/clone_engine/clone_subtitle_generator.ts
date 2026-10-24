import fs from "node:fs";
import path from "node:path";
import type { UniversalStyleBlueprint } from "./universal_blueprint_schema";

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface GenerateParametricSubtitlesInput {
  clipId: string;
  words: WordTimestamp[];
  durationSec: number;
  blueprint: any;
  outputFilePath: string;
  fontFamily?: string;
  enableBottomMotion?: boolean;
}

/**
 * Converts Hex (#RRGGBB or #AARRGGBB) to ASS color format (&HAABBGGRR).
 */
function hexToAssColor(hexStr?: string, defaultAss = "&H00FFFFFF"): string {
  if (!hexStr) return defaultAss;
  const clean = hexStr.replace("#", "").trim();
  if (clean.length === 6) {
    const r = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const b = clean.substring(4, 6);
    return `&H00${b}${g}${r}&`;
  }
  if (clean.length === 8) {
    const a = clean.substring(0, 2);
    const r = clean.substring(2, 4);
    const g = clean.substring(4, 6);
    const b = clean.substring(6, 8);
    return `&H${a}${b}${g}${r}&`;
  }
  return defaultAss;
}

/**
 * Formats seconds into ASS timestamp: H:MM:SS.cc
 */
function formatAssTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const cs = Math.floor((clamped % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * [FASE 4: PARAMETRIC SUBTITLE GENERATOR (.ass)]
 * Menghasilkan file subtitle ASS yang 100% parametrik sesuai UniversalStyleBlueprint.
 * Mendukung kedua format schema (blueprint.subtitle_system dan blueprint.body_subtitle_engine)
 * serta override font dari frontend Studio.
 */
export function generateParametricAssSubtitles(input: GenerateParametricSubtitlesInput): string {
  const { words, durationSec, blueprint, outputFilePath } = input;
  const subConfig = blueprint?.body_subtitle_engine;
  const subSystem = blueprint?.subtitle_system;
  const hookEngine = blueprint?.opening_hook_engine;
  const hookSystem = blueprint?.opening_hook;

  const fontName =
    input.fontFamily ||
    subSystem?.font_family ||
    subConfig?.typography?.font_family ||
    "Montserrat ExtraBold";

  const fontSize = Math.round(
    subSystem?.font_size_px ||
    subConfig?.typography?.font_size_px ||
    64
  );

  const baseTextHex =
    subSystem?.base_text_hex ||
    subConfig?.color_and_highlights?.base_text_hex ||
    "#FFFFFF";
  const primaryColor = hexToAssColor(baseTextHex, "&H00FFFFFF&");

  const highlightHex =
    subSystem?.highlight_hex ||
    subConfig?.color_and_highlights?.highlight_text_hex ||
    "#04f808";
  const highlightColor = hexToAssColor(highlightHex, "&H002CD3C6&");

  const outlineHex =
    subSystem?.stroke_hex ||
    subConfig?.stroke_and_shadow?.outline_color_hex ||
    "#000000";
  const outlineColor = hexToAssColor(outlineHex, "&H00000000&");

  const shadowHex =
    subSystem?.shadow_hex ||
    subConfig?.stroke_and_shadow?.shadow_color_hex ||
    "#000000";
  const shadowColor = hexToAssColor(shadowHex, "&H80000000&");

  const outlineWidth =
    subSystem?.stroke_width_px ??
    subConfig?.stroke_and_shadow?.outline_thickness_px ??
    3.8;

  const shadowDepth =
    subSystem?.shadow_blur_px ??
    subConfig?.stroke_and_shadow?.shadow_depth_px ??
    4.0;

  const posYRatio =
    subSystem?.position_y_ratio ??
    subConfig?.spatial_placement?.pos_y_ratio ??
    0.74;

  let marginV = Math.round(
    subConfig?.spatial_placement?.margin_vertical_px ||
      (1.0 - posYRatio) * 1920
  );

  // [FASE 8 ANTI-COLLISION]: Jika bottom motion progress bar aktif, naikkan margin subtitle minimal 320px
  if (input.enableBottomMotion) {
    marginV = Math.max(marginV, 320);
  }

  const letterSpacing = subConfig?.typography?.letter_spacing_px || 0;

  // Filter words: if mute_during_hook is true, skip words during active hook zone
  const hookHasSpecial =
    hookSystem?.has_special_opening_text ??
    hookEngine?.enabled ??
    false;

  const hookEnd = hookHasSpecial
    ? (hookSystem?.active_end_sec ?? hookEngine?.active_zone_end_sec ?? 6.0)
    : 0;

  const muteDuringHook =
    subSystem?.mute_during_opening_hook ??
    subConfig?.mute_during_hook ??
    true;

  const hookThreshold = muteDuringHook
    ? Math.max(hookEnd, subConfig?.start_timestamp_sec || 0)
    : 0;

  const validWords = words.filter((w) => w.end <= durationSec + 1.0 && w.start >= hookThreshold);

  // Grouping cadence
  const maxWords = Math.max(
    1,
    subSystem?.words_per_screen ??
    subConfig?.max_words_per_event ??
    1
  );

  const casing =
    subSystem?.casing ??
    subConfig?.typography?.casing ??
    "UPPERCASE";

  const entryTransition =
    subSystem?.entry_animation ??
    subConfig?.motion_physics?.entry_transition ??
    "POP_SCALE";

  const events: Array<{ start: number; end: number; text: string }> = [];

  for (let i = 0; i < validWords.length; i += maxWords) {
    const chunk = validWords.slice(i, i + maxWords);
    if (chunk.length === 0) continue;

    const start = chunk[0]!.start;
    let end = chunk[chunk.length - 1]!.end;
    if (end <= start) end = start + 0.35;

    let text = chunk.map((c) => c.word).join(" ");
    if (casing === "UPPERCASE") {
      text = text.toUpperCase();
    } else if (casing === "lowercase") {
      text = text.toLowerCase();
    }

    // Apply animation effect tags
    if (entryTransition === "POP_SCALE" || entryTransition === "POP_SCALE_SNAP") {
      const scaleStart = Math.round((subConfig?.motion_physics?.scale_start || 0.88) * 100);
      const scalePeak = Math.round((subConfig?.motion_physics?.scale_peak || 1.04) * 100);
      text = `{\\fscx${scaleStart}\\fscy${scaleStart}\\t(0,70,\\fscx${scalePeak}\\fscy${scalePeak})\\t(70,140,\\fscx100\\fscy100)}${text}`;
    }

    events.push({ start, end, text });
  }

  // Zero-Collision Clamping: event[i].end = Math.min(event[i].end, event[i+1].start)
  const zeroCollision = subConfig?.motion_physics?.zero_collision_clamping ?? true;
  if (zeroCollision) {
    for (let i = 0; i < events.length - 1; i++) {
      if (events[i]!.end > events[i + 1]!.start) {
        events[i]!.end = Math.max(events[i]!.start + 0.1, events[i + 1]!.start);
      }
    }
  }

  const assHeader = `[Script Info]
Title: Dior Universal Parametric Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},${highlightColor},${outlineColor},${shadowColor},-1,0,0,0,100,100,${letterSpacing},0,1,${outlineWidth},${shadowDepth},2,60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const dialogueLines = events.map((ev) => {
    return `Dialogue: 0,${formatAssTime(ev.start)},${formatAssTime(ev.end)},Default,,0,0,0,,${ev.text}`;
  });

  const fullAss = assHeader + dialogueLines.join("\n") + "\n";
  const outDir = path.dirname(outputFilePath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(outputFilePath, fullAss, "utf-8");
  return outputFilePath;
}

