import {
  Activity,
  CheckCircle2,
  Clock,
  Cpu,
  Gauge,
  Layers,
  Loader2,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import { RENDER_PIPELINE_STEPS } from "../mock-data";
import type { RenderClipItem, RenderSpeedMode } from "../types";

interface RenderProgressTelemetryPanelProps {
  clips: RenderClipItem[];
  speedMode: RenderSpeedMode;
  resolution: "1080x1920" | "720x1280";
  fps: 60 | 30;
}

export function RenderProgressTelemetryPanel({
  clips,
  speedMode,
  resolution,
  fps,
}: RenderProgressTelemetryPanelProps) {
  const selectedClips = clips.filter((c) => c.isSelectedForRender);
  const activeRenderingClip = clips.find((c) => c.status === "rendering");
  const queuedClips = clips.filter((c) => c.status === "queued");
  const completedClips = selectedClips.filter((c) => c.status === "completed");

  const overallProgress =
    selectedClips.length > 0
      ? Math.round(
          selectedClips.reduce(
            (acc, c) => acc + (c.status === "completed" ? 100 : c.progress),
            0
          ) / selectedClips.length
        )
      : 0;

  const perClipBaseSeconds = speedMode === "turbo-fast" ? 4.2 : 7.5;
  const activeRemainingSeconds = activeRenderingClip
    ? Math.max(
        1,
        Math.ceil(
          ((100 - activeRenderingClip.progress) / 100) * perClipBaseSeconds
        )
      )
    : 0;
  const queuedRemainingSeconds = Math.ceil(
    queuedClips.length * perClipBaseSeconds
  );
  const totalEstimatedEtaSeconds =
    activeRemainingSeconds + queuedRemainingSeconds;

  const encodingSpeedMultiplier =
    speedMode === "turbo-fast" ? "11.4x Real-Time" : "6.2x Real-Time";
  const effectiveThroughputFps = speedMode === "turbo-fast" ? 215 : 128;

  return (
    <div className="rounded-2xl border border-[#1d3f49] bg-gradient-to-br from-[#0b1c21] via-[#0e2228] to-[#0a181c] p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#17333b] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
              activeRenderingClip
                ? "border-red-500/50 bg-red-600/20 text-red-400"
                : "border-emerald-500/40 bg-emerald-600/15 text-emerald-400"
            }`}
          >
            {activeRenderingClip ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Activity className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                Monitor Progres Render & Estimasi Waktu (Real-Time Telemetry)
              </h3>
              <span className="rounded-md bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-[10px] font-bold text-red-300">
                {speedMode === "turbo-fast"
                  ? "NVENC TURBO"
                  : "MASTER CINEMA HQ"}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {activeRenderingClip
                ? `Sedang merender Klip #${activeRenderingClip.rank}: "${activeRenderingClip.title}"`
                : completedClips.length === selectedClips.length &&
                  selectedClips.length > 0
                ? `Seluruh ${completedClips.length} klip terpilih telah selesai dirender 100% dan siap diunduh.`
                : `${completedClips.length} dari ${selectedClips.length} klip selesai • Klik "Render Cepat" untuk memproses antrean.`}
            </p>
          </div>
        </div>

        {/* ETA & Speed Readout Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-1.5 text-xs">
            <Timer className="h-4 w-4 text-amber-400" />
            <span className="text-slate-300">Estimasi Selesai:</span>
            <span className="font-extrabold text-amber-300">
              {activeRenderingClip || queuedClips.length > 0
                ? `~${totalEstimatedEtaSeconds} detik`
                : `~${Math.ceil(
                    Math.max(
                      0,
                      selectedClips.length - completedClips.length
                    ) * perClipBaseSeconds
                  )} detik`}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#234854] bg-[#10262d] px-3 py-1.5 text-xs">
            <Gauge className="h-4 w-4 text-[#2cd3c6]" />
            <span className="font-bold text-[#2cd3c6]">
              {encodingSpeedMultiplier}
            </span>
            <span className="text-slate-400">({effectiveThroughputFps} fps)</span>
          </div>
        </div>
      </div>

      {/* Dual Progress Bar: Overall Batch + Active Clip Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overall Batch Progress */}
        <div className="rounded-xl border border-[#193841] bg-[#09161a]/90 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-purple-400" />
              Progres Kumulatif Batch ({completedClips.length}/
              {selectedClips.length} Klip Selesai)
            </span>
            <span className="text-sm font-black text-white">
              {overallProgress}%
            </span>
          </div>

          <div className="h-2.5 w-full rounded-full bg-[#132c33] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Output: {resolution} • {fps} FPS • H.264 MP4
            </span>
            <span>
              Antrean Tunggu: {queuedClips.length} Klip
            </span>
          </div>
        </div>

        {/* Active Clip Step-by-Step Progress */}
        <div className="rounded-xl border border-[#193841] bg-[#09161a]/90 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-red-400" />
              {activeRenderingClip
                ? `Tahap Aktif: ${activeRenderingClip.activeStepLabel}`
                : "Tahap Pipeline Kompilasi 3 Pilar Siap"}
            </span>
            <span className="text-sm font-black text-emerald-300">
              {activeRenderingClip
                ? `${activeRenderingClip.progress}% (ETA ${activeRemainingSeconds}s)`
                : "IDLE / READY"}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 pt-0.5">
            {RENDER_PIPELINE_STEPS.map((step, idx) => {
              const currentProg = activeRenderingClip
                ? activeRenderingClip.progress
                : overallProgress === 100
                ? 100
                : 0;
              const isStepDone = currentProg >= step.threshold;
              const prevThreshold =
                idx === 0 ? 0 : RENDER_PIPELINE_STEPS[idx - 1].threshold;
              const isStepActive =
                Boolean(activeRenderingClip) &&
                currentProg >= prevThreshold &&
                currentProg < step.threshold;

              return (
                <div
                  key={step.id}
                  className={`rounded-lg border px-2 py-1.5 text-center transition ${
                    isStepDone
                      ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
                      : isStepActive
                      ? "border-red-500/60 bg-red-950/50 text-red-200 animate-pulse"
                      : "border-[#163038] bg-[#0c1d22] text-slate-500"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold">
                    {isStepDone ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                    ) : isStepActive ? (
                      <Zap className="h-3 w-3 text-red-400 shrink-0" />
                    ) : (
                      <Clock className="h-3 w-3 text-slate-600 shrink-0" />
                    )}
                    <span className="truncate">Tahap {idx + 1}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-400" />
              Audio Mastering: -14 LUFS Broadcast Standard
            </span>
            <span className="text-emerald-400 font-semibold">
              Zero Frame Drop
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
