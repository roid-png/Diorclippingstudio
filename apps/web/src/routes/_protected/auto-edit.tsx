import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { siteConfig } from "@/config/site";
import {
  Wand2,
  ArrowLeft,
  Flame,
  CheckCircle2,
  Sparkles,
  Film,
  Layers,
} from "lucide-react";
import {
  initialAutoEditClips,
  defaultEditingStyles,
  defaultMotionGraphics,
  defaultSubtitleStyles,
} from "@/features/auto-edit/mock-data";
import type {
  AutoEditClipItem,
  AutoEditClipConfig,
  EditingStylePreset,
  MotionGraphicPreset,
  SubtitleStylePreset,
} from "@/features/auto-edit/types";
import { LivePreviewCanvas } from "@/features/auto-edit/components/LivePreviewCanvas";
import { ThreePillarStyleWorkspace } from "@/features/auto-edit/components/ThreePillarStyleWorkspace";

export const Route = createFileRoute("/_protected/auto-edit")({
  head: () => ({ meta: [{ title: `Edit Otomatis AI | ${siteConfig.name}` }] }),
  component: EditOtomatisPage,
});

function EditOtomatisPage() {
  const [clips, setClips] = useState<AutoEditClipItem[]>(initialAutoEditClips);
  const [activeClipId, setActiveClipId] = useState<string>(
    initialAutoEditClips[0].id
  );

  const [editingStyles, setEditingStyles] =
    useState<EditingStylePreset[]>(defaultEditingStyles);
  const [motionGraphics, setMotionGraphics] =
    useState<MotionGraphicPreset[]>(defaultMotionGraphics);
  const [subtitleStyles, setSubtitleStyles] =
    useState<SubtitleStylePreset[]>(defaultSubtitleStyles);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [appliedSuccess, setAppliedSuccess] = useState<boolean>(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const activeClip =
    clips.find((c) => c.id === activeClipId) || clips[0];

  const currentEditingPreset =
    editingStyles.find((e) => e.id === activeClip.config.editingStyleId) ||
    editingStyles[0];
  const currentMotionPreset =
    motionGraphics.find((m) => m.id === activeClip.config.motionGraphicId) ||
    motionGraphics[0];
  const currentSubtitlePreset =
    subtitleStyles.find((s) => s.id === activeClip.config.subtitleStyleId) ||
    subtitleStyles[0];

  const handleSelectClip = (id: string) => {
    setActiveClipId(id);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleUpdateConfig = (partial: Partial<AutoEditClipConfig>) => {
    setClips((prev) =>
      prev.map((c) =>
        c.id === activeClip.id
          ? { ...c, config: { ...c.config, ...partial } }
          : c
      )
    );
  };

  const handleUpdateSubtitleLine = (
    lineId: string,
    updates: { text?: string; speaker?: "NARASUMBER" | "HOST" }
  ) => {
    setClips((prev) =>
      prev.map((c) => {
        if (c.id !== activeClip.id) return c;
        return {
          ...c,
          subtitles: c.subtitles.map((line) =>
            line.id === lineId ? { ...line, ...updates } : line
          ),
        };
      })
    );
  };

  const handleAddNewPreset = (
    pillar: "editing" | "motion" | "subtitle",
    preset: any
  ) => {
    if (pillar === "editing") {
      setEditingStyles((prev) => [...prev, preset]);
    } else if (pillar === "motion") {
      setMotionGraphics((prev) => [...prev, preset]);
    } else if (pillar === "subtitle") {
      setSubtitleStyles((prev) => [...prev, preset]);
    }
    setBannerNotice(
      `Preset baru "${preset.name}" berhasil ditambahkan dan langsung diaktifkan!`
    );
    setTimeout(() => setBannerNotice(null), 3500);
  };

  const handleApplyToAllClips = () => {
    const sourceConfig = activeClip.config;
    setClips((prev) =>
      prev.map((c) => ({
        ...c,
        config: { ...sourceConfig },
      }))
    );
    setAppliedSuccess(true);
    setBannerNotice(
      `Kombinasi 3 Pilar Gaya (${currentEditingPreset.name} • ${currentMotionPreset.name} • ${currentSubtitlePreset.name}) berhasil diterapkan ke seluruh ${clips.length} klip!`
    );
    setTimeout(() => {
      setAppliedSuccess(false);
      setBannerNotice(null);
    }, 3500);
  };

  const handleJumpToTime = (seconds: number) => {
    setCurrentTime(seconds);
  };

  return (
    <div className="w-full text-slate-100 pb-14">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 px-1 mb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm mb-1">
            <Link
              to="/app"
              className="text-[#6d868c] hover:text-[#2cd3c6] transition flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Studio Potong</span>
            </Link>
            <span className="text-[#3c565d]">/</span>
            <Link
              to="/viral-clips"
              className="text-[#6d868c] hover:text-[#2cd3c6] transition font-medium"
            >
              Deteksi Momen Viral
            </Link>
            <span className="text-[#3c565d]">/</span>
            <span className="text-white font-semibold tracking-wide">
              Edit Otomatis AI
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Studio Edit Otomatis AI (3 Pilar Kreatif)</span>
            <Wand2 className="w-5 h-5 text-[#2cd3c6]" />
          </h1>
          <p className="text-xs text-[#8ca4aa] mt-0.5">
            Atur kombinasi terpisah antara Gaya Edit Sinematik, Motion Graphic Infografis, dan Subtitle Otomatis secara langsung.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/viral-clips"
            className="px-3 py-1.5 rounded-xl bg-[#13373e] hover:bg-[#194750] border border-[#20b2aa]/40 text-[#2cd3c6] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Daftar 10 Klip Viral</span>
          </Link>
        </div>
      </div>

      {/* Notification Banner */}
      {bannerNotice && (
        <div className="mb-4 p-3 rounded-xl bg-[#132c32] border border-[#2cd3c6]/50 text-cyan-200 text-xs flex items-center gap-2 shadow-lg animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{bannerNotice}</span>
        </div>
      )}

      {/* Selected Clips Queue Strip (4 Clips) */}
      <div className="bg-[#0e2125]/90 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-3.5 mb-6 shadow-xl">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#2cd3c6]" />
            <span>Antrean Klip Terpilih (Klik Klip untuk Mengedit):</span>
          </span>
          <span className="text-[11px] text-[#8ca4aa]">
            Sedang Mengedit: <strong className="text-[#2cd3c6]">{activeClip.title}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {clips.map((c) => {
            const isCurrent = c.id === activeClip.id;
            const cEdit =
              editingStyles.find((e) => e.id === c.config.editingStyleId)
                ?.name || "Theo Podcast";
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectClip(c.id)}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer select-none ${
                  isCurrent
                    ? "bg-[#153a42] border-[#2cd3c6] shadow-[0_0_15px_rgba(44,211,198,0.2)]"
                    : "bg-[#12262b]/80 border-[#1d3940] hover:border-[#2cd3c6]/40"
                }`}
              >
                <div className="w-10 h-14 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10 relative">
                  <img
                    src={c.imageSrc}
                    alt={c.title}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0.5 right-0.5 px-1 rounded text-[8px] font-black bg-black/80 text-amber-300">
                    #{c.rank}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold text-amber-300 flex items-center gap-0.5">
                      <Flame className="w-2.5 h-2.5 fill-amber-400" />
                      <span>{c.viralScore}</span>
                    </span>
                    <span className="text-[9px] font-mono text-[#7d9399]">
                      {c.duration}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white truncate mt-0.5">
                    {c.title}
                  </h4>
                  <p className="text-[10px] text-[#2cd3c6] truncate mt-0.5 flex items-center gap-1">
                    <Film className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{cEdit}</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace: Left (9:16 Live Preview) + Right (3-Pillar Controls) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (4 cols on desktop): Sticky 9:16 Live Preview */}
        <div className="lg:col-span-4 lg:sticky lg:top-20">
          <LivePreviewCanvas
            clip={activeClip}
            editingPreset={currentEditingPreset}
            motionPreset={currentMotionPreset}
            subtitlePreset={currentSubtitlePreset}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            onApplyToAllClips={handleApplyToAllClips}
            appliedSuccess={appliedSuccess}
          />
        </div>

        {/* Right Column (8 cols on desktop): 3 Distinct Creative Pillars */}
        <div className="lg:col-span-8">
          <ThreePillarStyleWorkspace
            clip={activeClip}
            editingStyles={editingStyles}
            motionGraphics={motionGraphics}
            subtitleStyles={subtitleStyles}
            onUpdateConfig={handleUpdateConfig}
            onUpdateSubtitleLine={handleUpdateSubtitleLine}
            onAddNewPreset={handleAddNewPreset}
            onJumpToTime={handleJumpToTime}
          />
        </div>
      </div>
    </div>
  );
}
