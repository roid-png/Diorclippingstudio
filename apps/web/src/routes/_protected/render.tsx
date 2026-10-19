import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { siteConfig } from "@/config/site";
import {
  Rocket,
  Download,
  CheckCircle2,
  Sparkles,
  Film,
  Zap,
  ArrowLeft,
  Cpu,
  FileVideo,
} from "lucide-react";
import {
  initialRenderClips,
  RENDER_PIPELINE_STEPS,
} from "@/features/render/mock-data";
import type {
  RenderClipItem,
  RenderSpeedMode,
} from "@/features/render/types";
import {
  defaultEditingStyles,
  defaultMotionGraphics,
  defaultSubtitleStyles,
} from "@/features/auto-edit/mock-data";
import { RenderClipQueueCard } from "@/features/render/components/RenderClipQueueCard";
import { RenderProgressTelemetryPanel } from "@/features/render/components/RenderProgressTelemetryPanel";
import {
  RenderQueueFilterBar,
  type RenderFilterTab,
} from "@/features/render/components/RenderQueueFilterBar";
import {
  buildClipDownloadFileName,
  type DownloadHistoryEntry,
  type NamingConventionPattern,
} from "@/features/render/utils/file-naming";

export const Route = createFileRoute("/_protected/render")({
  head: () => ({ meta: [{ title: `Render Cepat & Unduh | ${siteConfig.name}` }] }),
  component: RenderAndDownloadPage,
});

const AUTO_EDIT_STORAGE_KEY = "dior_clipping_auto_edit_state_v1";

function RenderAndDownloadPage() {
  const [clips, setClips] = useState<RenderClipItem[]>(() => {
    try {
      const raw = localStorage.getItem(AUTO_EDIT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.clips) && parsed.clips.length > 0) {
          return initialRenderClips.map((rc) => {
            const matched = parsed.clips.find((ac: any) => ac.id === rc.id);
            if (!matched || !matched.config) return rc;
            const editStyle =
              defaultEditingStyles.find(
                (s) => s.id === matched.config.editingStyleId
              ) || defaultEditingStyles[0];
            const motionStyle =
              defaultMotionGraphics.find(
                (m) => m.id === matched.config.motionGraphicId
              ) || defaultMotionGraphics[0];
            const subStyle =
              defaultSubtitleStyles.find(
                (sub) => sub.id === matched.config.subtitleStyleId
              ) || defaultSubtitleStyles[0];
            return {
              ...rc,
              pillarConfig: {
                editingStyleId: editStyle.id,
                editingStyleName: editStyle.name,
                motionGraphicId: motionStyle.id,
                motionGraphicName: motionStyle.name,
                subtitleStyleId: subStyle.id,
                subtitleStyleName: subStyle.name,
                subtitleEnabled: Boolean(matched.config.subtitleEnabled),
                highlightColor:
                  matched.config.highlightColor || rc.pillarConfig.highlightColor,
              },
            };
          });
        }
      }
    } catch {
      // ignore storage errors
    }
    return initialRenderClips;
  });

  const [activeFilter, setActiveFilter] = useState<RenderFilterTab>("all");
  const [speedMode, setSpeedMode] = useState<RenderSpeedMode>("turbo-fast");
  const [resolution, setResolution] = useState<"1080x1920" | "720x1280">(
    "1080x1920"
  );
  const [fps, setFps] = useState<60 | 30>(60);
  const [namingPattern, setNamingPattern] =
    useState<NamingConventionPattern>("dior-viral-rank");
  const [downloadHistory, setDownloadHistory] = useState<
    DownloadHistoryEntry[]
  >([]);
  const [previewModalClip, setPreviewModalClip] =
    useState<RenderClipItem | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Sync structured downloadFileName whenever namingPattern, resolution, or fps changes
  useEffect(() => {
    setClips((prev) =>
      prev.map((c) => {
        const updatedClip = { ...c, resolution, fps };
        return {
          ...updatedClip,
          downloadFileName: buildClipDownloadFileName(
            updatedClip,
            namingPattern
          ),
        };
      })
    );
  }, [namingPattern, resolution, fps]);

  // Simulate fast progress ticks for any clip currently in "rendering" state
  useEffect(() => {
    const hasActiveRendering = clips.some((c) => c.status === "rendering");
    if (!hasActiveRendering) return;

    const intervalMs = speedMode === "turbo-fast" ? 280 : 480;
    const timer = setInterval(() => {
      setClips((prev) =>
        prev.map((clip) => {
          if (clip.status !== "rendering") return clip;
          const stepIncrement = speedMode === "turbo-fast" ? 14 : 9;
          const nextProgress = Math.min(100, clip.progress + stepIncrement);
          const stepObj =
            RENDER_PIPELINE_STEPS.find((s) => nextProgress <= s.threshold) ||
            RENDER_PIPELINE_STEPS[RENDER_PIPELINE_STEPS.length - 1];

          if (nextProgress >= 100) {
            return {
              ...clip,
              status: "completed",
              progress: 100,
              activeStepId: "mux-export",
              activeStepLabel: `Selesai dirender • Siap diunduh (${resolution === "1080x1920" ? "1080p" : "720p"} ${fps}FPS)`,
              etaSeconds: 0,
              completedAt: "Baru saja",
            };
          }

          return {
            ...clip,
            progress: nextProgress,
            activeStepId: stepObj.id,
            activeStepLabel: stepObj.label,
            etaSeconds: Math.max(
              1,
              Math.ceil(((100 - nextProgress) / stepIncrement) * 0.4)
            ),
          };
        })
      );
    }, intervalMs);

    return () => clearInterval(timer);
  }, [clips, speedMode, resolution, fps]);

  // Automatically promote next "queued" clip to "rendering"
  useEffect(() => {
    const activeRenderingCount = clips.filter(
      (c) => c.status === "rendering"
    ).length;
    if (activeRenderingCount > 0) return;

    const nextQueued = clips.find((c) => c.status === "queued");
    if (nextQueued) {
      setClips((prev) =>
        prev.map((c) =>
          c.id === nextQueued.id
            ? {
                ...c,
                status: "rendering",
                progress: 8,
                activeStepId: "crop-9-16",
                activeStepLabel: RENDER_PIPELINE_STEPS[0].label,
              }
            : c
        )
      );
    }
  }, [clips]);

  const counts = {
    all: clips.length,
    completed: clips.filter((c) => c.status === "completed").length,
    rendering: clips.filter((c) => c.status === "rendering").length,
    queued: clips.filter((c) => c.status === "queued").length,
    idle: clips.filter((c) => c.status === "idle").length,
    failed: clips.filter((c) => c.status === "failed").length,
  };

  const selectedClips = clips.filter((c) => c.isSelectedForRender);
  const renderingClips = clips.filter(
    (c) => c.status === "rendering" || c.status === "queued"
  );

  const filteredClips = clips.filter((c) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "rendering") {
      return c.status === "rendering" || c.status === "queued";
    }
    return c.status === activeFilter;
  });

  const overallProgress =
    selectedClips.length > 0
      ? Math.round(
          selectedClips.reduce(
            (acc, c) => acc + (c.status === "completed" ? 100 : c.progress),
            0
          ) / selectedClips.length
        )
      : 0;

  const handleStartSingleRender = (clipId: string) => {
    setClips((prev) =>
      prev.map((c) =>
        c.id === clipId
          ? {
              ...c,
              isSelectedForRender: true,
              status: "rendering",
              progress: 10,
              activeStepId: "crop-9-16",
              activeStepLabel: RENDER_PIPELINE_STEPS[0].label,
              etaSeconds: 4,
              errorMessage: undefined,
              resolution,
              fps,
            }
          : c
      )
    );
    setStatusBanner("Memulai proses Render Cepat (Turbo NVENC 9:16)...");
  };

  const handleCancelRender = (clipId: string) => {
    setClips((prev) =>
      prev.map((c) =>
        c.id === clipId
          ? {
              ...c,
              status: "idle",
              progress: 0,
              activeStepId: "crop-9-16",
              activeStepLabel: "Render dibatalkan • Siap dirender ulang",
              etaSeconds: 5,
            }
          : c
      )
    );
    setStatusBanner("Proses render pada klip telah dibatalkan.");
  };

  const handleRetryRender = (clipId: string) => {
    handleStartSingleRender(clipId);
    setStatusBanner("Mengulang proses render dengan pemulihan otomatis...");
  };

  const handleSimulateError = () => {
    const target =
      clips.find((c) => c.status === "idle") || clips[clips.length - 1];
    if (!target) return;
    setClips((prev) =>
      prev.map((c) =>
        c.id === target.id
          ? {
              ...c,
              status: "failed",
              progress: 62,
              activeStepId: "motion-hud",
              activeStepLabel: "Gagal pada tahap komposit layer HUD",
              errorMessage:
                "Buffer GPU penuh saat komposit layer Motion HUD. Klik Coba Lagi (Retry) untuk melanjutkan.",
            }
          : c
      )
    );
    setStatusBanner(
      `Simulasi kendala diaktifkan pada "${target.title}". Silakan uji tombol Coba Lagi (Retry).`
    );
  };

  const handleStartBatchRenderAll = () => {
    let startedFirst = false;
    setClips((prev) =>
      prev.map((c) => {
        if (!c.isSelectedForRender || c.status === "completed") return c;
        if (!startedFirst) {
          startedFirst = true;
          return {
            ...c,
            status: "rendering",
            progress: 12,
            activeStepId: "crop-9-16",
            activeStepLabel: RENDER_PIPELINE_STEPS[0].label,
            errorMessage: undefined,
            resolution,
            fps,
          };
        }
        return {
          ...c,
          status: "queued",
          progress: 0,
          activeStepLabel: "Dalam antrean Render Cepat...",
          errorMessage: undefined,
          resolution,
          fps,
        };
      })
    );
    setStatusBanner(
      "Antrean Render Cepat aktif! Memproses klip pilihan secara berurutan..."
    );
  };

  const handleToggleSelectClip = (clipId: string) => {
    setClips((prev) =>
      prev.map((c) =>
        c.id === clipId
          ? { ...c, isSelectedForRender: !c.isSelectedForRender }
          : c
      )
    );
  };

  const handleSelectAll = () => {
    setClips((prev) =>
      prev.map((c, idx) => ({ ...c, isSelectedForRender: idx < 10 }))
    );
  };

  const handleSelectTop3 = () => {
    setClips((prev) =>
      prev.map((c) => ({ ...c, isSelectedForRender: c.rank <= 3 }))
    );
    setStatusBanner("Berhasil memilih Top 3 Klip Rekomendasi Utama untuk dirender.");
  };

  const handleResetAllToIdle = () => {
    setClips((prev) =>
      prev.map((c, idx) =>
        idx === 0
          ? c
          : {
              ...c,
              status: "idle",
              progress: 0,
              activeStepId: "crop-9-16",
              activeStepLabel: "Siap dirender dengan preset 3 pilar",
              errorMessage: undefined,
            }
      )
    );
    setStatusBanner("Status antrean telah direset.");
  };

  const handleTriggerDownload = (clip: RenderClipItem) => {
    if (clip.status !== "completed") {
      setStatusBanner(
        `Klip "${clip.title}" belum selesai dirender. Selesaikan render terlebih dahulu sebelum mengunduh.`
      );
      return;
    }
    const resolvedFileName = buildClipDownloadFileName(clip, namingPattern);
    const link = document.createElement("a");
    link.href = clip.videoUrl;
    link.download = resolvedFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    setDownloadHistory((prev) => [
      {
        id: `${clip.id}-${Date.now()}`,
        clipId: clip.id,
        clipTitle: clip.title,
        fileName: resolvedFileName,
        fileSizeMb: clip.fileSizeMb,
        resolution: clip.resolution,
        fps: clip.fps,
        viralScore: clip.viralScore,
        downloadedAt: timeStr,
      },
      ...prev.slice(0, 9),
    ]);

    setStatusBanner(
      `Berhasil mengunduh "${resolvedFileName}" (${clip.fileSizeMb} MB) • Siap upload ke TikTok/Reels!`
    );
  };

  const handleBatchDownloadCompleted = () => {
    const readyClips = clips.filter((c) => c.status === "completed");
    if (readyClips.length === 0) return;
    readyClips.forEach((clip, idx) => {
      setTimeout(() => {
        handleTriggerDownload(clip);
      }, idx * 250);
    });
    setStatusBanner(
      `Mengunduh ${readyClips.length} video MP4 yang telah selesai dirender...`
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Workflow Stepper & Header */}
      <div className="rounded-2xl border border-[#1a3840] bg-[#0a191d]/90 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#163037] pb-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              to="/app"
              className="flex items-center gap-1.5 rounded-lg bg-[#11262c] px-3 py-1.5 text-slate-300 hover:text-white transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              1. Studio Potong
            </Link>
            <span className="text-slate-600">/</span>
            <Link
              to="/viral-clips"
              className="rounded-lg bg-[#11262c] px-3 py-1.5 text-slate-300 hover:text-white transition"
            >
              2. Deteksi Momen Viral
            </Link>
            <span className="text-slate-600">/</span>
            <Link
              to="/auto-edit"
              className="rounded-lg bg-[#11262c] px-3 py-1.5 text-slate-300 hover:text-white transition"
            >
              3. Edit Otomatis 3 Pilar
            </Link>
            <span className="text-slate-600">/</span>
            <span className="flex items-center gap-1.5 rounded-lg bg-red-600/20 border border-red-500/40 px-3 py-1.5 font-semibold text-red-300">
              <Rocket className="h-3.5 w-3.5 text-red-400" />
              4. Render Cepat & Unduh MP4
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-medium text-emerald-300">
              Kuota Harian: 45 / 50 Klip Tersisa
            </span>
            <span className="rounded-full bg-red-500/15 border border-red-500/30 px-3 py-1 text-xs font-semibold text-red-300">
              THEO 5-FIX Engine Active
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <Zap className="h-7 w-7 text-red-500" />
              Studio Render Cepat & Unduh Video
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-3xl">
              Kompilasi akhir video vertikal 9:16 dengan menerapkan{" "}
              <span className="text-red-400 font-semibold">
                Gaya Edit Sinematik
              </span>
              ,{" "}
              <span className="text-amber-300 font-semibold">
                Motion Graphic HUD
              </span>
              , dan{" "}
              <span className="text-emerald-300 font-semibold">
                Subtitle Otomatis
              </span>{" "}
              secara instan untuk siap diunggah ke TikTok, Reels, dan Shorts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleBatchDownloadCompleted}
              disabled={counts.completed === 0}
              title={
                counts.completed > 0
                  ? `Unduh seluruh ${counts.completed} video yang selesai dirender`
                  : "Belum ada klip yang selesai dirender"
              }
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition ${
                counts.completed > 0
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 cursor-pointer"
                  : "border border-slate-700 bg-slate-900/70 text-slate-500 opacity-60 cursor-not-allowed"
              }`}
            >
              <Download className="h-4 w-4" />
              Unduh Selesai ({counts.completed} MP4)
            </button>

            <button
              type="button"
              onClick={handleStartBatchRenderAll}
              disabled={renderingClips.length > 0}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-red-950/50 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 transition cursor-pointer"
            >
              <Rocket className="h-4 w-4" />
              {renderingClips.length > 0
                ? `Merender (${renderingClips.length} Klip)...`
                : `Render Cepat Pilihan (${selectedClips.length} Klip)`}
            </button>
          </div>
        </div>

        {statusBanner && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-2.5 text-xs text-emerald-200">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
              {statusBanner}
            </span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-emerald-300 hover:text-white font-semibold"
            >
              Tutup
            </button>
          </div>
        )}
      </div>

      {/* Summary Metrics & Render Engine Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="rounded-2xl border border-[#1b3942] bg-[#0c1d22] p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Klip Dipilih (Maks 10)</span>
              <Film className="h-4 w-4 text-purple-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">
              {selectedClips.length}{" "}
              <span className="text-xs font-normal text-slate-400">
                / 10 klip
              </span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Terurut berdasarkan skor viral
            </p>
          </div>

          <div className="rounded-2xl border border-[#1b3942] bg-[#0c1d22] p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Siap Diunduh (MP4)</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-400">
              {counts.completed}{" "}
              <span className="text-xs font-normal text-slate-400">video</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Format H.264 9:16 60FPS
            </p>
          </div>

          <div className="rounded-2xl border border-[#1b3942] bg-[#0c1d22] p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Progres Total Batch</span>
              <Cpu className="h-4 w-4 text-red-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">
              {overallProgress}%
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-[#152d34] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[#1b3942] bg-[#0c1d22] p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Kecepatan Engine</span>
              <Zap className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 text-lg font-extrabold text-amber-300">
              ~4.2 dtk/klip
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Akselerasi GPU NVENC Aktif
            </p>
          </div>
        </div>

        {/* Engine Preset Bar */}
        <div className="lg:col-span-4 rounded-2xl border border-[#1b3942] bg-[#0c1d22] p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Parameter Output Render Cepat
            </span>
            <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
              9:16 VERTIKAL
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() =>
                setSpeedMode(
                  speedMode === "turbo-fast" ? "cinema-hq" : "turbo-fast"
                )
              }
              className={`rounded-xl border p-2 text-left transition cursor-pointer ${
                speedMode === "turbo-fast"
                  ? "border-red-500/60 bg-red-950/30 text-white"
                  : "border-[#1d3b44] bg-[#0f2329] text-slate-300"
              }`}
            >
              <div className="text-[10px] text-slate-400">Mode Engine</div>
              <div className="font-bold text-red-300 truncate">
                {speedMode === "turbo-fast" ? "⚡ Turbo Fast" : "🎬 Cinema HQ"}
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setResolution(
                  resolution === "1080x1920" ? "720x1280" : "1080x1920"
                )
              }
              className="rounded-xl border border-[#1d3b44] bg-[#0f2329] p-2 text-left text-white hover:border-slate-500 transition cursor-pointer"
            >
              <div className="text-[10px] text-slate-400">Resolusi</div>
              <div className="font-bold truncate">{resolution}</div>
            </button>

            <button
              type="button"
              onClick={() => setFps(fps === 60 ? 30 : 60)}
              className="rounded-xl border border-[#1d3b44] bg-[#0f2329] p-2 text-left text-white hover:border-slate-500 transition cursor-pointer"
            >
              <div className="text-[10px] text-slate-400">Frame Rate</div>
              <div className="font-bold truncate">{fps} FPS</div>
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Progress & ETA Telemetry Panel */}
      <RenderProgressTelemetryPanel
        clips={clips}
        speedMode={speedMode}
        resolution={resolution}
        fps={fps}
      />

      {/* File Naming Convention Selector & Recent Downloads Strip */}
      <div className="rounded-2xl border border-[#1b3942] bg-[#0a181c]/90 p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <Download className="h-4 w-4 text-emerald-400" />
              Format Penamaan File Unduhan Otomatis (Auto-Naming Convention)
            </h3>
            <p className="text-xs text-slate-400">
              Pilih struktur nama file MP4 saat diunduh ke perangkat Anda:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                {
                  id: "dior-viral-rank",
                  label: "DIOR Viral Rank (Default)",
                },
                {
                  id: "tiktok-reels-seo",
                  label: "TikTok & Reels SEO",
                },
                {
                  id: "studio-timestamp",
                  label: "Timestamp Studio",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setNamingPattern(opt.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  namingPattern === opt.id
                    ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300"
                    : "border-[#1d3b44] bg-[#0f2329] text-slate-300 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {downloadHistory.length > 0 && (
          <div className="border-t border-[#163038] pt-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2">
              Riwayat File MP4 yang Baru Diunduh ({downloadHistory.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {downloadHistory.map((item) => (
                <div
                  key={item.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-3 py-1.5 text-xs text-emerald-200"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <code className="font-mono text-[11px] text-white">
                    {item.fileName}
                  </code>
                  <span className="text-[10px] text-emerald-400">
                    ({item.fileSizeMb} MB • {item.downloadedAt})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter & Batch Action Bar */}
      <RenderQueueFilterBar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        counts={counts}
        selectedCount={selectedClips.length}
        onSelectAll={handleSelectAll}
        onSelectTop3={handleSelectTop3}
        onResetAllToIdle={handleResetAllToIdle}
        onSimulateError={handleSimulateError}
      />

      {/* Render Queue & Download Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileVideo className="h-5 w-5 text-red-400" />
            Daftar Klip & Status Render ({filteredClips.length} Klip)
          </h2>
          <span className="text-xs text-slate-400">
            Menampilkan konfigurasi 3 Pilar yang dipilih dari halaman Edit Otomatis
          </span>
        </div>

        {filteredClips.length === 0 ? (
          <div className="rounded-2xl border border-[#1b3942] bg-[#0b1a1f]/70 p-10 text-center space-y-3">
            <p className="text-sm font-bold text-slate-200">
              Tidak ada klip dengan status &ldquo;{activeFilter}&rdquo; saat ini.
            </p>
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className="rounded-xl bg-[#16343d] px-4 py-2 text-xs font-bold text-white hover:bg-[#1d4450] cursor-pointer"
            >
              Tampilkan Semua Klip ({clips.length})
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredClips.map((clip) => (
              <RenderClipQueueCard
                key={clip.id}
                clip={clip}
                onToggleSelect={handleToggleSelectClip}
                onStartRender={handleStartSingleRender}
                onCancelRender={handleCancelRender}
                onRetryRender={handleRetryRender}
                onOpenPreview={setPreviewModalClip}
                onDownloadClip={handleTriggerDownload}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewModalClip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-[#244b57] bg-[#0b1c21] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#18353d] pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">
                  Pratinjau Hasil Render 9:16
                </span>
                <h3 className="text-sm font-bold text-white line-clamp-1">
                  {previewModalClip.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalClip(null)}
                className="rounded-lg bg-[#152f36] px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Tutup
              </button>
            </div>

            <div className="mt-4 relative mx-auto aspect-[9/16] max-h-[65vh] overflow-hidden rounded-xl border border-[#274e5a] bg-black">
              <video
                src={previewModalClip.videoUrl}
                controls
                autoPlay
                loop
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-center justify-between">
                <span className="rounded bg-red-600/90 px-2 py-0.5 text-[10px] font-extrabold text-white">
                  {previewModalClip.pillarConfig.motionGraphicName}
                </span>
                <span className="rounded bg-black/75 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                  {previewModalClip.resolution} • {previewModalClip.fps}FPS
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <Link
                to="/auto-edit"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#244854] bg-[#122830] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:text-white"
              >
                Ubah Gaya di Edit Otomatis
              </Link>
              <button
                type="button"
                disabled={previewModalClip.status !== "completed"}
                onClick={() => handleTriggerDownload(previewModalClip)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  previewModalClip.status === "completed"
                    ? "bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                    : "border border-slate-700 bg-slate-900 text-slate-500 opacity-60 cursor-not-allowed"
                }`}
              >
                <Download className="h-3.5 w-3.5" />
                {previewModalClip.status === "completed"
                  ? "Unduh Video MP4"
                  : "Unduh Terkunci (Selesaikan Render)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
