import type {
  EditingStylePreset,
  MotionGraphicPreset,
  SubtitleStylePreset,
} from "../studio/presets/types";

export type { EditingStylePreset, MotionGraphicPreset, SubtitleStylePreset };

export interface AutoEditSubtitleLine {
  id: string;
  startTime: number;
  endTime: number;
  speaker: "NARASUMBER" | "HOST";
  text: string;
}

export interface InfographicDataOverlay {
  heading: string;
  subHeading: string;
  bars: Array<{
    label: string;
    value: number;
    statusText: string;
    color: "red" | "emerald" | "cyan" | "amber";
  }>;
}

export interface AutoEditClipConfig {
  editingStyleId: string;
  motionGraphicId: string;
  subtitleStyleId: string;
  subtitleEnabled: boolean;
  subtitlePosition: "bottom" | "center" | "top";
  subtitleSize: "sm" | "md" | "lg";
  transitionType: "jump-cut" | "j-cut-cinema" | "flash-zoom" | "smooth-dissolve";
  colorGrade: "dark-teal-moody" | "netflix-warm" | "crisp-contrast" | "natural";
  autoZoomEnabled: boolean;
  progressBarEnabled: boolean;
  infographicEnabled: boolean;
  sfxEnabled: boolean;
}

export interface AutoEditClipItem {
  id: string;
  rank: number;
  title: string;
  duration: string;
  durationSeconds: number;
  timeRange: string;
  viralScore: string;
  categoryLabel: string;
  imageSrc: string;
  videoSrc?: string;
  infographicData: InfographicDataOverlay;
  subtitles: AutoEditSubtitleLine[];
  config: AutoEditClipConfig;
}
