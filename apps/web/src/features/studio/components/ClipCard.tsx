import { useState, useEffect, useRef } from "react";
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
import type { ClipItem } from "../types";

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
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Parse total duration in seconds from duration string (e.g. "30s" -> 30)
  const totalSeconds = parseInt(clip.duration.replace(/\D/g, ""), 10) || 30;

  // Determine active playing state
  const isPlaying =
    onTogglePlayInline !== undefined ? isPlayingInline : localPlaying;

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalSeconds) {
            return 0; // Loop playback
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, totalSeconds]);

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTogglePlayInline) {
      onTogglePlayInline(clip.id);
    } else {
      setLocalPlaying((prev) => !prev);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    if (onDownloadNotice) {
      onDownloadNotice(`Memproses unduhan ${clip.title}.mp4...`);
    }

    setTimeout(() => {
      setIsDownloading(false);
      setDownloadSuccess(true);
      if (onDownloadNotice) {
        onDownloadNotice(`Berhasil mengunduh klip "${clip.title}.mp4" 📥`);
      }

      // Trigger file download
      const blob = new Blob(
        [
          `Klip Viral Otomatis - ${clip.title}\nSkor Viral: ${clip.viralScore}\nDurasi: ${clip.duration}\nPreset: ${clip.preset}\nSorotan: ${clip.highlightMoment}`,
        ],
        { type: "video/mp4" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${clip.title.toLowerCase().replace(/\s+/g, "_")}_klip_viral.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setTimeout(() => setDownloadSuccess(false), 3000);
    }, 1200);
  };

  // Find active subtitle cue for current time
  const activeSubtitle = clip.subtitles
    ? [...clip.subtitles].reverse().find((cue) => currentTime >= cue.time)
    : null;

  const progressPercent = Math.min(100, Math.round((currentTime / totalSeconds) * 100));

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="bg-[#0e2125]/85 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-2.5 sm:p-3 flex flex-col gap-2.5 shadow-xl hover:border-[#2cd3c6]/40 transition-all duration-200 group text-slate-100">
      {/* 9:16 Video Player Container */}
      <div
        onClick={handleTogglePlay}
        className="relative w-full aspect-[9/16] max-h-[270px] lg:max-h-[295px] mx-auto rounded-xl overflow-hidden shadow-inner group-hover:scale-[1.01] transition-transform duration-200 bg-[#071316] flex items-center justify-center cursor-pointer select-none"
      >
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

        {/* Top Badges Overlay */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-20 pointer-events-none">
          {/* Viral Score Badge */}
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 backdrop-blur-xs text-amber-300 border border-amber-400/30 flex items-center gap-1 shadow-sm">
            <span>🔥</span>
            <span>{clip.viralScore}</span>
          </span>

          {/* Playing Indicator */}
          {isPlaying ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-[#20b2aa]/90 text-white flex items-center gap-1 shadow-[0_0_8px_rgba(32,178,170,0.6)] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              <span>Memutar Inline</span>
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-white/80 bg-black/50 backdrop-blur-xs">
              {clip.duration}
            </span>
          )}
        </div>

        {/* Dynamic Subtitle Overlay when Playing Inline */}
        {isPlaying && activeSubtitle && (
          <div className="absolute bottom-11 left-2 right-2 z-20 flex justify-center pointer-events-none">
            <span className="bg-black/75 backdrop-blur-xs text-amber-300 font-extrabold text-[11px] leading-tight px-2 py-1 rounded-md border border-amber-400/40 text-center shadow-lg animate-fadeIn">
              {activeSubtitle.text}
            </span>
          </div>
        )}

        {/* Hover / Inactive Play Button */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-colors flex items-center justify-center z-20">
            <div className="w-10 h-10 rounded-full bg-[#20b2aa]/90 hover:bg-[#2cd3c6] backdrop-blur-md flex items-center justify-center border border-white/40 text-white shadow-[0_0_15px_rgba(44,211,198,0.5)] group-hover:scale-110 transition-transform">
              <Play className="w-4 h-4 ml-0.5 fill-white" />
            </div>
          </div>
        )}

        {/* Inline Player Bottom Controls & Progress Bar */}
        {isPlaying && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 z-30 flex flex-col gap-1 pointer-events-auto"
          >
            {/* Progress Bar */}
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2cd3c6] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Time & Quick Controls */}
            <div className="flex items-center justify-between text-[10px] text-white/90 px-0.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="hover:text-[#2cd3c6] transition cursor-pointer"
                  title="Pause"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsMuted((prev) => !prev)}
                  className="hover:text-[#2cd3c6] transition cursor-pointer"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>

                <span className="font-mono text-[9px] text-[#93adb3]">
                  {formatTime(currentTime)} / {formatTime(totalSeconds)}
                </span>
              </div>

              {/* Expand to Modal */}
              <button
                type="button"
                onClick={() => onSelectClip(clip)}
                className="hover:text-[#2cd3c6] transition cursor-pointer p-0.5"
                title="Buka Modal Preview Penuh"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Pills Row */}
      <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium">
        <div className="flex-1 h-7 bg-[#14282e] border border-[#1f3e46] rounded-lg px-1.5 flex items-center justify-center text-[#8da5ab] whitespace-nowrap">
          <span>{clip.bottomScoreText}</span>
        </div>
        <div className="flex-1 h-7 bg-[#14282e] border border-[#1f3e46] rounded-lg px-1.5 flex items-center justify-center text-[#8da5ab] whitespace-nowrap">
          <span>{clip.bottomPresetText}</span>
        </div>
      </div>

      {/* Action Button: Single full-width button (⬇️ Unduh MP4) */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="w-full h-8 sm:h-9 rounded-xl bg-gradient-to-r from-[#1a858c] via-[#21a6a3] to-[#2cd3c6] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(44,211,198,0.25)] hover:shadow-[0_0_18px_rgba(44,211,198,0.45)] hover:brightness-110 active:scale-[0.98] transition-all select-none cursor-pointer"
      >
        {isDownloading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Mengunduh...</span>
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

