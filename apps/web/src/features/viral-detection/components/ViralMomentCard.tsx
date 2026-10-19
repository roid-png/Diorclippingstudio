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
  Check,
  Flame,
  Info,
  Crown,
  Star,
} from "lucide-react";
import type { ViralClipItem } from "../types";
import { getCategoryMeta, getViralScoreMeta } from "../types";

interface ViralMomentCardProps {
  clip: ViralClipItem;
  isPlayingInline?: boolean;
  onTogglePlayInline?: (clipId: string) => void;
  onToggleSelectClip: (clipId: string) => void;
  onInspectClip: (clip: ViralClipItem) => void;
}

function renderHighlightSubtitle(text: string) {
  if (!text.includes("<hl>")) {
    return <span>{text}</span>;
  }
  const parts = text.split(/(<hl>.*?<\/hl>)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("<hl>") && part.endsWith("</hl>")) {
          const content = part.replace(/<\/?hl>/g, "");
          return (
            <span
              key={i}
              className="bg-red-600 text-white font-black px-1.5 py-0.5 rounded mx-1 shadow-xs tracking-normal inline-block"
            >
              {content}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function ViralMomentCard({
  clip,
  isPlayingInline = false,
  onTogglePlayInline,
  onToggleSelectClip,
  onInspectClip,
}: ViralMomentCardProps) {
  const [localPlaying, setLocalPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const totalSeconds = parseInt(clip.duration.replace(/\D/g, ""), 10) || 45;
  const isPlaying =
    onTogglePlayInline !== undefined ? isPlayingInline : localPlaying;

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const catMeta = getCategoryMeta(clip.category);
  const scoreMeta = getViralScoreMeta(clip.viralScore);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalSeconds) return 0;
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

    setTimeout(() => {
      setIsDownloading(false);
      setDownloadSuccess(true);

      const blob = new Blob(
        [
          `Dior Clipping - Klip Viral Otomatis\nJudul: ${clip.title}\nRank: #${clip.rank} ${clip.rank === 1 ? "(REKOMENDASI UTAMA)" : ""}\nKategori: ${catMeta.label}\nSkor Viral: ${clip.viralScoreFormatted} (${scoreMeta.label})\nDurasi: ${clip.duration} [${clip.timeRange}]\nSorotan: ${clip.highlightMoment}\nAlasan Viral: ${clip.whyViral}`,
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
    <div
      className={`bg-[#0e2125]/85 backdrop-blur-md border rounded-2xl p-3 flex flex-col gap-2.5 shadow-xl transition-all duration-200 group text-slate-100 ${
        clip.isSelected
          ? clip.rank === 1
            ? "border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
            : "border-[#20b2aa]/80 shadow-[0_0_15px_rgba(32,178,170,0.2)]"
          : clip.rank === 1
          ? "border-amber-400/60 shadow-[0_0_18px_rgba(251,191,36,0.18)] hover:border-amber-400"
          : "border-[#1e3c43] hover:border-[#2cd3c6]/40"
      }`}
    >
      {/* Rekomendasi Utama Banner for Rank #1 */}
      {clip.rank === 1 && (
        <div className="bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-500/10 border border-amber-400/50 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px] font-bold text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.15)]">
          <div className="flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-bounce" />
            <span>👑 REKOMENDASI UTAMA AI</span>
          </div>
          <span className="text-[9px] font-black uppercase text-amber-200 bg-amber-500/30 px-1.5 py-0.5 rounded border border-amber-400/40">
            Top #1 Momen
          </span>
        </div>
      )}

      {/* Rekomendasi Unggulan Banner for Rank #2 & #3 */}
      {clip.rank > 1 && clip.rank <= 3 && (
        <div className="bg-gradient-to-r from-[#136f7c]/30 via-[#20b2aa]/20 to-transparent border border-[#2cd3c6]/40 rounded-xl px-2.5 py-1 flex items-center justify-between text-[11px] font-semibold text-[#2cd3c6]">
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-[#2cd3c6] fill-[#2cd3c6]" />
            <span>Top Rekomendasi #{clip.rank}</span>
          </div>
          <span className="text-[9px] font-semibold text-cyan-200 bg-[#081e22] px-1.5 py-0.5 rounded border border-[#2cd3c6]/30">
            Podium Viral
          </span>
        </div>
      )}

      {/* 9:16 Aspect Locked Video Container */}
      <div
        onClick={handleTogglePlay}
        className="relative w-full aspect-[9/16] max-h-[285px] mx-auto rounded-xl overflow-hidden shadow-inner group-hover:scale-[1.01] transition-transform duration-200 bg-[#071316] flex items-center justify-center cursor-pointer select-none"
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

        {/* Top Badges Overlay: Skor Viral + Label Kategori + Rank */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-20 pointer-events-none gap-1">
          {/* Viral Score Badge with Flame & Tier */}
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md flex items-center gap-1 border ${scoreMeta.badgeClass}`}
          >
            <Flame className={`w-3 h-3 ${scoreMeta.flameColor}`} />
            <span>{clip.viralScoreFormatted}</span>
            <span className="text-[9px] font-semibold opacity-90 hidden xs:inline">
              • {scoreMeta.shortLabel}
            </span>
          </span>

          {/* Label Kategori & Rank Badge with Crown for #1 */}
          <div className="flex items-center gap-1">
            <span
              className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-tight border backdrop-blur-md flex items-center gap-0.5 ${catMeta.badgeClass}`}
            >
              <span>{catMeta.icon}</span>
              <span>{catMeta.shortLabel}</span>
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[9px] border shadow-xs flex items-center gap-0.5 ${
                clip.rank === 1
                  ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-black border-yellow-200 font-black shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                  : clip.rank <= 3
                  ? "bg-[#2cd3c6] text-black border-cyan-200 font-bold"
                  : "bg-black/80 text-amber-300 border-amber-400/40 font-bold"
              }`}
            >
              {clip.rank === 1 && <Crown className="w-2.5 h-2.5 fill-black" />}
              <span>#{clip.rank}</span>
            </span>
          </div>
        </div>

        {/* Dynamic Subtitle Overlay when Playing Inline */}
        {isPlaying && activeSubtitle && (
          <div className="absolute bottom-10 left-2 right-2 z-20 flex flex-col items-center pointer-events-none animate-fadeIn">
            {activeSubtitle.speaker && (
              <span
                className={`mb-1 px-1.5 py-0.2 rounded text-[8px] font-black tracking-widest uppercase border ${
                  activeSubtitle.speaker === "HOST"
                    ? "bg-black/90 text-cyan-400 border-cyan-500/50"
                    : "bg-black/90 text-red-500 border-red-500/50"
                }`}
              >
                {activeSubtitle.speaker}
              </span>
            )}
            <div className="bg-black/85 backdrop-blur-md border border-white/10 rounded-xl px-2.5 py-1.5 text-center shadow-2xl max-w-[95%]">
              <p className="text-white font-bold text-[11px] leading-snug tracking-normal font-sans">
                {renderHighlightSubtitle(activeSubtitle.text)}
              </p>
            </div>
          </div>
        )}

        {/* Play Icon when Inactive */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-colors flex items-center justify-center z-20">
            <div className="w-10 h-10 rounded-full bg-[#20b2aa]/90 hover:bg-[#2cd3c6] backdrop-blur-md flex items-center justify-center border border-white/40 text-white shadow-[0_0_15px_rgba(44,211,198,0.5)] group-hover:scale-110 transition-transform">
              <Play className="w-4 h-4 ml-0.5 fill-white" />
            </div>
          </div>
        )}

        {/* Controls when Playing */}
        {isPlaying && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 z-30 flex flex-col gap-1 pointer-events-auto"
          >
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2cd3c6] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

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

              <button
                type="button"
                onClick={() => onInspectClip(clip)}
                className="hover:text-[#2cd3c6] transition cursor-pointer p-0.5"
                title="Buka Detail Momen Viral"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Title & Timestamp Row */}
      <div className="flex items-start justify-between gap-1.5 pt-0.5">
        <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#2cd3c6] transition-colors">
          {clip.title}
        </h4>
        <span className="text-[10px] text-[#7d9399] font-mono shrink-0">
          {clip.timeRange}
        </span>
      </div>

      {/* Label Kategori & Skor Viral Tier Info Row */}
      <div className="flex items-center justify-between gap-1 text-[10px]">
        <span
          className={`px-2 py-0.5 rounded-lg border font-semibold flex items-center gap-1 shrink-0 ${catMeta.badgeClass}`}
        >
          <span>{catMeta.icon}</span>
          <span className="truncate">{catMeta.label}</span>
        </span>
        <span className="text-[9px] font-mono text-[#7d9399] shrink-0 bg-[#08181b] px-1.5 py-0.5 rounded border border-[#1b373e]">
          {scoreMeta.reachPrediction}
        </span>
      </div>

      {/* Sorotan Momen Penting */}
      <div className="bg-[#13282f]/80 border border-[#1d3d46] rounded-xl p-2 flex flex-col gap-1 text-[11px]">
        <div className="flex items-center gap-1 text-[#2cd3c6] font-semibold text-[10px]">
          <Sparkles className="w-3 h-3" />
          <span>Sorotan Momen:</span>
        </div>
        <p className="text-[#a5bcc2] line-clamp-2 leading-tight italic">
          "{clip.highlightMoment}"
        </p>

        {/* Why Viral insight */}
        <div className="mt-1 pt-1 border-t border-[#1b373e] flex items-center justify-between text-[10px] text-[#7d979e]">
          <span className="truncate">Hook: {clip.metrics.hookRetention}% Retensi</span>
          <button
            type="button"
            onClick={() => onInspectClip(clip)}
            className="text-[#2cd3c6] hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
          >
            <Info className="w-3 h-3" />
            <span>Kenapa Viral?</span>
          </button>
        </div>
      </div>

      {/* Selection Checkbox Toggle */}
      <button
        type="button"
        onClick={() => onToggleSelectClip(clip.id)}
        className={`w-full h-7 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition select-none cursor-pointer ${
          clip.isSelected
            ? "bg-[#154e56] border-[#2cd3c6]/60 text-white"
            : "bg-[#14282e] border-[#1f3e46] text-[#7d979e] hover:text-white"
        }`}
      >
        <span
          className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
            clip.isSelected
              ? "bg-[#2cd3c6] border-[#2cd3c6] text-black"
              : "border-[#40626b]"
          }`}
        >
          {clip.isSelected && <Check className="w-3 h-3 stroke-[3]" />}
        </span>
        <span>{clip.isSelected ? "Klip Dipilih" : "Pilih Klip"}</span>
      </button>

      {/* Action Button: Single full-width button (⬇️ Unduh MP4) */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="w-full h-8 sm:h-8.5 rounded-xl bg-gradient-to-r from-[#1a858c] via-[#21a6a3] to-[#2cd3c6] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(44,211,198,0.25)] hover:shadow-[0_0_18px_rgba(44,211,198,0.45)] hover:brightness-110 active:scale-[0.98] transition-all select-none cursor-pointer"
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
