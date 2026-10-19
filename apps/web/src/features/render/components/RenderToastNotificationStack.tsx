import {
  AlertTriangle,
  CheckCircle2,
  Download,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";

export interface RenderToastItem {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
  clipId?: string;
  fileName?: string;
  createdAt: string;
}

interface RenderToastNotificationStackProps {
  toasts: RenderToastItem[];
  onDismiss: (toastId: string) => void;
  onQuickDownload?: (clipId: string) => void;
  onQuickRetry?: (clipId: string) => void;
}

export function RenderToastNotificationStack({
  toasts,
  onDismiss,
  onQuickDownload,
  onQuickRetry,
}: RenderToastNotificationStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2.5 pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isError = toast.type === "error";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border p-4 shadow-2xl backdrop-blur-md transition-all ${
              isSuccess
                ? "border-emerald-500/50 bg-[#082220]/95 text-emerald-100 shadow-emerald-950/60"
                : isError
                ? "border-rose-500/60 bg-[#250d15]/95 text-rose-100 shadow-rose-950/60"
                : "border-cyan-500/40 bg-[#0b1f26]/95 text-cyan-100"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                {isSuccess ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400 shrink-0" />
                ) : isError ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-400 shrink-0" />
                ) : (
                  <Sparkles className="mt-0.5 h-5 w-5 text-cyan-400 shrink-0" />
                )}

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-white">
                      {toast.title}
                    </span>
                    <span className="text-[10px] opacity-70">
                      {toast.createdAt}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    {toast.message}
                  </p>
                  {toast.fileName && (
                    <code className="block truncate rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                      {toast.fileName}
                    </code>
                  )}

                  {/* Quick Action inside Toast */}
                  <div className="pt-1.5 flex items-center gap-2">
                    {isSuccess && toast.clipId && onQuickDownload && (
                      <button
                        type="button"
                        onClick={() => {
                          onQuickDownload(toast.clipId!);
                          onDismiss(toast.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-emerald-400 transition cursor-pointer"
                      >
                        <Download className="h-3 w-3" />
                        Unduh MP4 Sekarang
                      </button>
                    )}

                    {isError && toast.clipId && onQuickRetry && (
                      <button
                        type="button"
                        onClick={() => {
                          onQuickRetry(toast.clipId!);
                          onDismiss(toast.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold text-slate-950 hover:bg-amber-300 transition cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Coba Lagi (Retry)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Tutup notifikasi"
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
