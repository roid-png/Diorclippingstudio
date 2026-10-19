import { Search, SlidersHorizontal, CheckSquare, Square } from "lucide-react";
import type { HookCategory, ViralFilterState } from "../types";

interface ViralFilterSortBarProps {
  filter: ViralFilterState;
  setFilter: React.Dispatch<React.SetStateAction<ViralFilterState>>;
  totalClipsCount: number;
  selectedClipsCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function ViralFilterSortBar({
  filter,
  setFilter,
  totalClipsCount,
  selectedClipsCount,
  onSelectAll,
  onDeselectAll,
}: ViralFilterSortBarProps) {
  const categories: Array<{ id: HookCategory; label: string; icon: string }> = [
    { id: "all", label: `Semua (${totalClipsCount})`, icon: "⚡" },
    { id: "top3", label: "Top 3 Paling Viral", icon: "🔥" },
    { id: "controversy", label: "Hook Kontroversial", icon: "💥" },
    { id: "insight", label: "Insight Edukasi", icon: "💡" },
    { id: "story", label: "Story & Solusi", icon: "🏆" },
  ];

  const allSelected = selectedClipsCount === totalClipsCount && totalClipsCount > 0;

  return (
    <div className="bg-[#0e2125]/90 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-3.5 sm:p-4 mb-6 shadow-xl flex flex-col gap-3.5">
      {/* Top Row: Category Filter Chips & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => {
            const isActive = filter.category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilter((prev) => ({ ...prev, category: cat.id }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 select-none cursor-pointer ${
                  isActive
                    ? "bg-[#156670] border border-[#2cd3c6]/60 text-white shadow-[0_0_10px_rgba(44,211,198,0.3)]"
                    : "bg-[#14282e] border border-[#1f3e46] text-[#7d979e] hover:text-white hover:bg-[#1a373f]"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px] sm:min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-[#58737a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari topik klip..."
            value={filter.searchQuery}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, searchQuery: e.target.value }))
            }
            className="w-full h-8 bg-[#14282e] border border-[#1f3e46] focus:border-[#2cd3c6] rounded-xl pl-8 pr-3 text-xs text-white placeholder-[#58737a] focus:outline-none transition shadow-inner"
          />
        </div>
      </div>

      {/* Bottom Row: Sorting & Multi-select Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1b373e]">
        {/* Selection status */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14282e] hover:bg-[#1a373f] border border-[#1f3e46] text-xs font-medium text-gray-200 transition cursor-pointer"
          >
            {allSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-[#2cd3c6]" />
            ) : (
              <Square className="w-3.5 h-3.5 text-[#6f8a91]" />
            )}
            <span>{allSelected ? "Batalkan Pilihan" : "Pilih Semua (Maks 10)"}</span>
          </button>

          <span className="text-xs text-[#7d9399]">
            <strong className="text-[#2cd3c6]">{selectedClipsCount}</strong> dari {totalClipsCount} klip dipilih
          </span>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#7d9399] flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-[#2cd3c6]" />
            <span>Urutkan:</span>
          </span>
          <select
            value={filter.sortBy}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                sortBy: e.target.value as ViralFilterState["sortBy"],
              }))
            }
            className="bg-[#14282e] border border-[#1f3e46] text-xs text-white rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#2cd3c6] cursor-pointer"
          >
            <option value="viral-desc" className="bg-[#0e2125]">
              🔥 Skor Viral Tertinggi
            </option>
            <option value="timeline-asc" className="bg-[#0e2125]">
              ⏱️ Urutan Waktu Video (Timeline)
            </option>
            <option value="duration-desc" className="bg-[#0e2125]">
              ⏳ Durasi Terpanjang
            </option>
          </select>
        </div>
      </div>
    </div>
  );
}
