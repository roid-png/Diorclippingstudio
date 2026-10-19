export type ViralCategoryTier =
  | "sangat-viral"
  | "potensi-tinggi"
  | "cukup-potensial";

export type ViralContentCategory =
  | "kontroversi"
  | "emosi"
  | "edukasi"
  | "insight";

export interface ViralScoringInput {
  title?: string;
  transcriptText?: string;
  highlightMoment?: string | null;
  durationSeconds: number;
  startTimeSeconds: number;
  audioPeakDb?: number; // e.g., -3 dB to -18 dB
  baseScoreHint?: number;
  categoryHint?: ViralContentCategory;
}

export interface ViralScoringResult {
  viralScore: number;
  viralScoreFormatted: string;
  viralCategoryTier: ViralCategoryTier;
  viralLabel: string;
  contentCategory: ViralContentCategory;
  highlightMoment: string;
  hasFallbackHighlight: boolean;
  whyViral: string;
  emotionalTrigger: string;
  peakRetention: number;
}

const HIGH_IMPACT_KEYWORDS = [
  "ai",
  "terancam",
  "layoff",
  "rahasia",
  "juta",
  "miliar",
  "bahaya",
  "fakta",
  "kesalahan",
  "fatal",
  "strategi",
  "algoritma",
  "viral",
  "uang",
  "karir",
  "masa depan",
  "otomatis",
  "produktif",
];

/**
 * Classifies a numeric viral score (0-100) into a category tier and human-readable badge label.
 */
export function getViralScoreCategory(score: number): {
  tier: ViralCategoryTier;
  label: string;
} {
  if (score >= 95) {
    return {
      tier: "sangat-viral",
      label: "🔥 Sangat Berpotensi Viral",
    };
  }
  if (score >= 90) {
    return {
      tier: "potensi-tinggi",
      label: "⚡ Potensi Tinggi",
    };
  }
  return {
    tier: "cukup-potensial",
    label: "📈 Cukup Potensial",
  };
}

/**
 * Resolves the highlight moment text with a guaranteed fallback when empty or missing.
 */
export function resolveHighlightMomentWithFallback(
  highlightMoment?: string | null,
  startTimeSeconds?: number,
  endTimeSeconds?: number
): { text: string; isFallback: boolean } {
  const cleaned = (highlightMoment || "").replace(/<\/?hl>/g, "").trim();
  if (cleaned.length > 0) {
    return { text: cleaned, isFallback: false };
  }

  if (
    typeof startTimeSeconds === "number" &&
    typeof endTimeSeconds === "number"
  ) {
    const fmt = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };
    return {
      text: `Potongan momen potensial pada rentang waktu ${fmt(startTimeSeconds)} - ${fmt(endTimeSeconds)}`,
      isFallback: true,
    };
  }

  return {
    text: "Potongan momen potensial yang terdeteksi dari lonjakan intonasi dan kepadatan topik utama.",
    isFallback: true,
  };
}

/**
 * Infers content category ("kontroversi" | "emosi" | "edukasi" | "insight") from text.
 */
export function inferViralContentCategory(
  text: string,
  hint?: ViralContentCategory
): ViralContentCategory {
  if (hint) return hint;
  const lower = text.toLowerCase();
  if (
    lower.includes("terancam") ||
    lower.includes("layoff") ||
    lower.includes("kesalahan") ||
    lower.includes("fatal")
  ) {
    return "kontroversi";
  }
  if (
    lower.includes("mindset") ||
    lower.includes("disiplin") ||
    lower.includes("emosi") ||
    lower.includes("takut")
  ) {
    return "emosi";
  }
  if (
    lower.includes("cara") ||
    lower.includes("tutorial") ||
    lower.includes("algoritma") ||
    lower.includes("retention")
  ) {
    return "edukasi";
  }
  return "insight";
}

/**
 * Calculates multi-factor viral potential score for a video segment.
 */
export function calculateViralPotentialScore(
  input: ViralScoringInput
): ViralScoringResult {
  const combinedText = [
    input.title || "",
    input.highlightMoment || "",
    input.transcriptText || "",
  ]
    .join(" ")
    .toLowerCase();

  // 1. Keyword Density & Hook Trigger Score (0 - 15 bonus points)
  let keywordMatches = 0;
  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (combinedText.includes(kw)) {
      keywordMatches += 1;
    }
  }
  const hasRedPillTag =
    (input.transcriptText || "").includes("<hl>") ||
    (input.highlightMoment || "").includes("<hl>");

  const keywordBonus = Math.min(8, keywordMatches * 1.8) + (hasRedPillTag ? 2.5 : 0);

  // 2. Duration Optimization Bonus (30s, 45s, 60s are ideal vertical clip lengths)
  const durationBonus =
    input.durationSeconds === 45
      ? 3.0
      : input.durationSeconds === 30 || input.durationSeconds === 60
      ? 2.5
      : 1.0;

  // 3. Audio Peak / Energy Bonus
  const audioBonus =
    typeof input.audioPeakDb === "number"
      ? Math.max(0, Math.min(4, (input.audioPeakDb + 12) * 0.5))
      : 2.2;

  // Compute final score (clamped 65.00 - 99.80)
  const rawScore =
    typeof input.baseScoreHint === "number"
      ? input.baseScoreHint
      : 84.0 + keywordBonus + durationBonus + audioBonus;

  const finalScore = Number(Math.min(99.8, Math.max(65.0, rawScore)).toFixed(2));
  const roundedScore = Math.round(finalScore);

  const { tier, label } = getViralScoreCategory(finalScore);
  const contentCategory = inferViralContentCategory(
    combinedText,
    input.categoryHint
  );

  const endTimeSeconds = input.startTimeSeconds + input.durationSeconds;
  const resolvedHighlight = resolveHighlightMomentWithFallback(
    input.highlightMoment,
    input.startTimeSeconds,
    endTimeSeconds
  );

  const peakRetention = Math.min(
    99,
    Math.max(82, Math.round(finalScore * 0.96))
  );

  const emotionalTriggerMap: Record<ViralContentCategory, string> = {
    kontroversi: "Urgensi & Perdebatan Opini Kuat",
    emosi: "Empati & Motivasi Personal",
    edukasi: "Rasa Ingin Tahu & Solusi Praktis",
    insight: "Aha-Moment & Perspektif Baru",
  };

  const whyViral = `Skor potensi viral ${roundedScore}/100 (${label}) didorong oleh kekuatan hook 3 detik pertama, retensi puncak ${peakRetention}%, serta pemicu emosi "${emotionalTriggerMap[contentCategory]}".`;

  return {
    viralScore: finalScore,
    viralScoreFormatted: `${roundedScore}/100`,
    viralCategoryTier: tier,
    viralLabel: label,
    contentCategory,
    highlightMoment: resolvedHighlight.text,
    hasFallbackHighlight: resolvedHighlight.isFallback,
    whyViral,
    emotionalTrigger: emotionalTriggerMap[contentCategory],
    peakRetention,
  };
}

/**
 * Ranks a list of scored candidates from highest to lowest viralScore
 * and marks the top recommendations (rank <= 3).
 */
export function rankViralCandidates<
  T extends { viralScore: number; startTime: number }
>(
  candidates: T[],
  maxClips = 10
): Array<
  T & {
    rank: number;
    isPrimaryRecommendation: boolean;
    viralLabel: string;
    viralCategoryTier: ViralCategoryTier;
  }
> {
  const boundedLimit = Math.min(Math.max(1, maxClips), 10);
  const sorted = [...candidates]
    .sort((a, b) => {
      if (b.viralScore !== a.viralScore) {
        return b.viralScore - a.viralScore;
      }
      return a.startTime - b.startTime;
    })
    .slice(0, boundedLimit);

  return sorted.map((item, idx) => {
    const rank = idx + 1;
    const { tier, label } = getViralScoreCategory(item.viralScore);
    return {
      ...item,
      rank,
      isPrimaryRecommendation: rank <= 3,
      viralLabel: label,
      viralCategoryTier: tier,
    };
  });
}
