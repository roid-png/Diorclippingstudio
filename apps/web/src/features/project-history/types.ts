export type ProjectSourceType = "youtube" | "upload";

export type ProjectWorkflowStage =
  | "completed"
  | "rendering"
  | "auto-edit"
  | "viral-detected"
  | "failed";

export interface ProjectClipSummary {
  id: string;
  rank: number;
  title: string;
  durationSec: 30 | 45 | 60;
  viralScore: number;
  status: "completed" | "rendering" | "ready" | "failed";
  editingStyleName: string;
  motionGraphicName: string;
  subtitleStyleName: string;
  videoUrl: string;
  fileSizeMb: number;
}

export interface ProjectHistoryItem {
  id: string;
  title: string;
  channelOrCreator: string;
  sourceType: ProjectSourceType;
  sourceUrl?: string;
  sourceFileName?: string;
  thumbnailUrl: string;
  originalDurationLabel: string;
  targetClipDurationSec: 30 | 45 | 60;
  requestedClipsCount: number; // Max 10
  completedClipsCount: number;
  topViralScore: number;
  avgViralScore: number;
  stage: ProjectWorkflowStage;
  stageLabel: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  defaultPillarSummary: {
    editingStyleName: string;
    motionGraphicName: string;
    subtitleStyleName: string;
  };
  clips: ProjectClipSummary[];
}

