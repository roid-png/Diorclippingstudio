import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  Download,
  Loader2,
  Sparkles,
  Flame,
  Film,
  Wand2,
  Type,
  ZoomIn,
} from "lucide-react";
import type {
  AutoEditClipItem,
  EditingStylePreset,
  MotionGraphicPreset,
  SubtitleStylePreset,
} from "../types";

interface LivePreviewCanvasProps {
  clip: AutoEditClipItem;
  editingPreset: EditingStylePreset;
  motionPreset: MotionGraphicPreset;
  subtitlePreset: SubtitleStylePreset;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  onApplyToAllClips: () => void;
  appliedSuccess: boolean;
}

function renderStyledSubtitleText(
  text: string,
  highlightStyle: SubtitleStylePreset["highlightStyle"]
) {
  if (!text.includes("<hl>")) {
    return <span>{text}</span>;
  }

  const parts = text.split(/(<hl>.*?<\/hl>)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("<hl>") && part.endsWith("</hl>")) {
          const clean = part.replace(/<\/?hl>/g, "");
          if (highlightStyle === "red-pill") {
            return (
              <span
                key={idx}
                className="bg-red-600 text-white font-black px-1.5 py-0.5 rounded mx-1 shadow-sm inline-block tracking-normal"
              >
                {clean}
              </span>
            );
          }
          if (highlightStyle === "yellow-glow") {
            return (
              <span
                key={idx}
                className="text-yellow-300 font-black uppercase mx-1 drop-shadow-[0_0_10px_rgba(253,224,71,0.9)] underline decoration-yellow-400 decoration-2"
              >
                {clean}
              </span>
            );
          }
          if (highlightStyle === "karaoke") {
            return (
              <span
                key={idx}
                className="bg-[#2cd3c6] text-black font-black px-1.5 py-0.5 rounded-md mx-1 scale-105 inline-block shadow-[0_0_10px_rgba(44,211,198,0.7)]"
              >
                {clean}
              </span>
            );
          }
          // white-shadow (Netflix style)
          return (
            <span
              key={idx}
              className="text-amber-300 font-extrabold mx-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
            >
              {clean}
            </span>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}

export function LivePreviewCanvas({
  clip,
  editingPreset,
  motionPreset,
  subtitlePreset,
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  onApplyToAllClips,
  appliedSuccess,
}: LivePreviewCanvasProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const totalSeconds = clip.durationSeconds || 45;

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalSeconds) return 0;
          return prev + 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, totalSeconds, setCurrentTime]);

  const activeSubtitle =
    clip.subtitles.find(
      (s) => currentTime >= s.startTime && currentTime <= s.endTime
    ) ||
    [...clip.subtitles].reverse().find((s) => currentTime >= s.startTime) ||
    clip.subtitles[0];

  const progressPercent = Math.min(
    100,
    Math.round((currentTime / totalSeconds) * 100)
  );

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleDownloadPreview = () => {
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
      setDownloadDone(true);

      const content = [
        `Dior Clipping - Hasil Edit Otomatis`,
        `Judul Klip: ${clip.title} (${clip.duration})`,
        `1. Gaya Editing: ${editingPreset.name} [Layout: ${editingPreset.layout}]`,
        `2. Motion Graphic: ${motionPreset.name}`,
        `3. Gaya Subtitle: ${subtitlePreset.name} [Aktif: ${clip.config.subtitleEnabled ? "Ya" : "Tidak"}]`,
        `Transisi: ${clip.config.transitionType} | Color Grade: ${clip.config.colorGrade}`,
      ].join("\n");

      const blob = new Blob([content], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${clip.title.toLowerCase().replace(/\s+/g, "_")}_edited.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setTimeout(() => setDownloadDone(false), 3000);
    }, 1100);
  };

  // Compute color filter based on colorGrade
  const colorFilterClass =
    clip.config.colorGrade === "netflix-warm"
      ? "contrast-115 saturate-110 sepia-[0.08]"
      : clip.config.colorGrade === "crisp-contrast"
      ? "contrast-125 brightness-105 saturate-120"
      : clip.config.colorGrade === "dark-teal-moody"
      ? "contrast-110 brightness-95"
      : "";

  // Compute subtitle position class
  const subtitlePosClass =
    clip.config.subtitlePosition === "top"
      ? "top-16"
      : clip.config.subtitlePosition === "center"
      ? "top-1/2 -translate-y-1/2"
      : "bottom-14";

  // Compute subtitle font size class
  const subtitleSizeClass =
    clip.config.subtitleSize === "sm"
      ? "text-[11px]"
      : clip.config.subtitleSize === "lg"
      ? "text-sm sm:text-base"
      : "text-xs sm:text-[13px]";

  return (
    <div className="bg-[#0e2125]/90 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-4 flex flex-col gap-3.5 shadow-2xl">
      {/* Header Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#2cd3c6] animate-pulse" />
          <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
            Live Canvas 9:16 (Pratinjau Real-time)
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
          <Flame className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span>Skor {clip.viralScore}</span>
        </span>
      </div>

      {/* Active 3-Pillar Badges Bar */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="px-2 py-0.5 rounded-md bg-[#132c33] border border-[#2cd3c6]/30 text-[#2cd3c6] font-semibold flex items-center gap-1">
          <Film className="w-3 h-3" />
          <span>{editingPreset.name}</span>
        </span>
        <span className="px-2 py-0.5 rounded-md bg-purple-950/50 border border-purple-400/30 text-purple-300 font-semibold flex items-center gap-1">
          <Wand2 className="w-3 h-3" />
          <span>{motionPreset.name}</span>
        </span>
        <span className="px-2 py-0.5 rounded-md bg-rose-950/50 border border-rose-400/30 text-rose-300 font-semibold flex items-center gap-1">
          <Type className="w-3 h-3" />
          <span>{clip.config.subtitleEnabled ? subtitlePreset.name : "Subtitle OFF"}</span>
        </span>
      </div>

      {/* 9:16 Locked Vertical Video Player Canvas */}
      <div
        onClick={() => setIsPlaying((p) => !p)}
        className={`relative w-full max-w-[310px] aspect-[9/16] mx-auto rounded-2xl overflow-hidden bg-[#050d0f] border border-[#254b54] shadow-[0_0_30px_rgba(0,0,0,0.7)] flex items-center justify-center cursor-pointer select-none group ${colorFilterClass}`}
      >
        {/* 1. GAYA EDITING LAYOUT RENDERER */}
        {editingPreset.layout === "center-ambient" && (
          <>
            {/* Ambient Blurred Backdrop */}
            <img
              src={clip.imageSrc}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-xl opacity-45 scale-125 pointer-events-none"
            />
            {/* Cinematic Top & Bottom Vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80 pointer-events-none z-10" />
            {/* Main Frame */}
            <img
              src={clip.imageSrc}
              alt={clip.title}
              className={`relative z-10 w-full h-full object-contain pointer-events-none transition-transform duration-700 ${
                isPlaying && clip.config.autoZoomEnabled ? "scale-[1.06]" : "scale-100"
              }`}
            />
          </>
        )}

        {editingPreset.layout === "full-crop" && (
          <>
            <img
              src={clip.imageSrc}
              alt={clip.title}
              className={`w-full h-full object-cover pointer-events-none transition-transform duration-700 ${
                isPlaying && clip.config.autoZoomEnabled ? "scale-110" : "scale-105"
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none z-10" />
          </>
        )}

        {editingPreset.layout === "split-screen" && (
          <div className="w-full h-full flex flex-col z-10">
            <div className="relative h-1/2 w-full overflow-hidden border-b border-[#2cd3c6]/40">
              <img
                src={clip.imageSrc}
                alt={clip.title}
                className="w-full h-full object-cover object-top"
              />
              <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-black bg-red-600 text-white uppercase">
                CAM 1 • NARASUMBER
              </span>
            </div>
            <div className="relative h-1/2 w-full overflow-hidden bg-[#07161a]">
              <img
                src={clip.imageSrc}
                alt=""
                className="w-full h-full object-cover object-bottom scale-110 brightness-90"
              />
              <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-black bg-cyan-600 text-white uppercase">
                CAM 2 • REACTION / DATA
              </span>
            </div>
          </div>
        )}

        {editingPreset.layout === "talking-head" && (
          <>
            <img
              src={clip.imageSrc}
              alt={clip.title}
              className="w-full h-full object-cover scale-125 pointer-events-none"
            />
            <div className="absolute inset-0 ring-inset ring-8 ring-black/50 pointer-events-none z-10" />
          </>
        )}

        {/* 2. MOTION GRAPHIC OVERLAY RENDERER */}
        {clip.config.infographicEnabled &&
          motionPreset.type === "infographic-bars" && (
            <div className="absolute top-2.5 inset-x-2.5 z-20 bg-black/85 backdrop-blur-md border border-white/15 rounded-xl p-2.5 shadow-xl pointer-events-none animate-fadeIn">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black tracking-wider text-white uppercase">
                  {clip.infographicData.heading}
                </span>
                <span className="text-[8px] font-mono text-[#2cd3c6] bg-[#133238] px-1.5 py-0.2 rounded">
                  LIVE DATA
                </span>
              </div>
              <p className="text-[8px] text-gray-300 mb-2">
                {clip.infographicData.subHeading}
              </p>
              <div className="flex flex-col gap-1.5">
                {clip.infographicData.bars.map((bar, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-[8px] font-bold">
                      <span className="text-gray-200 truncate pr-1">{bar.label}</span>
                      <span
                        className={
                          bar.color === "red"
                            ? "text-red-400"
                            : bar.color === "emerald"
                            ? "text-emerald-400"
                            : bar.color === "amber"
                            ? "text-amber-300"
                            : "text-cyan-300"
                        }
                      >
                        {bar.statusText}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          bar.color === "red"
                            ? "bg-gradient-to-r from-red-600 to-rose-400"
                            : bar.color === "emerald"
                            ? "bg-gradient-to-r from-emerald-500 to-teal-300"
                            : bar.color === "amber"
                            ? "bg-gradient-to-r from-amber-500 to-yellow-300"
                            : "bg-gradient-to-r from-cyan-500 to-[#2cd3c6]"
                        }`}
                        style={{ width: `${bar.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {motionPreset.type === "stat-counter" && (
          <div className="absolute top-3 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none">
            <div className="bg-black/80 backdrop-blur-md border-l-4 border-red-500 rounded-r-lg px-2.5 py-1 shadow-lg">
              <div className="text-[8px] text-red-400 font-black tracking-widest uppercase">
                PODCAST HIGHLIGHT
              </div>
              <div className="text-[10px] font-bold text-white line-clamp-1">
                {clip.title}
              </div>
            </div>
            <div className="bg-[#13363e]/90 border border-[#2cd3c6]/50 rounded-lg px-2 py-1 text-center shadow-lg">
              <div className="text-[10px] font-black text-[#2cd3c6]">
                {clip.viralScore}
              </div>
              <div className="text-[7px] text-gray-300 uppercase">Viral Score</div>
            </div>
          </div>
        )}

        {motionPreset.type === "progress-zoom" && (
          <div className="absolute top-3 right-3 z-20 pointer-events-none">
            <span className="px-2 py-0.5 rounded-full bg-[#20b2aa]/80 text-white text-[9px] font-bold flex items-center gap-1 border border-white/30 shadow-md">
              <ZoomIn className="w-3 h-3" />
              <span>Dynamic Zoom 1.15x</span>
            </span>
          </div>
        )}

        {/* 3. SUBTITLE OTOMATIS OVERLAY RENDERER */}
        {clip.config.subtitleEnabled && activeSubtitle && (
          <div
            className={`absolute inset-x-2.5 ${subtitlePosClass} z-20 flex flex-col items-center pointer-events-none transition-all duration-200`}
          >
            {subtitlePreset.speakerBadge && activeSubtitle.speaker && (
              <span
                className={`mb-1 px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase border shadow-md ${
                  activeSubtitle.speaker === "HOST"
                    ? "bg-black/90 text-cyan-400 border-cyan-500/50"
                    : "bg-black/90 text-red-400 border-red-500/50"
                }`}
              >
                {activeSubtitle.speaker}
              </span>
            )}

            <div
              className={`px-3 py-1.5 rounded-xl text-center max-w-[96%] transition-all ${
                subtitlePreset.id === "netflix-minimal"
                  ? "bg-transparent"
                  : "bg-black/85 backdrop-blur-md border border-white/15 shadow-2xl"
              }`}
              style={{ fontFamily: subtitlePreset.fontFamily }}
            >
              <p
                className={`font-extrabold leading-snug tracking-tight ${subtitleSizeClass} ${
                  subtitlePreset.highlightStyle === "yellow-glow"
                    ? "text-white uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
                    : "text-white"
                }`}
              >
                {renderStyledSubtitleText(
                  activeSubtitle.text,
                  subtitlePreset.highlightStyle
                )}
              </p>
            </div>
          </div>
        )}

        {/* Bottom Neon Progress Bar (if enabled) */}
        {clip.config.progressBarEnabled && (
          <div className="absolute bottom-10 inset-x-3 h-1 bg-white/20 rounded-full overflow-hidden z-20 pointer-events-none">
            <div
              className="h-full bg-gradient-to-r from-[#20b2aa] via-[#2cd3c6] to-amber-300 transition-all duration-300 shadow-[0_0_8px_#2cd3c6]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Center Play Overlay when Paused */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition flex items-center justify-center z-20">
            <div className="w-12 h-12 rounded-full bg-[#20b2aa]/90 hover:bg-[#2cd3c6] flex items-center justify-center text-white border border-white/40 shadow-[0_0_20px_rgba(44,211,198,0.6)] group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5 ml-0.5 fill-white" />
            </div>
          </div>
        )}

        {/* Player Bottom Transport Bar */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-3 py-2 z-30 flex items-center justify-between text-[11px] text-white"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="hover:text-[#2cd3c6] transition cursor-pointer"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setCurrentTime(0)}
              className="hover:text-[#2cd3c6] transition cursor-pointer"
              title="Ulangi dari 0:00"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className="hover:text-[#2cd3c6] transition cursor-pointer"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-gray-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#2cd3c6]" />
              )}
            </button>
          </div>

          <span className="font-mono text-[10px] text-[#93adb3]">
            {formatTime(currentTime)} / {formatTime(totalSeconds)}
          </span>
        </div>
      </div>

      {/* Interactive Timeline Scrubber */}
      <div className="px-1">
        <div className="flex items-center justify-between text-[10px] text-[#8ca4aa] mb-1">
          <span>Geser Timeline Pratinjau:</span>
          <span className="font-mono text-[#2cd3c6]">
            Detik ke-{currentTime}s ({clip.timeRange})
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={totalSeconds}
          value={currentTime}
          onChange={(e) => setCurrentTime(Number(e.target.value))}
          className="w-full accent-[#2cd3c6] h-1.5 bg-[#14282e] rounded-lg cursor-pointer"
        />
      </div>

      {/* Action Buttons: Apply to All & Single Full-Width Download MP4 */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          onClick={onApplyToAllClips}
          className="w-full h-8 rounded-xl bg-[#142d34] hover:bg-[#193b44] border border-[#2cd3c6]/40 text-[#2cd3c6] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            {appliedSuccess
              ? "Berhasil Diterapkan ke Semua Klip! ✅"
              : "Terapkan Kombinasi Gaya ke Semua Klip (4 Klip)"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleDownloadPreview}
          disabled={isDownloading}
          className="w-full h-9 rounded-xl bg-gradient-to-r from-[#1a858c] via-[#21a6a3] to-[#2cd3c6] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(44,211,198,0.3)] hover:shadow-[0_0_20px_rgba(44,211,198,0.5)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Merender Pratinjau MP4...</span>
            </>
          ) : downloadDone ? (
            <>
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>Video MP4 Tersimpan! 📥</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>⬇️ Unduh MP4</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
