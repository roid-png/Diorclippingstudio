import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { siteConfig } from "@/config/site";
import {
  Wand2,
  ArrowLeft,
  Flame,
  CheckCircle2,
  Sparkles,
  Film,
  Layers,
  Type,
  Save,
  RotateCcw,
  Download,
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

const STORAGE_KEY = "dior_clipping_auto_edit_state_v1";

function EditOtomatisPage() {
  const [clips, setClips] = useState<AutoEditClipItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.clips) && parsed.clips.length > 0) {
          return parsed.clips;
        }
      }
    } catch {
      // ignore storage errors
    }
    return initialAutoEditClips;
  });

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
  const [lastSavedText, setLastSavedText] = useState<string>("Tersimpan otomatis");

  // Auto-save per-clip edit state whenever clips change
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          clips,
          updatedAt: new Date().toISOString(),
        })
      );
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      setLastSavedText(`Tersimpan (${hh}:${mm}:${ss})`);
    } catch {
      // ignore quota/storage errors
    }
  }, [clips]);

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

  const handleResetAllState = () => {
    setClips(initialAutoEditClips);
    setEditingStyles(defaultEditingStyles);
    setMotionGraphics(defaultMotionGraphics);
    setSubtitleStyles(defaultSubtitleStyles);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setBannerNotice(
      "Seluruh pilihan edit per klip telah di-reset ke konfigurasi referensi awal (Theo Reference)!"
    );
    setTimeout(() => setBannerNotice(null), 3000);
  };

  const handleManualSaveConfirm = () => {
    setBannerNotice(
      `Konfigurasi 3 Pilar untuk seluruh ${clips.length} klip telah disimpan di state aplikasi! ✅`
    );
    setTimeout(() => setBannerNotice(null), 2800);
  };

  const handleToggleClipSubtitle = (clipId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = clips.find((c) => c.id === clipId);
    if (!target) return;
    const nextState = !target.config.subtitleEnabled;
    setClips((prev) =>
      prev.map((c) =>
        c.id === clipId
          ? { ...c, config: { ...c.config, subtitleEnabled: nextState } }
          : c
      )
    );
    setBannerNotice(
      `Subtitle Otomatis untuk Klip #${target.rank} (${target.title}) telah ${
        nextState ? "DIAKTIFKAN (ON)" : "DINONAKTIFKAN (OFF)"
      }!`
    );
    setTimeout(() => setBannerNotice(null), 2800);
  };

  const handleToggleAllSubtitles = (enabled: boolean) => {
    setClips((prev) =>
      prev.map((c) => ({
        ...c,
        config: { ...c.config, subtitleEnabled: enabled },
      }))
    );
    setBannerNotice(
      `Subtitle Otomatis berhasil ${
        enabled ? "DIAKTIFKAN" : "DINONAKTIFKAN"
      } untuk seluruh ${clips.length} klip!`
    );
    setTimeout(() => setBannerNotice(null), 2800);
  };

  const enabledSubtitleCount = clips.filter(
    (c) => c.config.subtitleEnabled
  ).length;

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
            Setiap klip menyimpan konfigurasi Gaya Edit, Motion Graphic, dan Subtitle Otomatisnya secara mandiri di state.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* State Save Indicator & Actions */}
          <button
            type="button"
            onClick={handleManualSaveConfirm}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-400/40 text-emerald-300 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Pilihan edit tersimpan otomatis per klip"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{lastSavedText}</span>
          </button>

          <button
            type="button"
            onClick={handleResetAllState}
            className="px-2.5 py-1.5 rounded-xl bg-[#14282e] hover:bg-[#1b363e] border border-[#1f3e46] text-[#9ab4ba] hover:text-white text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
            title="Reset seluruh klip ke setelan awal referensi"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>

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

      {/* Selected Clips Queue Strip (4 Clips) with Per-Clip Saved State & Subtitle Toggle */}
      <div className="bg-[#0e2125]/90 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-3.5 mb-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#2cd3c6]" />
            <span>Antrean Klip Terpilih (State Pilihan Edit Tersimpan Per Klip):</span>
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[#0a181c] border border-[#1d3940] text-[11px] text-[#9ab4ba] flex items-center gap-1.5">
              <Type className="w-3 h-3 text-rose-400" />
              <span>
                Subtitle Aktif:{" "}
                <strong className="text-emerald-300">
                  {enabledSubtitleCount}/{clips.length} Klip
                </strong>
              </span>
            </span>

            <button
              type="button"
              onClick={() =>
                handleToggleAllSubtitles(enabledSubtitleCount < clips.length)
              }
              className="px-2.5 py-1 rounded-lg bg-[#142e35] hover:bg-[#1a3c45] border border-[#2cd3c6]/30 text-[11px] font-semibold text-[#2cd3c6] transition cursor-pointer"
            >
              {enabledSubtitleCount < clips.length
                ? "Aktifkan CC Semua Klip"
                : "Matikan CC Semua Klip"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {clips.map((c) => {
            const isCurrent = c.id === activeClip.id;
            const cEdit =
              editingStyles.find((e) => e.id === c.config.editingStyleId)
                ?.name || "Theo Podcast";
            const cMotion =
              motionGraphics.find((m) => m.id === c.config.motionGraphicId)
                ?.name || "Infografis";
            const cSub =
              subtitleStyles.find((s) => s.id === c.config.subtitleStyleId)
                ?.name || "Red Pill";
            return (
              <div
                key={c.id}
                onClick={() => handleSelectClip(c.id)}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer select-none ${
                  isCurrent
                    ? "bg-[#153a42] border-[#2cd3c6] shadow-[0_0_15px_rgba(44,211,198,0.2)]"
                    : "bg-[#12262b]/80 border-[#1d3940] hover:border-[#2cd3c6]/40"
                }`}
              >
                <div className="flex items-center gap-2.5">
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
                      <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/30">
                        {isCurrent ? "Sedang Diedit" : "State Tersimpan"}
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
                </div>

                {/* Saved 3-Pillar Tags per Clip */}
                <div className="flex flex-wrap items-center gap-1 text-[9px]">
                  <span className="px-1.5 py-0.2 rounded bg-purple-950/50 text-purple-300 border border-purple-400/25 truncate max-w-[120px]">
                    ✨ {cMotion}
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-rose-950/50 text-rose-300 border border-rose-400/25 truncate max-w-[120px]">
                    🔤 {c.config.subtitleEnabled ? cSub : "CC OFF"}
                  </span>
                </div>

                {/* Per-Clip Automatic Subtitle Quick Switch Bar */}
                <div className="pt-1.5 border-t border-white/10 flex items-center justify-between gap-1.5">
                  <span className="text-[10px] text-[#8ca4aa] flex items-center gap-1">
                    <Type className="w-2.5 h-2.5 text-rose-400" />
                    <span>Subtitle Otomatis:</span>
                  </span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={c.config.subtitleEnabled}
                    onClick={(e) => handleToggleClipSubtitle(c.id, e)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1.5 transition cursor-pointer ${
                      c.config.subtitleEnabled
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50 hover:bg-emerald-500/30"
                        : "bg-[#0d1c20] text-gray-400 border-white/10 hover:text-white"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        c.config.subtitleEnabled
                          ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]"
                          : "bg-gray-500"
                      }`}
                    />
                    <span>{c.config.subtitleEnabled ? "ON" : "OFF"}</span>
                  </button>
                </div>
              </div>
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
            onToggleSubtitle={() =>
              handleToggleClipSubtitle(activeClip.id)
            }
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

      {/* Bottom Summary Footer Bar: Saved State Overview & Batch Render */}
      <div className="mt-6 bg-[#0e2125]/95 backdrop-blur-md border border-[#2cd3c6]/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#14373f] border border-[#2cd3c6]/40 flex items-center justify-center text-[#2cd3c6] shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white">
              Seluruh {clips.length} Klip Siap Dirender Sesuai Gaya Pilihan Masing-Masing
            </h4>
            <p className="text-[11px] text-[#8ca4aa]">
              State per klip tersimpan otomatis • {enabledSubtitleCount} dari{" "}
              {clips.length} klip menggunakan Subtitle Otomatis aktif.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleApplyToAllClips}
            className="h-9 px-3.5 rounded-xl bg-[#142e35] hover:bg-[#1b3d46] border border-[#2cd3c6]/35 text-[#2cd3c6] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Samakan Gaya Semua Klip</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBannerNotice(
                `Memulai proses render cepat untuk seluruh ${clips.length} klip sesuai state masing-masing... 🚀`
              );
              setTimeout(() => setBannerNotice(null), 3500);
            }}
            className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#1a858c] via-[#21a6a3] to-[#2cd3c6] text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(44,211,198,0.3)] hover:brightness-110 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Render & Unduh Semua ({clips.length} MP4)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
