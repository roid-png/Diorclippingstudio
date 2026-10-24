import fs from "node:fs";
import path from "node:path";
import type { WordTimestamp } from "./ai-curator.service";
import type { VideoPreset } from "./presets.service";
import { getTempDir } from "./downloader";

export interface GenerateAssSubtitleInput {
  clipId: string;
  clipStartTimeSec: number;
  clipEndTimeSec: number;
  words: WordTimestamp[];
  teaserWords?: WordTimestamp[];
  teaserDurationSec?: number;
  preset: VideoPreset;
  speakerName?: string;
  topBannerTag?: string;
  topBannerTitle?: string;
  topBannerSteps?: string;
  clipTitle?: string;
  fontFamily?: string;
  outputFilePath?: string;
  includeBannerInAss?: boolean;
}

export function formatAssTime(seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const h = Math.floor(safeSec / 3600);
  const m = Math.floor((safeSec % 3600) / 60);
  const s = Math.floor(safeSec % 60);
  const cs = Math.floor((safeSec % 1) * 100);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

export function resolveAssFont(fontFamily?: string): { fontName: string; fileName: string } {
  const f = (fontFamily || "").toLowerCase();
  if (f.includes("jakarta")) {
    return { fontName: "Plus Jakarta Sans", fileName: "PlusJakartaSans-ExtraBold.ttf" };
  }
  if (f.includes("poppins")) {
    return { fontName: "Poppins Black", fileName: "Poppins-Black.ttf" };
  }
  if (f.includes("anton")) {
    return { fontName: "Anton", fileName: "Anton-Regular.ttf" };
  }
  if (f.includes("bebas")) {
    return { fontName: "Bebas Neue", fileName: "BebasNeue-Regular.ttf" };
  }
  return { fontName: "Montserrat ExtraBold", fileName: "Montserrat-ExtraBold.ttf" };
}

/**
 * Converts standard #RRGGBB or &H00BBGGRR& to ASS color format (&H00BBGGRR&).
 */
export function hexToAssColor(hex?: string, fallback = "&H00FFFFFF&"): string {
  if (!hex) return fallback;
  if (hex.startsWith("&H")) return hex.endsWith("&") ? hex : `${hex}&`;
  const clean = hex.replace("#", "").trim();
  if (clean.length === 6) {
    const r = clean.slice(0, 2);
    const g = clean.slice(2, 4);
    const b = clean.slice(4, 6);
    return `&H00${b}${g}${r}&`;
  }
  return fallback;
}

/**
 * Returns the absolute directory containing the 5 downloaded TTF fonts.
 */
export function getFontsDirPath(): string {
  // Try backend/assets/fonts from process.cwd() or relative to file
  const candidate1 = path.resolve("backend/assets/fonts");
  const candidate2 = path.resolve(process.cwd(), "../../backend/assets/fonts");
  const candidate3 = path.resolve("D:/DIOR_CLIPPING/website-tahapan-dengan-kemauan-ku/backend/assets/fonts");

  for (const c of [candidate1, candidate2, candidate3]) {
    if (fs.existsSync(c)) {
      return c.replace(/\\/g, "/");
    }
  }
  return "D:/DIOR_CLIPPING/website-tahapan-dengan-kemauan-ku/backend/assets/fonts";
}

interface RawDialogueEvent {
  start: number;
  end: number;
  text: string;
}

/**
 * [FASE 4: NON-OVERLAPPING SUBTITLE ENGINE (.ASS) WITH ZERO COLLISION CLAMPING]
 * - Layer 1 (Speaker Pill): centered at \an5\pos(540,1475) with thick red border.
 * - Layer 0 (Dialogue Text): groups of 3-4 words centered at \an5\pos(540,1575).
 * - Zero Collision Clamping: event[i].end = Math.min(event[i].end, event[i+1].start)
 * - Transitions: smooth \fad(40,40) and pop highlight.
 */
export function generateAssSubtitleFile(input: GenerateAssSubtitleInput): string {
  const assDir = input.outputFilePath ? path.dirname(input.outputFilePath) : getTempDir("temp/subtitles");
  if (!fs.existsSync(assDir)) {
    fs.mkdirSync(assDir, { recursive: true });
  }

  const assFilePath = input.outputFilePath || path.join(assDir, `${input.clipId}.ass`);
  const fontInfo = resolveAssFont(input.fontFamily || input.preset?.subtitleStyle?.fontName);

  const mainClipDuration = Math.max(5, input.clipEndTimeSec - input.clipStartTimeSec);
  const teaserDuration = input.teaserDurationSec && input.teaserDurationSec > 0 ? input.teaserDurationSec : 0;
  const totalDuration = teaserDuration + mainClipDuration;
  const clipEndAss = formatAssTime(totalDuration);

  // Normalize speaker badge
  const rawSpeaker = (input.speakerName || "NARASUMBER").trim().toUpperCase();
  const speakerBadge = rawSpeaker.startsWith("[") && rawSpeaker.endsWith("]")
    ? rawSpeaker
    : `[ ${rawSpeaker} ]`;

  // Process word timestamps for Main Story: words are already 0.00s relative if from Groq sliced audio
  const isAlreadyRelative =
    input.words.length > 0 &&
    (input.words[0]!.start < 2.0 || input.clipStartTimeSec === 0) &&
    input.words[input.words.length - 1]!.end <= mainClipDuration + 5;

  let relativeWords: WordTimestamp[] = [];
  if (isAlreadyRelative) {
    relativeWords = input.words.map((w, index) => {
      let start = Math.max(0, w.start);
      if (index === 0) start = 0.0;
      let end = Math.max(start + 0.15, w.end);
      if (end > mainClipDuration) end = mainClipDuration;
      return { word: w.word, start, end };
    });
  } else {
    // Relative shift with latency compensation
    const LATENCY_COMPENSATION = 0.15;
    const matched = (input.words || []).filter(
      (w) => w.end >= input.clipStartTimeSec && w.start <= input.clipEndTimeSec
    );
    let offset = matched.length > 0 && matched[0]!.start > input.clipStartTimeSec
      ? matched[0]!.start - input.clipStartTimeSec
      : 0;

    relativeWords = matched.map((w, index) => {
      let adjStart = Math.max(0, w.start - input.clipStartTimeSec - offset - LATENCY_COMPENSATION);
      let adjEnd = Math.max(adjStart + 0.15, w.end - input.clipStartTimeSec - offset - LATENCY_COMPENSATION);
      if (index === 0) adjStart = 0.0;
      if (adjEnd > mainClipDuration) adjEnd = mainClipDuration;
      return {
        word: w.word,
        start: parseFloat(adjStart.toFixed(2)),
        end: parseFloat(adjEnd.toFixed(2)),
      };
    });
  }

  // [FASE 1 & 2: DYNAMIC PRESET SUBTITLE STYLING & ZERO SPEAKER PILL]
  // Sesuai brief: Hapus total speaker pill [NARASUMBER], dan terapkan warna + font dari preset / AI Clone!
  const subStyle = input.preset?.subtitleStyle;
  const fontSize = subStyle?.fontSize && subStyle.fontSize >= 20 ? subStyle.fontSize + 16 : 46;
  const primaryColor = hexToAssColor(subStyle?.primaryColor, "&H00FFFFFF&");

  // [PERBAIKAN 2: SINKRONISASI WARNA AKSEN PRESET KE HIGHLIGHT SUBTITLE]
  // Ekstrak warna aksen preset pengguna (misal: "#E50914" untuk Merah, "#FF6B00" untuk Oranye).
  // Jika highlightColor di subtitleStyle adalah legacy default yellow ("&H0000FFFF" atau "&H0000D4FF"),
  // ganti dengan warna aksen preset agar kata aktif subtitle ("ADA") mengikuti warna aksen yang dipilih.
  const rawPresetAccent =
    (input.preset?.accentColor && /^#[0-9A-Fa-f]{6}$/.test(input.preset.accentColor) && input.preset.accentColor) ||
    (input.preset?.primaryAccentHex && /^#[0-9A-Fa-f]{6}$/.test(input.preset.primaryAccentHex) && input.preset.primaryAccentHex) ||
    "#E50914";

  const isLegacyYellowDefault =
    !subStyle?.highlightColor ||
    subStyle.highlightColor === "&H0000FFFF" ||
    subStyle.highlightColor === "&H0000D4FF";

  const hasCustomHexHighlight =
    subStyle?.highlightColor &&
    /^#[0-9A-Fa-f]{6}$/.test(subStyle.highlightColor) &&
    subStyle.highlightColor.toLowerCase() !== "#00ffff";

  const targetHighlightHex = hasCustomHexHighlight
    ? subStyle!.highlightColor!
    : rawPresetAccent;

  const highlightTextColor = hexToAssColor(targetHighlightHex, "&H001409E5&");
  const highlightBorderColor = hexToAssColor(targetHighlightHex, "&H001409E5&");
  const outlineColor = hexToAssColor(subStyle?.outlineColor, "&H00000000&");
  const outlineWidth = subStyle?.outlineWidth || 3;
  const boldFlag = subStyle?.bold !== false ? -1 : 0;

  // Polymorphic Subtitle Behavior selector
  const behavior: "SINGLE_WORD_POP" | "PHRASE_HIGHLIGHT_BOX" | "CLEAN_CINEMATIC_LINE" | "DUAL_COLOR_DYNAMIC" =
    input.preset?.subtitleBehavior ||
    (input.preset?.layoutArchitecture === "IN_SCENE_KINETIC_CLIPPER" ? "SINGLE_WORD_POP" : "PHRASE_HIGHLIGHT_BOX");

  // [PERBAIKAN 1: JARAK SUBTITLE BAGIAN BAWAH DITARUH TEPAT DI TENGAH BOTTOM REGION]
  // Pada video 9:16 (1080x1920) dengan letterbox 16:9 di Y=656..1264:
  // Area bottom membentang dari Y=1264 hingga Y=1920 (tinggi 656px).
  // Titik tengah simetris area bottom adalah Y = 1264 + (656 / 2) = 1592.
  // Nilai marginV warisan yang terlalu kecil (< 250) seperti 80 menghasilkan Y=1840 -> ter-clamp ke 1760 (terlalu kebawahan).
  // Dengan MarginV = 370 (Y = 1920 - 370 = 1550), subtitle berada tepat di tengah-tengah area bottom dengan jarak simetris yang lega.
  const isLetterbox =
    input.preset?.layoutArchitecture !== "IN_SCENE_KINETIC_CLIPPER" &&
    input.preset?.cameraFraming !== "FULL_9_16_SPEAKER_TRACK";

  let effectiveMarginV: number;
  if (typeof subStyle?.marginV === "number" && subStyle.marginV >= 280 && subStyle.marginV <= 550) {
    effectiveMarginV = subStyle.marginV;
  } else if (isLetterbox) {
    effectiveMarginV = 370; // 1920 - 370 = 1550 (tepat di tengah-tengah bottom region)
  } else {
    effectiveMarginV = behavior === "SINGLE_WORD_POP" ? 420 : 370;
  }

  const subtitleY = 1920 - effectiveMarginV;

  const styleDefinitions = `Style: Default,${fontInfo.fontName},${fontSize},${primaryColor},&H000000FF,${outlineColor},&H80000000,${boldFlag},0,0,0,100,100,1,0,1,${outlineWidth},0,2,60,60,${effectiveMarginV},1`;

  const assHeader = `[Script Info]
; Script generated by Dior Clipping Non-Overlapping Engine
Title: Dior Precision Subtitle Engine (${behavior})
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styleDefinitions}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const dialogueLines: string[] = [];

  // Layer 0: Dialogue Speech with Strict Non-Overlapping Zero Collision Clamping
  const rawEvents: RawDialogueEvent[] = [];

  // --- MODE A: SINGLE_WORD_POP (Viral TikTok / @renxclip) ---
  const addSingleWordPopEvents = (wordList: WordTimestamp[], segDuration: number, timeOffset = 0) => {
    if (wordList.length === 0) return;
    const shortParticles = new Set([
      "di", "ke", "dari", "yang", "dan", "ini", "itu", "pada", "untuk", "si", "tak", "gak", "ya", "sih", "nih"
    ]);

    const grouped: WordTimestamp[] = [];
    let i = 0;
    while (i < wordList.length) {
      const cur = wordList[i]!;
      const cleanCur = cur.word.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (shortParticles.has(cleanCur) && i + 1 < wordList.length) {
        const next = wordList[i + 1]!;
        grouped.push({
          word: `${cur.word} ${next.word}`,
          start: cur.start,
          end: next.end,
        });
        i += 2;
      } else {
        grouped.push({ ...cur });
        i++;
      }
    }

    const hookColor = highlightTextColor;
    const punchWords = new Set([
      "bakar", "mati", "hancur", "rugi", "kaya", "sukses", "gila", "parah",
      "uang", "miliar", "juta", "triliun", "bohong", "rahasia", "bahaya",
      "ancam", "penting", "kunci", "bencana", "darurat", "bangkrut", "kacau",
      "habis", "gagal", "tolak", "jual", "beli", "curang", "haram", "dosa",
      "viral", "meledak", "anjlok", "untung", "bebas", "terjebak", "tipu",
      "palsu", "musnah", "korban", "tangkap", "penjara", "bubarkan", "waspada",
      "kiamat", "murka", "takut", "ancaman", "pemberontakan", "skandal"
    ]);

    const hasKineticHook =
      input.preset?.enableHook !== false &&
      (input.preset?.hookVisualType === "IN_SCENE_KINETIC_HOOK" ||
        input.preset?.layoutArchitecture === "IN_SCENE_KINETIC_CLIPPER");

    for (let idx = 0; idx < grouped.length; idx++) {
      const item = grouped[idx]!;
      const wStart = item.start + timeOffset;
      const nextItem = grouped[idx + 1];
      const wEnd = nextItem
        ? Math.max(item.end + timeOffset, nextItem.start + timeOffset)
        : Math.min(timeOffset + segDuration, item.end + timeOffset + 0.25);

      // If in-scene kinetic hook is active, let the glowing spoken hook own seconds 0.0 - 5.0
      if (hasKineticHook && wEnd <= 4.8) {
        continue;
      }

      const cleanText = item.word.replace(/[{}\\"]/g, "").trim().toUpperCase();
      if (!cleanText) continue;

      const normWord = cleanText.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isPunch = punchWords.has(normWord) || /\d+/.test(cleanText) || cleanText.includes("!") || cleanText.length >= 8;
      const colorTag = isPunch ? `\\1c${hookColor}` : `\\1c&H00FFFFFF&`;

      // [FASE 3 & 4: VIRAL CLIPPER SUBTITLE 1-KATA TEBAL POP AT \pos(540, 1440) WITH \fs72]
      const popFontSize = subStyle?.fontSize && subStyle.fontSize >= 60 ? subStyle.fontSize : 72;
      const popY = subtitleY || 1440;
      const subPopText = `{\\an5\\pos(540,${popY})\\fs${popFontSize}\\bord4\\3c&H00000000&\\shad3\\4c&H80000000&${colorTag}\\fscx88\\fscy88\\t(0,65,\\fscx106\\fscy106)\\t(65,130,\\fscx100\\fscy100)}${cleanText}`;
      rawEvents.push({
        start: wStart,
        end: wEnd,
        text: subPopText,
      });
    }
  };

  // --- MODE B: PHRASE_HIGHLIGHT_BOX (Classic Podcaster Karaoke) ---
  const addPhraseHighlightEvents = (wordList: WordTimestamp[], segDuration: number, timeOffset = 0) => {
    if (wordList.length === 0) return;
    const chunkSize = 4;
    for (let i = 0; i < wordList.length; i += chunkSize) {
      const chunk = wordList.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;

      const chunkStart = chunk[0]!.start + timeOffset;
      const nextChunkFirst = wordList[i + chunkSize];
      const chunkEnd = nextChunkFirst
        ? Math.max(chunk[chunk.length - 1]!.end + timeOffset, nextChunkFirst.start + timeOffset)
        : Math.min(timeOffset + segDuration, chunk[chunk.length - 1]!.end + timeOffset + 0.3);

      for (let wIdx = 0; wIdx < chunk.length; wIdx++) {
        const activeWord = chunk[wIdx]!;
        const wordStart = wIdx === 0 ? chunkStart : activeWord.start + timeOffset;
        const wordEnd =
          wIdx < chunk.length - 1
            ? Math.max(activeWord.end + timeOffset, chunk[wIdx + 1]!.start + timeOffset)
            : chunkEnd;

        const lineParts = chunk.map((cw, j) => {
          const cleanText = cw.word.replace(/[{}\\"]/g, "").toUpperCase();
          if (j === wIdx) {
            return `{\\bord${Math.max(4, outlineWidth + 2)}\\3c${outlineColor}\\1c${highlightTextColor}\\t(0,80,\\fscx108\\fscy108)}${cleanText}{\\bord${outlineWidth}\\3c${outlineColor}\\1c${primaryColor}}`;
          }
          return cleanText;
        });

        rawEvents.push({
          start: wordStart,
          end: wordEnd,
          text: `{\\an5\\pos(540,${subtitleY})\\fad(40,40)}${lineParts.join(" ")}`,
        });
      }
    }
  };

  // --- MODE C: DUAL_COLOR_DYNAMIC (Dual-Tone Emphasis) ---
  const addDualColorDynamicEvents = (wordList: WordTimestamp[], segDuration: number, timeOffset = 0) => {
    if (wordList.length === 0) return;
    const chunkSize = 4;
    for (let i = 0; i < wordList.length; i += chunkSize) {
      const chunk = wordList.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;

      const chunkStart = chunk[0]!.start + timeOffset;
      const nextChunkFirst = wordList[i + chunkSize];
      const chunkEnd = nextChunkFirst
        ? Math.max(chunk[chunk.length - 1]!.end + timeOffset, nextChunkFirst.start + timeOffset)
        : Math.min(timeOffset + segDuration, chunk[chunk.length - 1]!.end + timeOffset + 0.3);

      for (let wIdx = 0; wIdx < chunk.length; wIdx++) {
        const activeWord = chunk[wIdx]!;
        const wordStart = wIdx === 0 ? chunkStart : activeWord.start + timeOffset;
        const wordEnd =
          wIdx < chunk.length - 1
            ? Math.max(activeWord.end + timeOffset, chunk[wIdx + 1]!.start + timeOffset)
            : chunkEnd;

        const lineParts = chunk.map((cw, j) => {
          const cleanText = cw.word.replace(/[{}\\"]/g, "").toUpperCase();
          const isKeyword = cleanText.length >= 6 || /\d/.test(cleanText) || j === wIdx;
          const wordColor = isKeyword ? highlightTextColor : primaryColor;
          if (j === wIdx) {
            return `{\\bord${outlineWidth + 1}\\3c${outlineColor}\\1c${wordColor}\\t(0,70,\\fscx107\\fscy107)}${cleanText}{\\bord${outlineWidth}\\3c${outlineColor}\\1c${primaryColor}}`;
          }
          return `{\\1c${wordColor}}${cleanText}`;
        });

        let formattedText = lineParts.join(" ");
        if (chunk.length >= 3) {
          const mid = Math.ceil(chunk.length / 2);
          formattedText = `${lineParts.slice(0, mid).join(" ")}\\N${lineParts.slice(mid).join(" ")}`;
        }

        rawEvents.push({
          start: wordStart,
          end: wordEnd,
          text: `{\\an5\\pos(540,${subtitleY})\\fad(30,30)}${formattedText}`,
        });
      }
    }
  };

  // --- MODE D: CLEAN_CINEMATIC_LINE (Cinematic Subtitle) ---
  const addCleanCinematicEvents = (wordList: WordTimestamp[], segDuration: number, timeOffset = 0) => {
    if (wordList.length === 0) return;
    const chunkSize = 5;
    for (let i = 0; i < wordList.length; i += chunkSize) {
      const chunk = wordList.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;

      const chunkStart = chunk[0]!.start + timeOffset;
      const nextChunkFirst = wordList[i + chunkSize];
      const chunkEnd = nextChunkFirst
        ? Math.max(chunk[chunk.length - 1]!.end + timeOffset, nextChunkFirst.start + timeOffset)
        : Math.min(timeOffset + segDuration, chunk[chunk.length - 1]!.end + timeOffset + 0.3);

      const sentence = chunk.map((cw) => cw.word.replace(/[{}\\"]/g, "").trim().toUpperCase()).join(" ");

      rawEvents.push({
        start: chunkStart,
        end: chunkEnd,
        text: `{\\an5\\pos(540,${subtitleY})\\fs${Math.max(40, fontSize - 4)}\\bord2\\3c&H00000000&\\1c${primaryColor}\\shad1\\4c&H80000000&\\fad(60,60)}${sentence}`,
      });
    }
  };

  const dispatchSubtitleEvents = (wordsToProcess: WordTimestamp[], segDuration: number, timeOffset = 0) => {
    switch (behavior) {
      case "SINGLE_WORD_POP":
        addSingleWordPopEvents(wordsToProcess, segDuration, timeOffset);
        break;
      case "DUAL_COLOR_DYNAMIC":
        addDualColorDynamicEvents(wordsToProcess, segDuration, timeOffset);
        break;
      case "CLEAN_CINEMATIC_LINE":
        addCleanCinematicEvents(wordsToProcess, segDuration, timeOffset);
        break;
      case "PHRASE_HIGHLIGHT_BOX":
      default:
        addPhraseHighlightEvents(wordsToProcess, segDuration, timeOffset);
        break;
    }
  };

  // [FASE 4: SEGMEN A (TEASER) SUBTITLES NORMALIZED TO 0.00]
  if (teaserDuration > 0) {
    let normTeaserWords: WordTimestamp[] = [];
    if (input.teaserWords && input.teaserWords.length > 0) {
      const minStart = input.teaserWords[0]!.start;
      normTeaserWords = input.teaserWords.map((w, idx) => ({
        word: w.word,
        start: idx === 0 ? 0.0 : Math.max(0, w.start - minStart),
        end: Math.min(teaserDuration, Math.max(0.15, w.end - minStart)),
      }));
    } else {
      // Fallback teaser words from title/headline
      const titleWords = (input.topBannerTitle || input.clipTitle || "MOMEN KLIMAKS").split(" ");
      const step = teaserDuration / Math.max(1, titleWords.length);
      normTeaserWords = titleWords.map((word, i) => ({
        word,
        start: i * step,
        end: (i + 1) * step,
      }));
    }
    dispatchSubtitleEvents(normTeaserWords, teaserDuration, 0);
  }

  // [FASE 4: SEGMEN B (MAIN STORY) SUBTITLES SHIFTED BY +teaserDuration]
  if (relativeWords.length > 0) {
    dispatchSubtitleEvents(relativeWords, mainClipDuration, teaserDuration);
  } else if (teaserDuration === 0) {
    const fallbackText = (input.clipTitle || "MOMEN VIRAL PILIHAN").replace(/[{}\\"]/g, "").toUpperCase();
    rawEvents.push({
      start: 0,
      end: totalDuration,
      text: `{\\an5\\pos(540,${subtitleY})\\bord8\\3c${highlightBorderColor}\\1c${primaryColor}}${fallbackText}`,
    });
  }

  // ZERO COLLISION CLAMPING (MANDATORY RULE)
  // Formula: event[i].end = Math.min(event[i].end, event[i+1].start)
  for (let i = 0; i < rawEvents.length; i++) {
    const current = rawEvents[i]!;
    if (i < rawEvents.length - 1) {
      const next = rawEvents[i + 1]!;
      current.end = Math.min(current.end, next.start);
      if (current.end < current.start) {
        current.end = current.start;
      }
    }
    if (current.end > totalDuration) {
      current.end = totalDuration;
    }
  }

  for (const ev of rawEvents) {
    if (ev.end - ev.start < 0.05) continue;
    if (ev.text.startsWith("{\\")) {
      dialogueLines.push(
        `Dialogue: 0,${formatAssTime(ev.start)},${formatAssTime(ev.end)},Default,,0,0,0,,${ev.text}`
      );
    } else {
      dialogueLines.push(
        `Dialogue: 0,${formatAssTime(ev.start)},${formatAssTime(ev.end)},Default,,0,0,0,,{\\an5\\pos(540,${subtitleY})\\fad(40,40)}${ev.text}`
      );
    }
  }

  const fullAss = assHeader + dialogueLines.join("\n") + "\n";
  fs.writeFileSync(assFilePath, fullAss, "utf-8");
  console.log(`[AssGenerator] Subtitle .ass anti-collision dibuat: ${assFilePath} (${dialogueLines.length} baris, font: ${fontInfo.fontName})`);
  return assFilePath;
}
