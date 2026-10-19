import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  Download,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";

export interface RenderNotificationEntry {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
  clipId?: string;
  fileName?: string;
  createdAt: string;
  isRead: boolean;
}

interface RenderNotificationDrawerPanelProps {
  notifications: RenderNotificationEntry[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onQuickDownload?: (clipId: string) => void;
  onQuickRetry?: (clipId: string) => void;
}

export function RenderNotificationDrawerPanel({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onQuickDownload,
  onQuickRetry,
}: RenderNotificationDrawerPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "success" | "error">(
    "all"
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "success") return n.type === "success";
    if (filter === "error") return n.type === "error";
    return true;
  });

  return (
    <div className="rounded-2xl border border-[#1b3942] bg-[#0a181c]/95 p-4 shadow-lg">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/30 bg-red-950/30 text-red-400">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-white">
                Pusat Notifikasi Render & Unduhan
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  unreadCount > 0
                    ? "bg-red-500/20 border border-red-500/40 text-red-300"
                    : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                }`}
              >
                {unreadCount > 0
                  ? `${unreadCount} Belum Dibaca`
                  : "Semua Sudah Dibaca"}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Riwayat status klip selesai dirender, kendala GPU, dan aktivitas
              unduhan MP4
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onMarkAllAsRead}
            disabled={unreadCount === 0}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              unreadCount > 0
                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 cursor-pointer"
                : "border-[#1c3840] bg-[#0e2026] text-slate-500 opacity-60 cursor-not-allowed"
            }`}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Tandai Semua Dibaca ({unreadCount})
          </button>

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#22424d] bg-[#10242b] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5 text-slate-400" />
              Bersihkan
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#254955] bg-[#132a32] px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-[#193742] transition cursor-pointer"
          >
            {isOpen
              ? "Sembunyikan Panel"
              : `Buka Daftar (${notifications.length})`}
          </button>
        </div>
      </div>

      {/* Expandable Notification List */}
      {isOpen && (
        <div className="mt-4 border-t border-[#163139] pt-3.5 space-y-3">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "all", label: `Semua (${notifications.length})` },
                  { id: "unread", label: `Belum Dibaca (${unreadCount})` },
                  {
                    id: "success",
                    label: `Selesai (${
                      notifications.filter((n) => n.type === "success").length
                    })`,
                  },
                  {
                    id: "error",
                    label: `Gagal (${
                      notifications.filter((n) => n.type === "error").length
                    })`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                    filter === tab.id
                      ? "bg-red-600 text-white"
                      : "bg-[#10242b] text-slate-300 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredNotifications.length === 0 ? (
            <div className="rounded-xl border border-[#19353e] bg-[#0d1f24] p-6 text-center text-xs text-slate-400">
              Tidak ada notifikasi pada kategori ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {filteredNotifications.map((item) => {
                const isSuccess = item.type === "success";
                const isError = item.type === "error";

                return (
                  <div
                    key={item.id}
                    className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition ${
                      !item.isRead
                        ? isError
                          ? "border-rose-500/50 bg-rose-950/25"
                          : "border-emerald-500/40 bg-[#0e262c]"
                        : "border-[#173139] bg-[#0b1a1f]/70 opacity-75"
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {isSuccess ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400 shrink-0" />
                      ) : isError ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-400 shrink-0" />
                      ) : (
                        <Sparkles className="mt-0.5 h-4 w-4 text-cyan-400 shrink-0" />
                      )}

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!item.isRead && (
                            <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-white truncate">
                            {item.title}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            • {item.createdAt}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {item.message}
                        </p>
                        {item.fileName && (
                          <code className="block truncate rounded bg-black/30 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                            {item.fileName}
                          </code>
                        )}

                        <div className="pt-1 flex flex-wrap items-center gap-2">
                          {!item.isRead && (
                            <button
                              type="button"
                              onClick={() => onMarkAsRead(item.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-900/50 transition cursor-pointer"
                            >
                              <Check className="h-3 w-3" />
                              Tandai Dibaca
                            </button>
                          )}

                          {isSuccess && item.clipId && onQuickDownload && (
                            <button
                              type="button"
                              onClick={() => {
                                onQuickDownload(item.clipId!);
                                onMarkAsRead(item.id);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/80 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-500 transition cursor-pointer"
                            >
                              <Download className="h-3 w-3" />
                              Unduh MP4
                            </button>
                          )}

                          {isError && item.clipId && onQuickRetry && (
                            <button
                              type="button"
                              onClick={() => {
                                onQuickRetry(item.clipId!);
                                onMarkAsRead(item.id);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-slate-950 hover:bg-amber-400 transition cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Coba Lagi
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

