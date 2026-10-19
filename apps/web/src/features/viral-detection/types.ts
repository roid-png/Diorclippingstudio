export type HookCategory =
  | "all"
  | "top3"
  | "mega"
  | "controversy"
  | "insight"
  | "story";

export type ViralClipCategory = "controversy" | "insight" | "story";

export interface CategoryMeta {
  id: ViralClipCategory;
  label: string;
  shortLabel: string;
  icon: string;
  badgeClass: string;
  glowClass: string;
  borderClass: string;
  accentColor: string;
  description: string;
  algorithmReason: string;
}

export interface ViralTierMeta {
  tier: "mega" | "fyp" | "trending" | "standard";
  label: string;
  shortLabel: string;
  badgeText: string;
  flameColor: string;
  badgeClass: string;
  reachPrediction: string;
  description: string;
}

export interface ViralClipMetric {
  hookRetention: number; // 0 - 100%
  sentimentEnergy: number; // 0 - 100%
  punchlineScore: number; // 0 - 100%
}

export interface ViralSubtitleCue {
  time: number;
  speaker?: "NARASUMBER" | "HOST" | string;
  text: string;
}

export interface ViralClipItem {
  id: string;
  rank: number;
  title: string;
  viralScore: number;
  viralScoreFormatted: string;
  category: ViralClipCategory;
  hookBadge: string;
  highlightMoment: string;
  whyViral: string;
  timeRange: string;
  duration: string;
  imageSrc: string;
  videoSrc?: string;
  subtitles: ViralSubtitleCue[];
  isSelected: boolean;
  metrics: ViralClipMetric;
}

export interface ViralFilterState {
  category: HookCategory;
  sortBy: "viral-desc" | "viral-asc" | "timeline-asc" | "duration-desc";
  searchQuery: string;
}

export function getCategoryMeta(category: ViralClipCategory): CategoryMeta {
  switch (category) {
    case "controversy":
      return {
        id: "controversy",
        label: "Kontroversi & Opini Berani",
        shortLabel: "Kontroversi",
        icon: "💥",
        badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40",
        glowClass: "shadow-[0_0_12px_rgba(244,63,94,0.25)]",
        borderClass: "border-rose-500/30",
        accentColor: "#f43f5e",
        description: "Opini tajam yang memicu perdebatan panas & rasio komentar tinggi.",
        algorithmReason:
          "Algoritma media sosial memprioritaskan video dengan perdebatan aktif di kolom komentar, mendorong retensi hingga 3.2x lipat.",
      };
    case "insight":
      return {
        id: "insight",
        label: "Wawasan & Edukasi Praktis",
        shortLabel: "Wawasan",
        icon: "💡",
        badgeClass: "bg-teal-500/20 text-[#2cd3c6] border-[#2cd3c6]/40",
        glowClass: "shadow-[0_0_12px_rgba(44,211,198,0.25)]",
        borderClass: "border-[#2cd3c6]/30",
        accentColor: "#2cd3c6",
        description: "Pelajaran aplikatif & framework bernilai tinggi yang langsung bermanfaat.",
        algorithmReason:
          "Tingkat save/bookmark dan share ke grup WhatsApp/DM sangat tinggi karena bernilai edukasi praktis bagi audiens.",
      };
    case "story":
      return {
        id: "story",
        label: "Kisah Nyata & Solusi",
        shortLabel: "Kisah Nyata",
        icon: "🏆",
        badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        glowClass: "shadow-[0_0_12px_rgba(245,158,11,0.25)]",
        borderClass: "border-amber-500/30",
        accentColor: "#f59e0b",
        description: "Naratif emosional dan pembuktian empiris yang memikat perhatian penonton.",
        algorithmReason:
          "Emosi dan rasa ingin tahu membuat penonton menonton hingga akhir (completion rate > 80%), mendongkrak distribusi ke FYP luas.",
      };
    default:
      return {
        id: "insight",
        label: "Wawasan",
        shortLabel: "Wawasan",
        icon: "💡",
        badgeClass: "bg-teal-500/20 text-[#2cd3c6] border-[#2cd3c6]/40",
        glowClass: "shadow-[0_0_12px_rgba(44,211,198,0.25)]",
        borderClass: "border-[#2cd3c6]/30",
        accentColor: "#2cd3c6",
        description: "Pelajaran aplikatif bernilai tinggi.",
        algorithmReason: "Tingkat save dan share tinggi.",
      };
  }
}

export function getViralScoreMeta(score: number): ViralTierMeta {
  if (score >= 95) {
    return {
      tier: "mega",
      label: "Mega Viral (>500k Views)",
      shortLabel: "Mega Viral",
      badgeText: "🔥 Mega Viral",
      flameColor: "text-amber-400 fill-amber-400",
      badgeClass:
        "bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-300 border-amber-400/50 shadow-[0_0_12px_rgba(251,191,36,0.25)]",
      reachPrediction: "500k - 2jt+ Views",
      description:
        "Skor luar biasa! Hook 3 detik sangat agresif dengan retensi audiens di atas 95%.",
    };
  }
  if (score >= 90) {
    return {
      tier: "fyp",
      label: "Potensi FYP (100k - 500k Views)",
      shortLabel: "Potensi FYP",
      badgeText: "⚡ Potensi FYP",
      flameColor: "text-cyan-400 fill-cyan-400",
      badgeClass:
        "bg-gradient-to-r from-[#146b77]/30 to-[#2cd3c6]/20 text-[#2cd3c6] border-[#2cd3c6]/50 shadow-[0_0_12px_rgba(44,211,198,0.25)]",
      reachPrediction: "100k - 500k Views",
      description:
        "Potensi FYP tinggi dengan transisi narasi yang kuat dan konsistensi energi pembicara.",
    };
  }
  if (score >= 85) {
    return {
      tier: "trending",
      label: "Tren Bagus (50k - 100k Views)",
      shortLabel: "Tren Bagus",
      badgeText: "📈 Tren Bagus",
      flameColor: "text-emerald-400 fill-emerald-400",
      badgeClass:
        "bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-[0_0_10px_rgba(52,211,153,0.2)]",
      reachPrediction: "50k - 100k Views",
      description:
        "Topik relevan dengan penyampaian jelas, cocok untuk konsistensi posting harian.",
    };
  }
  return {
    tier: "standard",
    label: "Standar (10k - 50k Views)",
    shortLabel: "Standar",
    badgeText: "🎯 Standar",
    flameColor: "text-slate-400 fill-slate-400",
    badgeClass: "bg-slate-500/20 text-slate-300 border-slate-400/50",
    reachPrediction: "10k - 50k Views",
    description: "Klip pelengkap yang tetap solid untuk membangun katalog konten.",
  };
}
