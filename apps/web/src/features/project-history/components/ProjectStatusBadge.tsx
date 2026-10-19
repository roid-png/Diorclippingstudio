import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { ProjectWorkflowStage } from "../types";

interface ProjectStatusBadgeProps {
  stage: ProjectWorkflowStage;
  stageLabel: string;
  completedClipsCount: number;
  requestedClipsCount: number;
}

const STAGE_META: Record<
  ProjectWorkflowStage,
  {
    shortTag: string;
    stepNum: number;
    badgeClasses: string;
    dotClasses: string;
  }
> = {
  "viral-detected": {
    shortTag: "Tahap 2/4 • Deteksi Viral",
    stepNum: 2,
    badgeClasses:
      "border-cyan-500/40 bg-cyan-950/40 text-cyan-200 shadow-cyan-950/30",
    dotClasses: "bg-cyan-400",
  },
  "auto-edit": {
    shortTag: "Tahap 3/4 • Edit 3 Pilar",
    stepNum: 3,
    badgeClasses:
      "border-purple-500/40 bg-purple-950/40 text-purple-200 shadow-purple-950/30",
    dotClasses: "bg-purple-400",
  },
  rendering: {
    shortTag: "Tahap 4/4 • Merender MP4",
    stepNum: 4,
    badgeClasses:
      "border-amber-500/40 bg-amber-950/40 text-amber-200 shadow-amber-950/30",
    dotClasses: "bg-amber-400 animate-pulse",
  },
  completed: {
    shortTag: "Selesai • Siap Unduh MP4",
    stepNum: 4,
    badgeClasses:
      "border-emerald-500/40 bg-emerald-950/40 text-emerald-200 shadow-emerald-950/30",
    dotClasses: "bg-emerald-400",
  },
  failed: {
    shortTag: "Kendala Render • Retry",
    stepNum: 4,
    badgeClasses:
      "border-rose-500/50 bg-rose-950/40 text-rose-200 shadow-rose-950/30",
    dotClasses: "bg-rose-400",
  },
};

export function ProjectStatusBadge({
  stage,
  stageLabel,
  completedClipsCount,
  requestedClipsCount,
}: ProjectStatusBadgeProps) {
  const meta = STAGE_META[stage];
  const progressPercent =
    requestedClipsCount > 0
      ? Math.round((completedClipsCount / requestedClipsCount) * 100)
      : 0;

  return (
    <div className="flex flex-col items-start sm:items-end gap-1.5">
      <div
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-sm ${meta.badgeClasses}`}
      >
        <span className={`h-2 w-2 rounded-full shrink-0 ${meta.dotClasses}`} />
        {stage === "completed" ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        ) : stage === "rendering" ? (
          <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin shrink-0" />
        ) : stage === "failed" ? (
          <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
        ) : stage === "auto-edit" ? (
          <Wand2 className="h-3.5 w-3.5 text-purple-400 shrink-0" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
        )}
        <span>{stageLabel}</span>
      </div>

      {/* Mini Workflow Stepper Indicator */}
      <div className="flex items-center gap-2 text-[10px] text-slate-400">
        <span className="font-semibold text-slate-300">{meta.shortTag}</span>
        <span>•</span>
        <span className="inline-flex items-center gap-1 font-mono text-slate-300">
          <Clock className="h-3 w-3 text-slate-400" />
          {completedClipsCount}/{requestedClipsCount} MP4 ({progressPercent}%)
        </span>
      </div>
    </div>
  );
}

