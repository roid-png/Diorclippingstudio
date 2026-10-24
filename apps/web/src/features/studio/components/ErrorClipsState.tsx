import { AlertTriangle, RefreshCw, XCircle } from "lucide-react";

interface ErrorClipsStateProps {
  errorMessage: string;
  onRetry?: () => void;
  onReset?: () => void;
}

export function ErrorClipsState({
  errorMessage,
  onRetry,
  onReset,
}: ErrorClipsStateProps) {
  return (
    <div className="w-full bg-[#160c0f] border border-red-500/40 rounded-2xl p-6 sm:p-10 text-center flex flex-col items-center justify-center min-h-[300px] shadow-md text-slate-100 my-4">
      {/* Visual Error Icon */}
      <div className="w-14 h-14 rounded-2xl bg-red-900/40 border border-red-500/50 flex items-center justify-center text-red-400 mb-4 shadow-[0_0_20px_rgba(239,68,68,0.25)]">
        <AlertTriangle className="w-7 h-7" />
      </div>

      <h3 className="text-base sm:text-lg font-bold text-red-200 mb-2">
        Gagal Memproses Video
      </h3>

      <p className="text-xs sm:text-sm text-red-300/80 max-w-md leading-relaxed mb-6">
        {errorMessage ||
          "Terjadi kendala saat mengunduh atau menganalisis video YouTube sumber. Mohon pastikan video bersifat publik dan link dapat diakses."}
      </p>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-xl bg-red-600/80 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-md cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Coba Lagi</span>
          </button>
        )}

        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2 rounded-xl bg-[#14282e] hover:bg-[#1a343c] border border-[#1f3e46] text-[#8fa4aa] hover:text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Ganti Link Lain</span>
          </button>
        )}
      </div>
    </div>
  );
}

