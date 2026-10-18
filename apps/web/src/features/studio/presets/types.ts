export interface EditingStylePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  badge?: string;
  layout: "center-ambient" | "full-crop" | "split-screen" | "talking-head";
  aspectRatio: "9:16";
  sourceReference?: string;
}

export interface MotionGraphicPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  badge?: string;
  type: "infographic-bars" | "stat-counter" | "progress-zoom" | "none";
  features: string[];
}

export interface SubtitleStylePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  badge?: string;
  fontFamily: string;
  speakerBadge: boolean;
  highlightStyle: "red-pill" | "yellow-glow" | "white-shadow" | "karaoke";
}

