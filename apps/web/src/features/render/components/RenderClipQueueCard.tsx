import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Film,
  Flame,
  HardDrive,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Type,
  XCircle,
  Zap,
} from "lucide-react";
import { RENDER_PIPELINE_STEPS } from "../mock-data";
import type { RenderClipItem } from "../types";

interface RenderClipQueueCardProps {
  clip: RenderClipItem;
  onToggleSelect: (clipId: string) => void;
  onStartRender: (clipId: string) => void;
  onCancelRender: (clipId: string) => void;
  onRetryRender: (clipId: string) => void;
  onOpenPreview: (clip: RenderClipItem) => void;
  onDownloadClip: (clip: RenderClipItem) => void;
}

export function RenderClipQueueCard({
  clip,
  onToggleSelect,
  onStartRender,
  onCancelRender,
  onRetryRender,
  onOpenPreview,
  onDownloadClip,
}: RenderClipQueueCardProps) {
  const isCompleted = clip.status === "completed";
  const isRendering = clip.status === "rendering";
  const isQueued = clip.status === "queued";
  const isFailed = clip.status === "failed";
  const isIdle = clip.status === "idle";

  const renderStatusBadge = () => {
    if (isCompleted) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          Selesai Dirender • Siap Unduh
        </span>
      );
    }
    if (isRendering) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-500/50 px-3 py-1 text-xs font-bold text-red-200 animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-red-400" />
          Merender Cepat ({clip.progress}%)
        </span>
      );
    }
    if (isQueued) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 px-3 py-1 text-xs font-bold text-cyan-300">
          <Clock className="h-3.5 w-3.5 text-cyan-400" />
          Dalam Antrean Batch
        </span>
      );
    }
    if (isFailed) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-500/50 px-3 py-1 text-xs font-bold text-rose-300">
          <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
          Gagal Render • Perlu Retry
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/90 border border-slate-600/50 px-3 py-1 text-xs font-semibold text-slate-300">
        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
        Siap Render Cepat
      </span>
    );
  };

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 transition-all ${
        isRendering
          ? "border-red-500/60 bg-gradient-to-r from-[#131d24] via-[#1a1822] to-[#11242b] shadow-xl shadow-red-950/30"
          : isCompleted
          ? "border-emerald-500/40 bg-[#0b1e24]/95"
          : isFailed
          ? "border-rose-500/50 bg-[#1a1319]/95"
          : "border-[#1b3942] bg-[#0b1a1f]/90 hover:border-[#254d59]"
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Checkbox + 9:16 Mini Thumbnail + Metadata */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={clip.isSelectedForRender}
            onChange={() => onToggleSelect(clip.id)}
            aria-label={`Pilih ${clip.title}`}
            className="mt-2 h-4 w-4 rounded border-slate-600 bg-slate-900 text-red-600 focus:ring-red-500 cursor-pointer"
          />

          {/* 9:16 Vertical Preview Thumbnail */}
          <button
            type="button"
            onClick={() => onOpenPreview(clip)}
            className="group relative h-28 w-16 shrink-0 overflow-hidden rounded-xl border border-[#274e5a] bg-black cursor-pointer"
            title="Klik untuk memutar pratinjau 9:16"
          >
            <video
              src={clip.videoUrl}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover opacity-85 group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition flex items-center justify-center">
              <div className="rounded-full bg-black/70 p-1.5 text-white shadow">
                <Play className="h-3.5 w-3.5 fill-white" />
              </div>
            </div>
            <div className="absolute top-1 left-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-300">
              #{clip.rank}
            </div>
            <div className="absolute bottom-1 inset-x-1 text-center rounded bg-red-600/90 text-[9px] font-bold text-white">
              {clip.durationSeconds}s
            </div>
          </button>

          {/* Clip Details & 3-Pillar Summary */}
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-300">
                  <Flame className="h-3 w-3 fill-amber-400" />
                  Skor Viral {clip.viralScore}%
                </span>
                <span className="text-xs text-slate-400">
                  Segmen {clip.startTimeFormatted} – {clip.endTimeFormatted}
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-300">
                  <HardDrive className="h-3 w-3 text-slate-400" />
                  {clip.fileSizeMb} MB ({clip.resolution} • {clip.fps}FPS)
                </span>
              </div>

              {renderStatusBadge()}
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white truncate">
              {clip.title}
            </h3>

            {/* 3-Pillar Active Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-950/60 border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-200">
                <Film className="h-3.5 w-3.5 text-red-400" />
                1. Edit: {clip.pillarConfig.editingStyleName}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-950/50 border border-amber-500/30 px-2.5 py-1 text-xs font-medium text-amber-200">
                <Layers className="h-3.5 w-3.5 text-amber-400" />
                2. Motion: {clip.pillarConfig.motionGraphicName}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-1 text-xs font-medium text-emerald-200">
                <Type className="h-3.5 w-3.5 text-emerald-400" />
                3. Subtitle:{" "}
                {clip.pillarConfig.subtitleEnabled
                  ? clip.pillarConfig.subtitleStyleName
                  : "Nonaktif"}
              </span>
              <Link
                to="/auto-edit"
                className="text-[11px] font-semibold text-[#2cd3c6] hover:underline ml-1"
              >
                Ubah Preset →
              </Link>
            </div>

            {/* 5-Stage Render Pipeline Progress Indicator */}
            <div className="pt-1.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span
                  className={
                    isCompleted
                      ? "text-emerald-300 font-medium"
                      : isRendering
                      ? "text-red-300 font-semibold"
                      : isFailed
                      ? "text-rose-300 font-semibold"
                      : "text-slate-400"
                  }
                >
                  {isFailed
                    ? clip.errorMessage ||
                      "Terjadi kendala saat kompilasi container MP4. Klik Coba Lagi."
                    : clip.activeStepLabel}
                </span>
                <span className="font-bold text-slate-200">
                  {isCompleted
                    ? `100% • ${clip.completedAt || "Selesai"}`
                    : isRendering
                    ? `${clip.progress}% (ETA ~${clip.etaSeconds} dtk)`
                    : isQueued
                    ? "Menunggu Giliran..."
                    : isFailed
                    ? "Terhenti"
                    : "0% (Siap)"}
                </span>
              </div>

              <div className="h-2 w-full rounded-full bg-[#132a31] overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isCompleted
                      ? "bg-emerald-500"
                      : isRendering
                      ? "bg-gradient-to-r from-red-600 via-amber-500 to-emerald-400"
                      : isFailed
                      ? "bg-rose-600"
                      : "bg-slate-700"
                  }`}
                  style={{
                    width: `${isCompleted ? 100 : clip.progress}%`,
                  }}
                />
              </div>

              {/* Pipeline Step Pills */}
              <div className="grid grid-cols-5 gap-1 pt-0.5">
                {RENDER_PIPELINE_STEPS.map((step, idx) => {
                  const prevThreshold =
                    idx === 0 ? 0 : RENDER_PIPELINE_STEPS[idx - 1].threshold;
                  const stepDone =
                    isCompleted || clip.progress >= step.threshold;
                  const stepCurrent =
                    isRendering &&
                    clip.progress >= prevThreshold &&
                    clip.progress < step.threshold;
                  return (
                    <div
                      key={step.id}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold truncate text-center border ${
                        stepDone
                          ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                          : stepCurrent
                          ? "border-red-500/50 bg-red-950/50 text-red-200"
                          : "border-[#18333b] bg-[#0d1f24] text-slate-500"
                      }`}
                    >
                      {idx + 1}. {step.id.replace("-", " ").toUpperCase()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Action Buttons based on clip render status */}
        <div className="flex flex-wrap lg:flex-col items-stretch justify-end gap-2 shrink-0 lg:w-48">
          {isIdle && (
            <button
              type="button"
              onClick={() => onStartRender(clip.id)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-red-950/50 hover:from-red-500 hover:to-rose-500 transition cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5" />
              Render Cepat Sekarang
            </button>
          )}

          {(isRendering || isQueued) && (
            <button
              type="button"
              onClick={() => onCancelRender(clip.id)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-2 text-xs font-bold text-rose-200 hover:bg-rose-900/50 transition cursor-pointer"
            >
              <XCircle className="h-3.5 w-3.5 text-rose-400" />
              Batalkan Render
            </button>
          )}

          {isFailed && (
            <button
              type="button"
              onClick={() => onRetryRender(clip.id)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-amber-400 transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Coba Lagi (Retry)
            </button>
          )}

          {isCompleted && (
            <>
              <button
                type="button"
                onClick={() => onDownloadClip(clip)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-950/50 hover:bg-emerald-500 transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh MP4 ({clip.fileSizeMb} MB)
              </button>
              <button
                type="button"
                onClick={() => onStartRender(clip.id)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#244854] bg-[#102329] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Render Ulang
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => onOpenPreview(clip)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#244854] bg-[#122830] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-[#193540] hover:text-white transition cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 text-amber-400" />
            Pratinjau Hasil 9:16
          </button>
        </div>
      </div>
    </div>
  );
}
