export type RenderJobStatus =
  | "idle"
  | "queued"
  | "rendering"
  | "completed"
  | "failed";

export type RenderPipelineStepId =
  | "crop-9-16"
  | "color-grading"
  | "motion-hud"
  | "subtitle-burn"
  | "mux-export";

export type RenderSpeedMode = "turbo-fast" | "cinema-hq";

export interface RenderClipPillarConfig {
  editingStyleId: string;
  editingStyleName: string;
  motionGraphicId: string;
  motionGraphicName: string;
  subtitleStyleId: string;
  subtitleStyleName: string;
  subtitleEnabled: boolean;
  highlightColor: string;
}

export interface RenderClipItem {
  id: string;
  rank: number;
  title: string;
  sourceTitle: string;
  durationSeconds: number;
  startTimeFormatted: string;
  endTimeFormatted: string;
  viralScore: number;
  viralLabel: string;
  isSelectedForRender: boolean;
  status: RenderJobStatus;
  progress: number;
  activeStepId: RenderPipelineStepId;
  activeStepLabel: string;
  etaSeconds: number;
  renderDurationMs?: number;
  fileSizeMb: number;
  resolution: "1080x1920" | "720x1280";
  fps: 60 | 30;
  videoUrl: string;
  downloadFileName: string;
  errorMessage?: string;
  completedAt?: string;
  pillarConfig: RenderClipPillarConfig;
}

export interface RenderBatchSummary {
  totalClips: number;
  selectedCount: number;
  completedCount: number;
  renderingCount: number;
  queuedCount: number;
  failedCount: number;
  overallProgress: number;
  estimatedTotalSeconds: number;
}

