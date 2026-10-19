export type HookCategory = "all" | "top3" | "controversy" | "insight" | "story";

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
  category: "controversy" | "insight" | "story";
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
  sortBy: "viral-desc" | "timeline-asc" | "duration-desc";
  searchQuery: string;
}
