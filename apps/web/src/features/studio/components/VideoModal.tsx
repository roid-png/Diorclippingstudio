import React, { useState } from "react";
import { X, Play, Pause, Download, Volume2, VolumeX, Sparkles } from "lucide-react";
import type { ClipItem } from "../types";

interface VideoModalProps {
  clip: ClipItem | null;
  onClose: () => void;
  onDownloadNotice?: (msg: string) => void;
}

function renderNetflixSubtitle(text: string) {
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

export function VideoModal({ clip, onClose, onDownloadNotice }: VideoModalProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  if (!clip) return null;

  const activeSubtitle = clip.subtitles && clip.subtitles.length > 0 ? clip.subtitles[0] : null;

  const handleDownload = () => {
    if (onDownloadNotice) {
      onDownloadNotice(`Mengunduh versi HD ${clip.title}.mp4...`);
    }
    const blob = new Blob(
      [
        `Klip Viral Otomatis - ${clip.title}\nSkor Viral: ${clip.viralScore}\nDurasi: ${clip.duration}\nPreset: ${clip.preset}\nSorotan: ${clip.highlightMoment}`,
      ],
      { type: "video/mp4" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clip.title.toLowerCase().replace(/\s+/g, "_")}_dior_clip.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm sm:max-w-md bg-[#0e2125] border border-[#1e3c43] rounded-3xl p-4 shadow-2xl flex flex-col gap-3 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#1b373e]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{clip.title}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#136f7c] text-cyan-200 font-medium">
              {clip.preset}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#14282e] hover:bg-[#1a343c] text-gray-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 9:16 Video Player Container */}
        <div className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden border border-[#1f3e46] bg-black flex items-center justify-center">
          <img
            src={clip.imageSrc}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 scale-125"
          />
          <img
            src={clip.imageSrc}
            alt={clip.title}
            className={`relative z-10 w-full h-full object-contain transition-transform duration-500 ${
              isPlaying ? "scale-[1.01]" : "scale-100"
            }`}
          />

          {/* Subtitle Overlay (Authentic Netflix / Theo Style) */}
          {activeSubtitle && (
            <div className="absolute bottom-14 left-3 right-3 z-20 flex flex-col items-center pointer-events-none animate-fadeIn">
              {activeSubtitle.speaker && (
                <span
                  className={`mb-1 px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase border ${
                    activeSubtitle.speaker === "HOST"
                      ? "bg-black/90 text-cyan-400 border-cyan-500/50"
                      : "bg-black/90 text-red-500 border-red-500/50"
                  }`}
                >
                  {activeSubtitle.speaker}
                </span>
              )}
              <div className="bg-black/85 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 text-center shadow-2xl max-w-[95%]">
                <p className="text-white font-bold text-xs sm:text-sm leading-snug font-sans">
                  {renderNetflixSubtitle(activeSubtitle.text)}
                </p>
              </div>
            </div>
          )}

          {/* Quick Controls Overlay */}
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>
            <span className="text-[11px] text-white/80 font-medium bg-black/40 px-2 py-0.5 rounded">
              00:14 / {clip.duration}
            </span>
          </div>
        </div>

        {/* Highlight Moment Description */}
        <div className="p-2.5 rounded-xl bg-[#14282e]/80 border border-[#1f3e46] text-xs">
          <p className="text-[11px] text-[#2cd3c6] font-semibold flex items-center gap-1 mb-0.5">
            <Sparkles className="w-3 h-3" />
            <span>Sorotan Momen Viral:</span>
          </p>
          <p className="text-gray-300">{clip.highlightMoment}</p>
        </div>

        {/* Modal Action Bar */}
        <button
          type="button"
          onClick={handleDownload}
          className="w-full h-10 rounded-xl bg-gradient-to-r from-[#17858c] via-[#20a3a7] to-[#2cd3c6] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(44,211,198,0.3)] hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>⬇️ Unduh MP4 Kualitas HD</span>
        </button>
      </div>
    </div>
  );
}
