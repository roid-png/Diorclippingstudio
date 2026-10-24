import React, { useEffect } from "react";
import { X, Download, Sparkles, BookmarkPlus } from "lucide-react";
import type { ClipItem } from "../types";

interface VideoModalProps {
  clip: ClipItem | null;
  onClose: () => void;
  onDownloadNotice?: (msg: string) => void;
  onSaveToPreset?: (clip: ClipItem) => void;
}

function resolveMediaUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }
  const apiBase = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000";
  const cleanPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  return `${apiBase}${cleanPath}`;
}

function cleanTitle(raw?: string): string {
  if (!raw) return "";
  return raw
    .replace(/Â/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\uFFFD/g, "")
    .replace(/^\(\d+\)\s*/, "")
    .replace(/^\[\d+\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function VideoModal({ clip, onClose, onDownloadNotice, onSaveToPreset }: VideoModalProps) {
  const modalVideoRef = React.useRef<HTMLVideoElement>(null);

  const handleSafeClose = () => {
    if (modalVideoRef.current) {
      try {
        modalVideoRef.current.pause();
        modalVideoRef.current.currentTime = 0;
      } catch {}
    }
    // Pause any background videos as well
    document.querySelectorAll("video").forEach((vid) => {
      try {
        vid.pause();
        vid.currentTime = 0;
      } catch {}
    });
    onClose();
  };

  // Listen for Escape key to close modal safely
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSafeClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (modalVideoRef.current) {
        try {
          modalVideoRef.current.pause();
          modalVideoRef.current.currentTime = 0;
        } catch {}
      }
    };
  }, []);

  if (!clip) return null;

  const resolvedVideoUrl = resolveMediaUrl(clip.videoUrl || clip.videoSrc);
  const displayTitle = cleanTitle(clip.title);

  const handleDownload = () => {
    if (onDownloadNotice) {
      onDownloadNotice(`Mengunduh ${displayTitle}.mp4...`);
    }
    const rawTarget =
      clip.downloadUrl ||
      clip.videoUrl ||
      `/api/video/dior_${clip.id}.mp4?download=true`;
    const targetUrl = resolveMediaUrl(rawTarget) || rawTarget;

    const a = document.createElement("a");
    a.href = targetUrl;
    a.download = `${displayTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.mp4`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      onClick={handleSafeClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/92 animate-in fade-in duration-200 overflow-y-auto"
    >
      {/* Floating Close Button Top Right (Always Accessible) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleSafeClose();
        }}
        className="fixed top-4 right-4 z-[60] w-10 h-10 rounded-full bg-[#14282e] hover:bg-[#1f424b] border border-[#2cd3c6]/40 text-gray-200 hover:text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 cursor-pointer"
        title="Tutup Preview (Esc)"
      >
        <X className="w-5 h-5 text-gray-200" />
      </button>

      {/* Modal Dialog Container - max-h-[92vh] flex flex-col overflow-hidden */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[340px] sm:max-w-[400px] max-h-[92vh] bg-[#0e2125] border border-[#1e3c43] rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-col overflow-hidden my-auto text-slate-100 gap-2.5"
      >
        {/* Sticky Header with Title, Preset & In-Card Close Button */}
        <div className="flex items-center justify-between pb-2 border-b border-[#1b373e] shrink-0">
          <div className="flex items-center gap-2 truncate pr-2">
            <span className="text-sm font-bold text-white truncate" title={displayTitle}>
              {displayTitle}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#136f7c] text-cyan-200 font-medium shrink-0">
              {clip.preset}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSafeClose}
            className="w-7 h-7 rounded-full bg-[#14282e] hover:bg-[#1a343c] text-gray-300 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
            title="Tutup (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 9:16 Video Player Container - max-h-[62vh] aspect-[9/16] bg-black object-contain */}
        <div className="relative w-full max-h-[62vh] aspect-[9/16] bg-black rounded-xl overflow-hidden flex items-center justify-center mx-auto shrink-0 border border-[#1f3e46]">
          {resolvedVideoUrl ? (
            <video
              ref={modalVideoRef}
              src={resolvedVideoUrl}
              controls
              playsInline
              preload="auto"
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : (
            <img
              src={clip.imageSrc}
              alt={displayTitle}
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Highlight Moment Description */}
        {clip.highlightMoment && (
          <div className="p-2 rounded-xl bg-[#14282e]/80 border border-[#1f3e46] text-xs shrink-0">
            <p className="text-[11px] text-[#2cd3c6] font-semibold flex items-center gap-1 mb-0.5">
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>Sorotan Momen Viral:</span>
            </p>
            <p className="text-gray-300 text-[11px] leading-relaxed line-clamp-2">
              {clip.highlightMoment}
            </p>
          </div>
        )}

        {/* Modal Action Bar */}
        <div className="pt-1 shrink-0 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 h-9 rounded-xl bg-gradient-to-r from-[#17858c] via-[#20a3a7] to-[#2cd3c6] text-white text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(44,211,198,0.3)] hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>⬇️ Unduh MP4</span>
            </button>
            {onSaveToPreset && (
              <button
                type="button"
                onClick={() => onSaveToPreset(clip)}
                className="h-9 px-3.5 rounded-xl bg-[#14282e] hover:bg-[#1f3d46] border border-[#23454d] hover:border-[#2cd3c6]/60 text-gray-200 hover:text-[#2cd3c6] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
                title="Bookmark / Simpan Gaya ke Preset"
              >
                <BookmarkPlus className="w-4 h-4 text-[#2cd3c6]" />
                <span className="hidden sm:inline">Simpan ke Preset</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSafeClose}
            className="w-full h-8 rounded-xl bg-[#14282e] hover:bg-[#1b363e] border border-[#23454d] text-gray-300 hover:text-white text-xs font-medium transition cursor-pointer"
          >
            Kembali ke Studio
          </button>
        </div>
      </div>
    </div>
  );
}
