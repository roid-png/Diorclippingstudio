import { useState, useRef } from "react";
import {
  Download,
  Loader2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Sparkles,
} from "lucide-react";
import { API_URL } from "@/lib/env";
import type { ClipItem } from "../types";

function resolveMediaUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("blob:")) {
    return rawUrl;
  }
  const cleanPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  return `${API_URL}${cleanPath}`;
}

interface ClipCardProps {
  clip: ClipItem;
  isPlayingInline?: boolean;
  onTogglePlayInline?: (clipId: string) => void;
  onSelectClip: (clip: ClipItem) => void;
  onDownloadNotice?: (msg: string) => void;
}

export function ClipCard({
  clip,
  isPlayingInline = false,
  onTogglePlayInline,
  onSelectClip,
  onDownloadNotice,
}: ClipCardProps) {
  const [localPlaying, setLocalPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isPlaying =
    onTogglePlayInline !== undefined ? isPlayingInline : localPlaying;

  const rawScore = parseInt(clip.viralScore.replace(/\D/g, ""), 10) || 95;
  const scoreBadgeText = `🔥 Skor Viral: ${rawScore}/100`;

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTogglePlayInline) {
      onTogglePlayInline(clip.id);
    } else {
      setLocalPlaying((prev) => !prev);
    }

    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    if (onDownloadNotice) {
      onDownloadNotice(`Memproses unduhan "${clip.title}"...`);
    }

    // Direct download link from backend if available
    const rawTarget =
      clip.downloadUrl ||
      clip.videoUrl ||
      `/api/download/dior_${clip.id}.mp4?download=true`;
    const downloadTarget = resolveMediaUrl(rawTarget) || rawTarget;

    const a = document.createElement("a");
    a.href = downloadTarget;
    a.download = `${clip.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.mp4`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      setIsDownloading(false);
      setDownloadSuccess(true);
      if (onDownloadNotice) {
        onDownloadNotice(`Berhasil mengunduh klip "${clip.title}" 📥`);
      }
      setTimeout(() => setDownloadSuccess(false), 3000);
    }, 1000);
  };

  const resolvedVideoSrc = resolveMediaUrl(clip.videoUrl || clip.videoSrc);

  return (
    <div className="bg-[#0e2125]/85 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-3 flex flex-col gap-2.5 shadow-xl hover:border-[#2cd3c6]/40 transition-all duration-200 group text-slate-100">
      {/* 9:16 Video Player Container */}
      <div
        onClick={handleTogglePlay}
        className="relative w-full aspect-[9/16] rounded-xl overflow-hidden shadow-inner group-hover:scale-[1.01] transition-transform duration-200 bg-[#071316] flex items-center justify-center cursor-pointer select-none"
      >
        {/* Real HTML5 Video if videoUrl is available */}
        {resolvedVideoSrc ? (
          <video
            ref={videoRef}
            src={resolvedVideoSrc}
            poster={clip.imageSrc}
            muted={isMuted}
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            {/* Ambient blurred backdrop */}
            <img
              src={clip.imageSrc}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-lg opacity-40 scale-125 pointer-events-none"
            />
            {/* Video Frame */}
            <img
              src={clip.imageSrc}
              alt={clip.title}
              className={`relative z-10 w-full h-full object-contain pointer-events-none transition-transform duration-700 ${
                isPlaying ? "scale-105" : "scale-100"
              }`}
            />
          </>
        )}

        {/* Top Badges Overlay */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-20 pointer-events-none">
          {/* Viral Score Badge: 🔥 Skor Viral: XX/100 */}
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/75 backdrop-blur-md text-amber-300 border border-amber-400/40 flex items-center gap-1 shadow-sm">
            <span>{scoreBadgeText}</span>
          </span>

          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold text-white/90 bg-black/60 backdrop-blur-xs">
            {clip.duration}
          </span>
        </div>

        {/* Subtitle Preview Overlay */}
        {clip.subtitles && clip.subtitles.length > 0 && (
          <div className="absolute bottom-8 left-2 right-2 z-20 flex flex-col items-center pointer-events-none">
            <div className="bg-black/85 backdrop-blur-md border border-white/10 rounded-xl px-2.5 py-1 text-center shadow-2xl max-w-[95%]">
              <p className="text-white font-bold text-[11px] leading-snug tracking-normal font-sans">
                {clip.subtitles[0]?.text || clip.title}
              </p>
            </div>
          </div>
        )}

        {/* Play / Pause Overlay Icon */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-colors flex items-center justify-center z-20">
            <div className="w-11 h-11 rounded-full bg-[#20b2aa]/90 hover:bg-[#2cd3c6] backdrop-blur-md flex items-center justify-center border border-white/40 text-white shadow-[0_0_18px_rgba(44,211,198,0.5)] group-hover:scale-110 transition-transform">
              <Play className="w-4 h-4 ml-0.5 fill-white" />
            </div>
          </div>
        )}

        {/* Playing Overlay Quick Action */}
        {isPlaying && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 z-30 flex items-center gap-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-lg text-white/80"
          >
            <button
              type="button"
              onClick={() => setIsMuted((prev) => !prev)}
              className="p-1 hover:text-[#2cd3c6] transition"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={() => onSelectClip(clip)}
              className="p-1 hover:text-[#2cd3c6] transition"
              title="Perbesar Preview"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Title */}
      <h4 className="text-xs font-semibold text-gray-200 line-clamp-1 group-hover:text-white transition">
        {clip.title}
      </h4>

      {/* Info Pills Row */}
      <div className="flex items-center gap-1.5 text-[10px] font-medium">
        <div className="flex-1 h-6 bg-[#14282e] border border-[#1f3e46] rounded-md px-1.5 flex items-center justify-center text-[#8da5ab] truncate">
          <span>{clip.preset || "Preset 9:16"}</span>
        </div>
        <div className="flex-1 h-6 bg-[#14282e] border border-[#1f3e46] rounded-md px-1.5 flex items-center justify-center text-[#8da5ab] truncate">
          <span>{clip.bottomScoreText || "Hook 3s Aktif"}</span>
        </div>
      </div>

      {/* ONLY ONE ACTION BUTTON: ⬇️ Unduh MP4 */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="w-full h-9 rounded-xl bg-gradient-to-r from-[#1a858c] via-[#21a6a3] to-[#2cd3c6] text-white text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(44,211,198,0.25)] hover:shadow-[0_0_20px_rgba(44,211,198,0.5)] hover:brightness-110 active:scale-[0.98] transition-all select-none cursor-pointer"
      >
        {isDownloading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Mengunduh MP4...</span>
          </>
        ) : downloadSuccess ? (
          <>
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            <span>Tersimpan! 📥</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            <span>⬇️ Unduh MP4</span>
          </>
        )}
      </button>
    </div>
  );
}
