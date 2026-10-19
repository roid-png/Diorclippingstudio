import {
  CheckSquare,
  Filter,
  Flame,
  RotateCcw,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import type { RenderJobStatus } from "../types";

export type RenderFilterTab = "all" | RenderJobStatus;

interface RenderQueueFilterBarProps {
  activeFilter: RenderFilterTab;
  onFilterChange: (filter: RenderFilterTab) => void;
  counts: {
    all: number;
    completed: number;
    rendering: number;
    queued: number;
    idle: number;
    failed: number;
  };
  selectedCount: number;
  onSelectAll: () => void;
  onSelectTop3: () => void;
  onResetAllToIdle: () => void;
  onSimulateError?: () => void;
}

export function RenderQueueFilterBar({
  activeFilter,
  onFilterChange,
  counts,
  selectedCount,
  onSelectAll,
  onSelectTop3,
  onResetAllToIdle,
  onSimulateError,
}: RenderQueueFilterBarProps) {
  const tabs: Array<{
    id: RenderFilterTab;
    label: string;
    count: number;
    badgeClass: string;
  }> = [
    {
      id: "all",
      label: "Semua Klip",
      count: counts.all,
      badgeClass: "bg-slate-800 text-slate-200",
    },
    {
      id: "completed",
      label: "Siap Unduh",
      count: counts.completed,
      badgeClass: "bg-emerald-500/20 text-emerald-300",
    },
    {
      id: "rendering",
      label: "Sedang Render",
      count: counts.rendering + counts.queued,
      badgeClass: "bg-red-500/20 text-red-300",
    },
    {
      id: "idle",
      label: "Siap Render",
      count: counts.idle,
      badgeClass: "bg-amber-500/20 text-amber-300",
    },
    {
      id: "failed",
      label: "Perlu Retry",
      count: counts.failed,
      badgeClass: "bg-rose-500/20 text-rose-300",
    },
  ];

  return (
    <div className="rounded-2xl border border-[#1b3942] bg-[#0b1b20]/90 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 px-2 text-xs font-semibold text-slate-400">
          <Filter className="h-3.5 w-3.5 text-red-400" />
          Status:
        </span>
        {tabs.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onFilterChange(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? "bg-[#16343d] text-white border border-[#2cd3c6]/50 shadow-sm"
                  : "bg-[#0e2228] text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${tab.badgeClass}`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Quick Selection & Queue Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSelectTop3}
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-900/40 transition cursor-pointer"
        >
          <Flame className="h-3.5 w-3.5" />
          Pilih Top 3 Viral
        </button>

        <button
          type="button"
          onClick={onSelectAll}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#21444e] bg-[#10262c] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-[#16333b] transition cursor-pointer"
        >
          <CheckSquare className="h-3.5 w-3.5 text-[#2cd3c6]" />
          Pilih Semua ({selectedCount}/10)
        </button>

        {onSimulateError && (
          <button
            type="button"
            onClick={onSimulateError}
            className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-950/30 px-2.5 py-1.5 text-[11px] font-medium text-rose-300 hover:bg-rose-900/40 transition cursor-pointer"
            title="Simulasikan gangguan render untuk menguji fitur Coba Lagi (Retry)"
          >
            <AlertTriangle className="h-3 w-3" />
            Uji Gagal
          </button>
        )}

        <button
          type="button"
          onClick={onResetAllToIdle}
          className="inline-flex items-center gap-1 rounded-xl border border-[#21444e] bg-[#0e2127] px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-white transition cursor-pointer"
          title="Reset status antrean render"
        >
          <RotateCcw className="h-3 w-3" />
          Reset Status
        </button>
      </div>
    </div>
  );
}

