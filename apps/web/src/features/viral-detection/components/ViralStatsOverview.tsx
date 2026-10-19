import { Flame, Sparkles, Clock, Target } from "lucide-react";
import type { ViralClipItem } from "../types";

interface ViralStatsOverviewProps {
  clips: ViralClipItem[];
}

export function ViralStatsOverview({ clips }: ViralStatsOverviewProps) {
  const topClip = clips[0] || null;
  const avgScore =
    clips.length > 0
      ? (clips.reduce((acc, c) => acc + c.viralScore, 0) / clips.length).toFixed(1)
      : "95.5";
  const selectedCount = clips.filter((c) => c.isSelected).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {/* Stat 1: Skor Viral Tertinggi */}
      <div className="bg-[#0e2125]/90 backdrop-blur-md border border-[#1e3c43] hover:border-[#2cd3c6]/40 rounded-2xl p-3.5 sm:p-4 transition-all shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#8ca4aa] font-medium">Skor Viral Puncak</span>
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Flame className="w-4 h-4 fill-amber-400/20" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl sm:text-2xl font-black text-amber-300 tracking-tight">
            {topClip?.viralScoreFormatted || "99/100"}
          </span>
          <span className="text-[10px] text-emerald-400 font-medium">Rank #1</span>
        </div>
        <p className="text-[11px] text-[#789399] mt-1 truncate">
          {topClip?.title || "White Collar Jobs Terancam AI"}
        </p>
      </div>

      {/* Stat 2: Total Deteksi Momen */}
      <div className="bg-[#0e2125]/90 backdrop-blur-md border border-[#1e3c43] hover:border-[#2cd3c6]/40 rounded-2xl p-3.5 sm:p-4 transition-all shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#8ca4aa] font-medium">Total Momen Terdeteksi</span>
          <div className="w-7 h-7 rounded-lg bg-[#20b2aa]/10 border border-[#2cd3c6]/20 flex items-center justify-center text-[#2cd3c6]">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {clips.length} Klip
          </span>
          <span className="text-[10px] text-[#2cd3c6] font-medium">Maksimal 10</span>
        </div>
        <p className="text-[11px] text-[#789399] mt-1">
          {selectedCount} klip terpilih untuk diunduh/render
        </p>
      </div>

      {/* Stat 3: Rata-rata Skor Viral */}
      <div className="bg-[#0e2125]/90 backdrop-blur-md border border-[#1e3c43] hover:border-[#2cd3c6]/40 rounded-2xl p-3.5 sm:p-4 transition-all shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#8ca4aa] font-medium">Rata-rata Potensi Viral</span>
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Target className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl sm:text-2xl font-black text-cyan-200 tracking-tight">
            {avgScore}/100
          </span>
          <span className="text-[10px] text-[#2cd3c6] font-medium">Tinggi 🔥</span>
        </div>
        <p className="text-[11px] text-[#789399] mt-1">
          Dihitung dari retensi hook 3 detik
        </p>
      </div>

      {/* Stat 4: Durasi Sweetspot */}
      <div className="bg-[#0e2125]/90 backdrop-blur-md border border-[#1e3c43] hover:border-[#2cd3c6]/40 rounded-2xl p-3.5 sm:p-4 transition-all shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#8ca4aa] font-medium">Durasi Sweetspot</span>
          <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
            30s & 45s
          </span>
          <span className="text-[10px] text-teal-300 font-medium">Optimal</span>
        </div>
        <p className="text-[11px] text-[#789399] mt-1">
          Format 9:16 vertikal TikTok / Shorts
        </p>
      </div>
    </div>
  );
}
