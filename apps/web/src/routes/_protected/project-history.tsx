import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { siteConfig } from "@/config/site";
import {
  History,
  Search,
  Link2,
  Upload,
  Sparkles,
  Rocket,
  Film,
  Trash2,
  Pin,
  ExternalLink,
  FolderOpen,
  Plus,
  RotateCcw,
  Eye,
} from "lucide-react";
import { initialProjectHistoryItems } from "@/features/project-history/mock-data";
import { ProjectStatusBadge } from "@/features/project-history/components/ProjectStatusBadge";
import { ProjectHistoryEmptyState } from "@/features/project-history/components/ProjectHistoryEmptyState";
import { ProjectHistoryDetailModal } from "@/features/project-history/components/ProjectHistoryDetailModal";
import type {
  ProjectClipSummary,
  ProjectHistoryItem,
  ProjectSourceType,
  ProjectWorkflowStage,
} from "@/features/project-history/types";

export const Route = createFileRoute("/_protected/project-history")({
  head: () => ({
    meta: [{ title: `Riwayat Proyek | ${siteConfig.name}` }],
  }),
  component: ProjectHistoryPage,
});

function ProjectHistoryPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectHistoryItem[]>(
    initialProjectHistoryItems
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | ProjectSourceType>(
    "all"
  );
  const [stageFilter, setStageFilter] = useState<
    "all" | ProjectWorkflowStage
  >("all");
  const [durationFilter, setDurationFilter] = useState<"all" | 30 | 45 | 60>(
    "all"
  );
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(
    "proj-101"
  );
  const [detailModalProject, setDetailModalProject] =
    useState<ProjectHistoryItem | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const filteredProjects = projects
    .filter((proj) => {
      if (sourceFilter !== "all" && proj.sourceType !== sourceFilter) {
        return false;
      }
      if (stageFilter !== "all" && proj.stage !== stageFilter) {
        return false;
      }
      if (
        durationFilter !== "all" &&
        proj.targetClipDurationSec !== durationFilter
      ) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchTitle = proj.title.toLowerCase().includes(q);
        const matchChannel = proj.channelOrCreator.toLowerCase().includes(q);
        const matchPillar =
          proj.defaultPillarSummary.editingStyleName
            .toLowerCase()
            .includes(q) ||
          proj.defaultPillarSummary.motionGraphicName
            .toLowerCase()
            .includes(q) ||
          proj.defaultPillarSummary.subtitleStyleName
            .toLowerCase()
            .includes(q);
        return matchTitle || matchChannel || matchPillar;
      }
      return true;
    })
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned));

  const totalClipsGenerated = projects.reduce(
    (acc, p) => acc + p.requestedClipsCount,
    0
  );
  const totalCompletedMp4 = projects.reduce(
    (acc, p) => acc + p.completedClipsCount,
    0
  );

  const handleTogglePin = (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, isPinned: !p.isPinned } : p
      )
    );
  };

  const handleDeleteProject = (projectId: string, title: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setBannerMessage(`Proyek "${title}" berhasil dihapus dari riwayat.`);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSourceFilter("all");
    setStageFilter("all");
    setDurationFilter("all");
  };

  const handleRestoreDemoProjects = () => {
    setProjects(initialProjectHistoryItems);
    handleResetFilters();
    setBannerMessage("Berhasil memuat ulang 5 proyek contoh ke Riwayat Proyek.");
  };

  const handleResumeProject = (proj: ProjectHistoryItem) => {
    if (
      proj.stage === "completed" ||
      proj.stage === "rendering" ||
      proj.stage === "failed"
    ) {
      navigate({ to: "/render" });
      return;
    }
    if (proj.stage === "auto-edit") {
      navigate({ to: "/auto-edit" });
      return;
    }
    navigate({ to: "/viral-clips" });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Summary Banner */}
      <div className="rounded-2xl border border-[#1a3840] bg-[#0a191d]/90 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#163037] pb-4">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="flex items-center gap-1.5 rounded-lg bg-purple-600/20 border border-purple-500/40 px-3 py-1.5 font-semibold text-purple-200">
              <History className="h-3.5 w-3.5 text-purple-400" />
              Arsip & Riwayat Proyek Auto-Cut
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300">
              Tersimpan otomatis beserta konfigurasi 3 Pilar & hasil MP4
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {projects.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setProjects([]);
                  setBannerMessage(
                    "Menampilkan pratinjau Tampilan Kosong (Empty State) Riwayat Proyek."
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#224550] bg-[#10252c] px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                Simulasi Kosongkan
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestoreDemoProjects}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/50 transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 text-cyan-400" />
                Muat Data Contoh
              </button>
            )}

            <Link
              to="/app"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-purple-950/50 hover:from-purple-500 hover:to-indigo-500 transition"
            >
              <Plus className="h-4 w-4" />
              Buat Proyek Auto-Cut Baru
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <FolderOpen className="h-7 w-7 text-purple-400" />
              Riwayat Proyek Klip Viral Otomatis
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-3xl">
              Kelola seluruh sesi pemotongan video dari link YouTube maupun file
              lokal, tinjau kembali skor potensi viral, atau lanjutkan ke tahap{" "}
              <span className="text-purple-300 font-semibold">
                Edit Otomatis 3 Pilar
              </span>{" "}
              dan{" "}
              <span className="text-emerald-300 font-semibold">
                Unduh Video MP4
              </span>
              .
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#1d3b44] bg-[#0e2127] px-3.5 py-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Total Proyek
              </div>
              <div className="mt-0.5 text-xl font-black text-white">
                {projects.length}
              </div>
            </div>
            <div className="rounded-xl border border-[#1d3b44] bg-[#0e2127] px-3.5 py-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Klip Terdeteksi
              </div>
              <div className="mt-0.5 text-xl font-black text-purple-300">
                {totalClipsGenerated}
              </div>
            </div>
            <div className="rounded-xl border border-[#1d3b44] bg-[#0e2127] px-3.5 py-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                MP4 Siap Unduh
              </div>
              <div className="mt-0.5 text-xl font-black text-emerald-400">
                {totalCompletedMp4}
              </div>
            </div>
          </div>
        </div>

        {bannerMessage && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-purple-500/30 bg-purple-950/30 px-4 py-2.5 text-xs text-purple-200">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
              {bannerMessage}
            </span>
            <button
              type="button"
              onClick={() => setBannerMessage(null)}
              className="font-semibold text-purple-300 hover:text-white cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-[#1b3942] bg-[#0a181c]/95 p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul proyek, channel YouTube, atau preset 3 pilar (Netflix, Hormozi)..."
              className="w-full rounded-xl border border-[#1f3f49] bg-[#0e2127] pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Source Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: "all", label: "Semua Sumber" },
                { id: "youtube", label: "Link YouTube" },
                { id: "upload", label: "Upload File" },
              ] as const
            ).map((src) => (
              <button
                key={src.id}
                type="button"
                onClick={() => setSourceFilter(src.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  sourceFilter === src.id
                    ? "border-purple-500/50 bg-purple-950/40 text-purple-200"
                    : "border-[#1d3b44] bg-[#0f2329] text-slate-300 hover:text-white"
                }`}
              >
                {src.label}
              </button>
            ))}

            <span className="text-slate-600 hidden sm:inline">|</span>

            {/* Duration Filter */}
            {(
              [
                { id: "all", label: "Semua Durasi" },
                { id: 30, label: "30 Detik" },
                { id: 45, label: "45 Detik" },
                { id: 60, label: "60 Detik" },
              ] as const
            ).map((dur) => (
              <button
                key={String(dur.id)}
                type="button"
                onClick={() => setDurationFilter(dur.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  durationFilter === dur.id
                    ? "border-cyan-500/50 bg-cyan-950/40 text-cyan-200"
                    : "border-[#1d3b44] bg-[#0f2329] text-slate-300 hover:text-white"
                }`}
              >
                {dur.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stage Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[#163038] pt-3">
          {(
            [
              { id: "all", label: `Semua Status (${projects.length})` },
              {
                id: "completed",
                label: `Selesai Dirender (${
                  projects.filter((p) => p.stage === "completed").length
                })`,
              },
              {
                id: "rendering",
                label: `Sedang Dirender (${
                  projects.filter((p) => p.stage === "rendering").length
                })`,
              },
              {
                id: "auto-edit",
                label: `Tahap Edit Otomatis (${
                  projects.filter((p) => p.stage === "auto-edit").length
                })`,
              },
              {
                id: "failed",
                label: `Perlu Retry (${
                  projects.filter((p) => p.stage === "failed").length
                })`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStageFilter(tab.id)}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                stageFilter === tab.id
                  ? "bg-red-600 text-white"
                  : "bg-[#10242b] text-slate-300 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards List or Empty State */}
      {projects.length === 0 ? (
        <ProjectHistoryEmptyState
          mode="no-projects"
          onResetFilters={handleResetFilters}
          onRestoreDemoProjects={handleRestoreDemoProjects}
        />
      ) : filteredProjects.length === 0 ? (
        <ProjectHistoryEmptyState
          mode="no-filter-matches"
          searchQuery={searchQuery}
          onResetFilters={handleResetFilters}
          onRestoreDemoProjects={handleRestoreDemoProjects}
        />
      ) : (
        <div className="space-y-4">
          {filteredProjects.map((proj) => {
            const isExpanded = expandedProjectId === proj.id;

            return (
              <div
                key={proj.id}
                className={`rounded-2xl border p-5 transition ${
                  proj.isPinned
                    ? "border-purple-500/40 bg-[#0c1e24]/95 shadow-lg shadow-purple-950/20"
                    : "border-[#1b3942] bg-[#0a181c]/90"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Project Identity */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {proj.isPinned && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 text-[10px] font-bold text-purple-200">
                          <Pin className="h-3 w-3" />
                          Disematkan
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          proj.sourceType === "youtube"
                            ? "bg-red-500/20 border border-red-500/40 text-red-300"
                            : "bg-cyan-500/20 border border-cyan-500/40 text-cyan-200"
                        }`}
                      >
                        {proj.sourceType === "youtube" ? (
                          <Link2 className="h-3 w-3" />
                        ) : (
                          <Upload className="h-3 w-3" />
                        )}
                        {proj.sourceType === "youtube"
                          ? "YouTube Auto-Cut"
                          : "Upload Video Lokal"}
                      </span>

                      <span className="rounded-md bg-[#132b33] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        Durasi Target: {proj.targetClipDurationSec} Detik
                      </span>

                      <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        Top Skor Viral: {proj.topViralScore}/100
                      </span>

                      <span className="text-[11px] text-slate-400">
                        • {proj.createdAt}
                      </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-extrabold text-white truncate">
                      {proj.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                      <span>{proj.channelOrCreator}</span>
                      <span>•</span>
                      <span>Durasi Asli: {proj.originalDurationLabel}</span>
                      <span>•</span>
                      <span className="font-semibold text-emerald-300">
                        {proj.completedClipsCount}/{proj.requestedClipsCount}{" "}
                        Klip Selesai (Maks 10)
                      </span>
                    </div>

                    {/* 3-Pillar Preset Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="rounded-lg border border-red-500/30 bg-red-950/30 px-2.5 py-1 text-[11px] text-red-200">
                        🎬 Edit:{" "}
                        <strong>
                          {proj.defaultPillarSummary.editingStyleName}
                        </strong>
                      </span>
                      <span className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-2.5 py-1 text-[11px] text-amber-200">
                        ✨ Motion:{" "}
                        <strong>
                          {proj.defaultPillarSummary.motionGraphicName}
                        </strong>
                      </span>
                      <span className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1 text-[11px] text-emerald-200">
                        💬 Subtitle:{" "}
                        <strong>
                          {proj.defaultPillarSummary.subtitleStyleName}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Right: Status Badge & Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0">
                    <ProjectStatusBadge
                      stage={proj.stage}
                      stageLabel={proj.stageLabel}
                      completedClipsCount={proj.completedClipsCount}
                      requestedClipsCount={proj.requestedClipsCount}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailModalProject(proj)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/40 bg-purple-950/35 px-3 py-2 text-xs font-bold text-purple-200 hover:bg-purple-900/50 hover:text-white transition cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5 text-purple-300" />
                        Detail Proyek
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedProjectId(isExpanded ? null : proj.id)
                        }
                        className="rounded-xl border border-[#224550] bg-[#10252c] px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white transition cursor-pointer"
                      >
                        {isExpanded
                          ? "Sembunyikan Klip"
                          : `Lihat Klip (${proj.clips.length})`}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTogglePin(proj.id)}
                        title="Sematkan proyek di urutan teratas"
                        className="rounded-xl border border-[#224550] bg-[#10252c] p-2 text-slate-300 hover:text-purple-300 transition cursor-pointer"
                      >
                        <Pin className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteProject(proj.id, proj.title)}
                        title="Hapus proyek dari riwayat"
                        className="rounded-xl border border-[#224550] bg-[#10252c] p-2 text-slate-300 hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResumeProject(proj)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2 text-xs font-bold text-white shadow hover:from-red-500 hover:to-rose-500 transition cursor-pointer"
                      >
                        <Rocket className="h-3.5 w-3.5" />
                        {proj.stage === "completed"
                          ? "Buka & Unduh MP4"
                          : "Lanjutkan Proyek"}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Clip Summary List */}
                {isExpanded && (
                  <div className="mt-4 border-t border-[#17323b] pt-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <Film className="h-3.5 w-3.5 text-purple-400" />
                        Daftar Klip Viral dalam Proyek Ini ({proj.clips.length}{" "}
                        Sampel Utama dari {proj.requestedClipsCount} Klip)
                      </span>
                      <div className="flex items-center gap-2">
                        <Link
                          to="/viral-clips"
                          className="text-purple-300 hover:underline font-semibold"
                        >
                          Buka di Deteksi Momen Viral →
                        </Link>
                        <span>|</span>
                        <Link
                          to="/auto-edit"
                          className="text-amber-300 hover:underline font-semibold"
                        >
                          Edit 3 Pilar →
                        </Link>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {proj.clips.map((clip) => (
                        <div
                          key={clip.id}
                          className="rounded-xl border border-[#1d3c46] bg-[#0e2127] p-3 flex flex-col justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-amber-300">
                                Rank #{clip.rank} • Skor {clip.viralScore}/100
                              </span>
                              <span className="rounded bg-[#15313a] px-2 py-0.5 text-[10px] text-slate-300">
                                {clip.durationSec} dtk • {clip.fileSizeMb} MB
                              </span>
                            </div>
                            <h4 className="mt-1 text-xs font-bold text-white line-clamp-2">
                              {clip.title}
                            </h4>
                          </div>

                          <div className="flex items-center justify-between border-t border-[#163139] pt-2 text-[10px] text-slate-400">
                            <span className="truncate">
                              {clip.editingStyleName}
                            </span>
                            <Link
                              to="/render"
                              className="font-bold text-emerald-300 hover:text-emerald-200 shrink-0"
                            >
                              {clip.status === "completed"
                                ? "Unduh MP4 →"
                                : "Render →"}
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Archived Project Detail Modal */}
      <ProjectHistoryDetailModal
        project={detailModalProject}
        onClose={() => setDetailModalProject(null)}
        onDownloadClip={(proj: ProjectHistoryItem, clip: ProjectClipSummary) => {
          const link = document.createElement("a");
          link.href = clip.videoUrl;
          link.download = `DIOR-Arsip_${proj.id}_Rank0${clip.rank}_Score${clip.viralScore}.mp4`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setBannerMessage(
            `Mengunduh klip arsip "${clip.title}" (${clip.fileSizeMb} MB)...`
          );
        }}
        onResumeProject={(proj: ProjectHistoryItem) => {
          setDetailModalProject(null);
          handleResumeProject(proj);
        }}
      />
    </div>
  );
}
