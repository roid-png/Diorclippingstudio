import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { siteConfig } from "@/config/site";
import {
  Flame,
  ArrowLeft,
  Wand2,
  Download,
  CheckCircle2,
  AlertTriangle,
  Star,
} from "lucide-react";
import { initialViralClips } from "@/features/viral-detection/mock-data";
import type { ViralClipItem, ViralFilterState } from "@/features/viral-detection/types";
import { ViralStatsOverview } from "@/features/viral-detection/components/ViralStatsOverview";
import { ViralFilterSortBar } from "@/features/viral-detection/components/ViralFilterSortBar";
import { ViralMomentCard } from "@/features/viral-detection/components/ViralMomentCard";
import { ViralMomentDetailModal } from "@/features/viral-detection/components/ViralMomentDetailModal";

export const Route = createFileRoute("/_protected/viral-clips")({
  head: () => ({ meta: [{ title: `Deteksi Momen Viral | ${siteConfig.name}` }] }),
  component: DeteksiMomenViralPage,
});

const MAX_FAVORITES = 10;

function DeteksiMomenViralPage() {
  const [clips, setClips] = useState<ViralClipItem[]>(initialViralClips);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [inspectedClip, setInspectedClip] = useState<ViralClipItem | null>(null);
  const [downloadBatchNotice, setDownloadBatchNotice] = useState<string | null>(null);
  const [maxLimitWarning, setMaxLimitWarning] = useState<string | null>(null);

  const [filter, setFilter] = useState<ViralFilterState>({
    category: "all",
    sortBy: "viral-desc",
    searchQuery: "",
  });
  const [clipLimit, setClipLimit] = useState<number>(10);

  const selectedCount = clips.filter((c) => c.isSelected).length;
  const isMaxFavoritesReached = selectedCount >= MAX_FAVORITES;

  const handleTogglePlayInline = (clipId: string) => {
    setActivePlayingId((prev) => (prev === clipId ? null : clipId));
  };

  const handleToggleSelectClip = (clipId: string) => {
    const targetClip = clips.find((c) => c.id === clipId);
    if (!targetClip) return;

    if (!targetClip.isSelected && isMaxFavoritesReached) {
      setMaxLimitWarning(
        `Batas maksimal ${MAX_FAVORITES} klip favorit telah tercapai! Hapus pilihan klip lain untuk memilih klip baru.`
      );
      setTimeout(() => setMaxLimitWarning(null), 4000);
      return;
    }

    setClips((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, isSelected: !c.isSelected } : c))
    );
  };

  const handleSelectAll = () => {
    // Select up to MAX_FAVORITES (strictly top 10 by viral score)
    setClips((prev) => {
      const sorted = [...prev].sort((a, b) => b.viralScore - a.viralScore);
      const top10Ids = new Set(sorted.slice(0, MAX_FAVORITES).map((c) => c.id));
      return prev.map((c) => ({
        ...c,
        isSelected: top10Ids.has(c.id),
      }));
    });
  };

  const handleDeselectAll = () => {
    setClips((prev) => prev.map((c) => ({ ...c, isSelected: false })));
  };

  // Filter and Sort clips
  const filteredClips = useMemo(() => {
    let result = [...clips];

    // Category filter
    if (filter.category === "top3") {
      result = result.filter((c) => c.rank <= 3);
    } else if (filter.category === "mega") {
      result = result.filter((c) => c.viralScore >= 95);
    } else if (filter.category === "favorites") {
      result = result.filter((c) => c.isSelected);
    } else if (filter.category !== "all") {
      result = result.filter((c) => c.category === filter.category);
    }

    // Search query
    if (filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.highlightMoment.toLowerCase().includes(q) ||
          c.whyViral.toLowerCase().includes(q)
      );
    }

    // Sort
    if (filter.sortBy === "viral-desc") {
      result.sort((a, b) => b.viralScore - a.viralScore);
    } else if (filter.sortBy === "viral-asc") {
      result.sort((a, b) => a.viralScore - b.viralScore);
    } else if (filter.sortBy === "timeline-asc") {
      result.sort((a, b) => {
        const aStart = parseInt(a.timeRange.split(":")[0], 10);
        const bStart = parseInt(b.timeRange.split(":")[0], 10);
        return aStart - bStart;
      });
    } else if (filter.sortBy === "duration-desc") {
      result.sort((a, b) => {
        const aDur = parseInt(a.duration, 10);
        const bDur = parseInt(b.duration, 10);
        return bDur - aDur;
      });
    }

    return result.slice(0, clipLimit);
  }, [clips, filter, clipLimit]);

  const handleBatchDownload = () => {
    const selected = clips.filter((c) => c.isSelected);
    if (selected.length === 0) return;

    setDownloadBatchNotice(`Memproses unduhan ${selected.length} klip favorit...`);
    setTimeout(() => {
      setDownloadBatchNotice(`Berhasil mengunduh ${selected.length} klip pilihan! 📥`);
      setTimeout(() => setDownloadBatchNotice(null), 3000);
    }, 1500);
  };

  return (
    <div className="w-full text-slate-100 pb-16">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 px-1 mb-5">
        <div>
          <div className="flex items-center gap-2 text-sm mb-1">
            <Link
              to="/app"
              className="text-[#6d868c] hover:text-[#2cd3c6] transition flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Studio Potong</span>
            </Link>
            <span className="text-[#3c565d]">/</span>
            <span className="text-white font-medium tracking-wide">
              Deteksi Momen Viral
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Deteksi Momen Viral AI</span>
            <Flame className="w-5 h-5 text-amber-400 fill-amber-400 animate-pulse" />
          </h1>
          <p className="text-xs text-[#8ca4aa] mt-0.5">
            Pilih hingga maksimal 10 klip favorit berdasarkan rekomendasi skor viral untuk dirender dan diunduh.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/auto-edit"
            className="px-3 py-1.5 rounded-xl bg-[#13373e] hover:bg-[#194750] border border-[#20b2aa]/40 text-[#2cd3c6] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Studio Edit Otomatis</span>
          </Link>
        </div>
      </div>

      {/* Warning: Maximum 10 limit reached */}
      {maxLimitWarning && (
        <div className="mb-4 p-3 rounded-xl bg-amber-950/80 border border-amber-400/60 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{maxLimitWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setMaxLimitWarning(null)}
            className="text-amber-300 hover:text-white text-xs underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Batch download notification */}
      {downloadBatchNotice && (
        <div className="mb-4 p-3 rounded-xl bg-[#132c32] border border-[#2cd3c6]/50 text-cyan-200 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{downloadBatchNotice}</span>
        </div>
      )}

      {/* 4 Stats Cards */}
      <ViralStatsOverview clips={clips} />

      {/* Filter & Sorting Bar with 1-10 Limit Control */}
      <ViralFilterSortBar
        filter={filter}
        setFilter={setFilter}
        totalClipsCount={clips.length}
        selectedClipsCount={selectedCount}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        clipLimit={clipLimit}
        setClipLimit={setClipLimit}
      />

      {/* 4-Columns Grid: Aspect 9:16 Viral Moments */}
      {filteredClips.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-4.5">
          {filteredClips.map((clip) => (
            <ViralMomentCard
              key={clip.id}
              clip={clip}
              isPlayingInline={activePlayingId === clip.id}
              onTogglePlayInline={handleTogglePlayInline}
              onToggleSelectClip={handleToggleSelectClip}
              onInspectClip={(c) => setInspectedClip(c)}
              isMaxFavoritesReached={isMaxFavoritesReached}
            />
          ))}
        </div>
      ) : (
        <div className="bg-[#0e2125]/60 border border-[#1e3c43] rounded-2xl p-12 text-center text-[#7d9399]">
          <p className="text-sm">Tidak ada klip viral yang cocok dengan filter pencarian ini.</p>
          <button
            type="button"
            onClick={() =>
              setFilter({ category: "all", sortBy: "viral-desc", searchQuery: "" })
            }
            className="mt-3 px-3 py-1.5 rounded-lg bg-[#14282e] text-[#2cd3c6] text-xs font-medium cursor-pointer"
          >
            Reset Filter
          </button>
        </div>
      )}

      {/* Detailed Modal */}
      <ViralMomentDetailModal
        clip={inspectedClip}
        onClose={() => setInspectedClip(null)}
        onToggleSelect={handleToggleSelectClip}
      />

      {/* Floating Sticky Bar when clips are selected (Max 10) */}
      {selectedCount > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-2xl mx-auto z-40 bg-[#0e2125]/95 border border-[#2cd3c6]/60 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2 pl-1">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-xs font-bold text-white">
                {selectedCount} dari {MAX_FAVORITES} Klip Dipilih
              </span>
            </div>

            {/* 10-Dots Quota Visual Indicator */}
            <div
              className="flex items-center gap-1 bg-[#09171a] px-2 py-1 rounded-lg border border-[#1b373e]"
              title={`${selectedCount} dari ${MAX_FAVORITES} klip dipilih`}
            >
              {Array.from({ length: MAX_FAVORITES }).map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i < selectedCount
                      ? "bg-[#2cd3c6] shadow-[0_0_6px_rgba(44,211,198,0.8)] scale-110"
                      : "bg-[#1f3d44]"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleDeselectAll}
              className="h-8 px-2.5 rounded-xl bg-[#14282e] hover:bg-[#1a373f] text-[#8ca4aa] hover:text-white border border-[#1f3e46] text-xs font-medium cursor-pointer transition"
              title="Batalkan Semua Pilihan"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={handleBatchDownload}
              className="h-8 px-3.5 rounded-xl bg-gradient-to-r from-[#17858c] via-[#20a3a7] to-[#2cd3c6] text-white text-xs font-bold flex items-center gap-1.5 hover:brightness-110 shadow-md cursor-pointer transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh {selectedCount} MP4</span>
            </button>

            <Link
              to="/auto-edit"
              className="h-8 px-3.5 rounded-xl bg-[#143d46] hover:bg-[#1c5562] text-[#2cd3c6] border border-[#2cd3c6]/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Lanjut Edit</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
