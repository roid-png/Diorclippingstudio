import { Link } from "@tanstack/react-router";
import {
  FolderOpen,
  Link2,
  Plus,
  RotateCcw,
  Sparkles,
  Upload,
} from "lucide-react";

interface ProjectHistoryEmptyStateProps {
  mode: "no-projects" | "no-filter-matches";
  searchQuery?: string;
  onResetFilters: () => void;
  onRestoreDemoProjects: () => void;
}

export function ProjectHistoryEmptyState({
  mode,
  searchQuery,
  onResetFilters,
  onRestoreDemoProjects,
}: ProjectHistoryEmptyStateProps) {
  if (mode === "no-filter-matches") {
    return (
      <div className="rounded-2xl border border-[#1b3942] bg-[#0b1a1f]/90 p-10 text-center space-y-4 shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-950/30 text-cyan-400">
          <FolderOpen className="h-7 w-7" />
        </div>

        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="text-base sm:text-lg font-extrabold text-white">
            Tidak Ada Proyek yang Cocok dengan Filter
          </h3>
          <p className="text-xs sm:text-sm text-slate-300">
            {searchQuery
              ? `Pencarian "${searchQuery}" tidak menemukan proyek yang sesuai.`
              : "Tidak ada proyek pada kombinasi filter sumber, durasi, atau status saat ini."}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:from-cyan-500 hover:to-teal-500 transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Semua Filter Pencarian
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#1e3e48] bg-gradient-to-b from-[#0b1b20] to-[#081317] p-8 sm:p-12 text-center space-y-6 shadow-2xl">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-500/40 bg-purple-950/30 text-purple-400 shadow-lg shadow-purple-950/50">
        <Sparkles className="h-8 w-8" />
      </div>

      <div className="space-y-2 max-w-xl mx-auto">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/15 px-3 py-1 text-[11px] font-bold text-purple-200">
          Riwayat Proyek Masih Kosong
        </span>
        <h2 className="text-xl sm:text-2xl font-extrabold text-white">
          Belum Ada Sesi Pemotongan Video Otomatis
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Mulai proyek pertama Anda dengan menempelkan{" "}
          <span className="text-red-300 font-semibold">Link YouTube</span> atau{" "}
          <span className="text-cyan-300 font-semibold">
            Unggah Video Lokal
          </span>
          . AI kami akan mendeteksi hingga{" "}
          <strong className="text-white">10 momen paling viral</strong> (30s,
          45s, atau 60s) lengkap dengan gaya edit ala Netflix, Motion HUD, dan
          Subtitle Otomatis.
        </p>
      </div>

      {/* 3 Quick Onboarding Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto text-left">
        <div className="rounded-xl border border-[#1b3842] bg-[#0e2127]/90 p-3.5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-red-300">
            <Link2 className="h-4 w-4" />
            1. Paste Link YouTube / Upload
          </div>
          <p className="text-[11px] text-slate-400">
            Pilih target durasi 30 detik, 45 detik, atau 1 menit dan kuota
            maksimal 10 klip.
          </p>
        </div>

        <div className="rounded-xl border border-[#1b3842] bg-[#0e2127]/90 p-3.5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
            <Sparkles className="h-4 w-4" />
            2. Pilih Preset 3 Pilar
          </div>
          <p className="text-[11px] text-slate-400">
            Padukan Gaya Edit Sinematik, Motion Graphic HUD, dan Subtitle
            Otomatis.
          </p>
        </div>

        <div className="rounded-xl border border-[#1b3842] bg-[#0e2127]/90 p-3.5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <Upload className="h-4 w-4" />
            3. Render Cepat & Unduh MP4
          </div>
          <p className="text-[11px] text-slate-400">
            Kompilasi video 9:16 60FPS siap unggah ke TikTok, Reels, dan Shorts.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          to="/app"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-purple-950/50 hover:from-purple-500 hover:to-indigo-500 transition"
        >
          <Plus className="h-4 w-4" />
          Mulai Potong Video Pertama Sekarang
        </Link>

        <button
          type="button"
          onClick={onRestoreDemoProjects}
          className="inline-flex items-center gap-2 rounded-xl border border-[#244955] bg-[#11262d] px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white hover:bg-[#17333c] transition cursor-pointer"
        >
          <RotateCcw className="h-4 w-4 text-cyan-400" />
          Muat Ulang Data Contoh (5 Proyek)
        </button>
      </div>
    </div>
  );
}

