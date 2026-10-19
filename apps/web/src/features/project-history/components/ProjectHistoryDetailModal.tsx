import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Film,
  Link2,
  Play,
  Rocket,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import type { ProjectClipSummary, ProjectHistoryItem } from "../types";
import { ProjectStatusBadge } from "./ProjectStatusBadge";

interface ProjectHistoryDetailModalProps {
  project: ProjectHistoryItem | null;
  onClose: () => void;
  onDownloadClip: (project: ProjectHistoryItem, clip: ProjectClipSummary) => void;
  onResumeProject: (project: ProjectHistoryItem) => void;
}

export function ProjectHistoryDetailModal({
  project,
  onClose,
  onDownloadClip,
  onResumeProject,
}: ProjectHistoryDetailModalProps) {
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  if (!project) return null;

  const activeClip =
    project.clips.find((c) => c.id === selectedClipId) || project.clips[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative my-8 w-full max-w-5xl rounded-2xl border border-[#244b57] bg-[#0a181d] p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#17333c] pb-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-purple-600/20 border border-purple-500/40 px-2.5 py-0.5 text-[11px] font-bold text-purple-200">
                Detail Arsip Proyek #{project.id.toUpperCase()}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${
                  project.sourceType === "youtube"
                    ? "bg-red-500/20 border border-red-500/40 text-red-300"
                    : "bg-cyan-500/20 border border-cyan-500/40 text-cyan-200"
                }`}
              >
                {project.sourceType === "youtube" ? (
                  <Link2 className="h-3 w-3" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                {project.sourceType === "youtube"
                  ? "Sumber Link YouTube"
                  : "Sumber File Lokal"}
              </span>
              <span className="text-xs text-slate-400">
                • Dibuat {project.createdAt}
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-extrabold text-white">
              {project.title}
            </h2>
            <p className="text-xs text-slate-300">
              {project.channelOrCreator} • Durasi Video Sumber:{" "}
              <strong className="text-white">
                {project.originalDurationLabel}
              </strong>{" "}
              {project.sourceUrl && (
                <span className="font-mono text-cyan-300">
                  ({project.sourceUrl})
                </span>
              )}
              {project.sourceFileName && (
                <span className="font-mono text-cyan-300">
                  ({project.sourceFileName})
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ProjectStatusBadge
              stage={project.stage}
              stageLabel={project.stageLabel}
              completedClipsCount={project.completedClipsCount}
              requestedClipsCount={project.requestedClipsCount}
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup detail proyek"
              className="rounded-xl border border-[#244954] bg-[#12272e] p-2 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Project Parameter & 3-Pillar Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[#1c3a44] bg-[#0e2127] p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Target Durasi Auto-Cut
            </div>
            <div className="mt-1 text-lg font-black text-cyan-300">
              {project.targetClipDurationSec} Detik
            </div>
            <div className="text-[10px] text-slate-400">
              Format Vertikal 9:16
            </div>
          </div>

          <div className="rounded-xl border border-[#1c3a44] bg-[#0e2127] p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Kuota Klip Proyek
            </div>
            <div className="mt-1 text-lg font-black text-white">
              {project.completedClipsCount} / {project.requestedClipsCount} Klip
            </div>
            <div className="text-[10px] text-slate-400">
              Batas Maksimal 10 Klip
            </div>
          </div>

          <div className="rounded-xl border border-[#1c3a44] bg-[#0e2127] p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Skor Potensi Viral
            </div>
            <div className="mt-1 text-lg font-black text-amber-300">
              Top {project.topViralScore}/100
            </div>
            <div className="text-[10px] text-slate-400">
              Rata-rata: {project.avgViralScore}/100
            </div>
          </div>

          <div className="rounded-xl border border-[#1c3a44] bg-[#0e2127] p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Preset 3 Pilar Default
            </div>
            <div className="mt-1 text-xs font-bold text-purple-200 truncate">
              {project.defaultPillarSummary.editingStyleName}
            </div>
            <div className="text-[10px] text-emerald-300 truncate">
              + {project.defaultPillarSummary.subtitleStyleName}
            </div>
          </div>
        </div>

        {/* Main Content: Left 9:16 Video Preview + Right Clip List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left 9:16 Preview Player */}
          <div className="lg:col-span-5 rounded-2xl border border-[#1f404b] bg-[#0d1e24] p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5 text-red-400" />
                Pratinjau Klip Arsip (9:16)
              </span>
              {activeClip && (
                <span className="rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  Rank #{activeClip.rank} • Skor {activeClip.viralScore}/100
                </span>
              )}
            </div>

            {activeClip ? (
              <>
                <div className="relative mx-auto aspect-[9/16] w-full max-w-[230px] overflow-hidden rounded-xl border border-[#28515e] bg-black shadow-lg">
                  <video
                    key={activeClip.videoUrl}
                    src={activeClip.videoUrl}
                    controls
                    loop
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                    <span className="rounded bg-red-600/90 px-2 py-0.5 text-[9px] font-extrabold text-white">
                      {activeClip.motionGraphicName}
                    </span>
                    <span className="rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300">
                      {activeClip.durationSec}s
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="font-bold text-white line-clamp-1">
                    {activeClip.title}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className="rounded bg-red-950/50 border border-red-500/30 px-2 py-0.5 text-red-200">
                      🎬 {activeClip.editingStyleName}
                    </span>
                    <span className="rounded bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 text-amber-200">
                      ✨ {activeClip.motionGraphicName}
                    </span>
                    <span className="rounded bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 text-emerald-200">
                      💬 {activeClip.subtitleStyleName}
                    </span>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Right: Clips List & Stage Navigation */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Film className="h-4 w-4 text-purple-400" />
                  Daftar Klip Hasil Deteksi & Render ({project.clips.length}{" "}
                  Klip Utama)
                </h3>
                <span className="text-xs text-slate-400">
                  Klik klip untuk pratinjau atau unduh MP4
                </span>
              </div>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {project.clips.map((clip) => {
                  const isSelected = activeClip?.id === clip.id;
                  const isReadyToDownload = clip.status === "completed";

                  return (
                    <div
                      key={clip.id}
                      onClick={() => setSelectedClipId(clip.id)}
                      className={`rounded-xl border p-3.5 transition cursor-pointer ${
                        isSelected
                          ? "border-purple-500/60 bg-[#112830]"
                          : "border-[#1c3a44] bg-[#0d1f25] hover:border-[#295361]"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-300">
                              Rank #{clip.rank} ({clip.viralScore}/100)
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {clip.durationSec} Detik • {clip.fileSizeMb} MB
                            </span>
                            {isReadyToDownload ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />
                                MP4 Selesai
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300">
                                <Clock className="h-3 w-3" />
                                Status: {clip.status}
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs sm:text-sm font-bold text-white">
                            {clip.title}
                          </h4>

                          <div className="text-[11px] text-slate-400">
                            3 Pilar: {clip.editingStyleName} •{" "}
                            {clip.motionGraphicName} • {clip.subtitleStyleName}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!isReadyToDownload}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDownloadClip(project, clip);
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shrink-0 ${
                            isReadyToDownload
                              ? "bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                              : "border border-slate-700 bg-slate-900/70 text-slate-500 opacity-60 cursor-not-allowed"
                          }`}
                        >
                          <Download className="h-3.5 w-3.5" />
                          {isReadyToDownload ? "Unduh MP4" : "Belum Dirender"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Action Bar in Modal */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#17333c] pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/viral-clips"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#244954] bg-[#11262d] px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white transition"
                >
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  Buka Deteksi Momen Viral
                </Link>
                <Link
                  to="/auto-edit"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#244954] bg-[#11262d] px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white transition"
                >
                  <Wand2 className="h-3.5 w-3.5 text-amber-400" />
                  Ubah Preset 3 Pilar
                </Link>
              </div>

              <button
                type="button"
                onClick={() => onResumeProject(project)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-red-950/50 hover:from-red-500 hover:to-rose-500 transition cursor-pointer"
              >
                <Rocket className="h-4 w-4" />
                Buka di Studio Render & Unduh
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
