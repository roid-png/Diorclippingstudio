import { AlertTriangle, Film, Trash2, X } from "lucide-react";
import type { ProjectHistoryItem } from "../types";

interface DeleteProjectConfirmDialogProps {
  project: ProjectHistoryItem | null;
  onCancel: () => void;
  onConfirmDelete: (project: ProjectHistoryItem) => void;
}

export function DeleteProjectConfirmDialog({
  project,
  onCancel,
  onConfirmDelete,
}: DeleteProjectConfirmDialogProps) {
  if (!project) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-project-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-rose-500/50 bg-[#0d181d] p-5 sm:p-6 shadow-2xl shadow-rose-950/50 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-950/40 text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">
                Konfirmasi Hapus Proyek
              </span>
              <h3
                id="delete-project-dialog-title"
                className="text-base font-extrabold text-white"
              >
                Hapus Proyek dari Riwayat?
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Anda akan menghapus proyek berikut secara permanen beserta konfigurasi{" "}
          <strong className="text-white">Preset 3 Pilar</strong> dan daftar klip
          hasil auto-cut:
        </p>

        {/* Project Summary Box */}
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3.5 space-y-2">
          <div className="text-xs sm:text-sm font-bold text-white line-clamp-2">
            {project.title}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
            <span className="inline-flex items-center gap-1 rounded bg-[#142c34] px-2 py-0.5 text-cyan-200 font-semibold">
              <Film className="h-3 w-3 text-cyan-400" />
              {project.completedClipsCount}/{project.requestedClipsCount} Klip
              MP4
            </span>
            <span>•</span>
            <span>Durasi Target: {project.targetClipDurationSec} dtk</span>
            <span>•</span>
            <span className="text-amber-300 font-semibold">
              Top Skor {project.topViralScore}/100
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200">
          Pastikan Anda telah mengunduh file video MP4 yang dibutuhkan sebelum
          menghapus proyek ini dari arsip.
        </div>

        {/* Dialog Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#18333c]">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#244954] bg-[#11262d] px-4 py-2 text-xs font-bold text-slate-200 hover:text-white hover:bg-[#17333c] transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onConfirmDelete(project)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-950/60 hover:from-rose-500 hover:to-red-500 transition cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Ya, Hapus Proyek
          </button>
        </div>
      </div>
    </div>
  );
}

