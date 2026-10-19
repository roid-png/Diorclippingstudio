import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { siteConfig } from "@/config/site";
import { Flame, ArrowLeft, Wand2, Download, CheckCircle2 } from "lucide-react";
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

function DeteksiMomenViralPage() {
  const [clips, setClips] = useState<ViralClipItem[]>(initialViralClips);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [inspectedClip, setInspectedClip] = useState<ViralClipItem | null>(null);
  const [downloadBatchNotice, setDownloadBatchNotice] = useState<string | null>(null);

  const [filter, setFilter] = useState<ViralFilterState>({
    category: "all",
    sortBy: "viral-desc",
    searchQuery: "",
  });

  const handleTogglePlayInline = (clipId: string) => {
    setActivePlayingId((prev) => (prev === clipId ? null : clipId));
  };

  const handleToggleSelectClip = (clipId: string) => {
    setClips((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, isSelected: !c.isSelected } : c))
    );
  };

  const handleSelectAll = () => {
    setClips((prev) => prev.map((c) => ({ ...c, isSelected: true })));
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

    return result;
  }, [clips, filter]);

  const selectedCount = clips.filter((c) => c.isSelected).length;

  const handleBatchDownload = () => {
    const selected = clips.filter((c) => c.isSelected);
    if (selected.length === 0) return;

    setDownloadBatchNotice(`Memproses unduhan ${selected.length} klip viral...`);
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
            <Link to="/app" className="text-[#6d868c] hover:text-[#2cd3c6] transition flex items-center gap-1 font-medium">
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
            AI menganalisis retensi 3 detik pertama, energi sentimen percakapan, dan peluang viral FYP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/app"
            className="px-3 py-1.5 rounded-xl bg-[#13373e] hover:bg-[#194750] border border-[#20b2aa]/40 text-[#2cd3c6] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Studio Auto-Cut</span>
          </Link>
        </div>
      </div>

      {/* Batch download notification */}
      {downloadBatchNotice && (
        <div className="mb-4 p-3 rounded-xl bg-[#132c32] border border-[#2cd3c6]/50 text-cyan-200 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{downloadBatchNotice}</span>
        </div>
      )}

      {/* 4 Stats Cards */}
      <ViralStatsOverview clips={clips} />

      {/* Filter & Sorting Bar */}
      <ViralFilterSortBar
        filter={filter}
        setFilter={setFilter}
        totalClipsCount={clips.length}
        selectedClipsCount={selectedCount}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
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
            />
          ))}
        </div>
      ) : (
        <div className="bg-[#0e2125]/60 border border-[#1e3c43] rounded-2xl p-12 text-center text-[#7d9399]">
          <p className="text-sm">Tidak ada klip viral yang cocok dengan filter pencarian ini.</p>
          <button
            type="button"
            onClick={() => setFilter({ category: "all", sortBy: "viral-desc", searchQuery: "" })}
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

      {/* Floating Sticky Bar when clips are selected */}
      {selectedCount > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-2xl mx-auto z-40 bg-[#0e2125]/95 border border-[#2cd3c6]/60 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2 pl-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2cd3c6] animate-ping" />
            <span className="text-xs font-bold text-white">
              {selectedCount} dari 10 Klip Dipilih
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBatchDownload}
              className="h-8 px-4 rounded-xl bg-gradient-to-r from-[#17858c] via-[#20a3a7] to-[#2cd3c6] text-white text-xs font-bold flex items-center gap-1.5 hover:brightness-110 shadow-md cursor-pointer transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh {selectedCount} MP4</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
