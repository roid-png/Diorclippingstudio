import React, { useState } from "react";
import { Download, Check, Loader2, Play } from "lucide-react";
import type { ClipItem } from "../types";

interface ClipCardProps {
  clip: ClipItem;
  onSelectClip: (clip: ClipItem) => void;
  onDownloadNotice?: (msg: string) => void;
}

export function ClipCard({ clip, onSelectClip, onDownloadNotice }: ClipCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

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

      // Download trigger
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

  return (
    <div
      onClick={() => onSelectClip(clip)}
      className="bg-[#0e2125]/85 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-2.5 sm:p-3 flex flex-col gap-2.5 shadow-xl hover:border-[#2cd3c6]/40 transition-all duration-200 group cursor-pointer text-slate-100"
    >
      {/* 9:16 Video Player Container */}
      <div className="relative w-full aspect-[9/16] max-h-[270px] lg:max-h-[295px] mx-auto rounded-xl overflow-hidden shadow-inner group-hover:scale-[1.01] transition-transform duration-200 bg-[#071316] flex items-center justify-center">
        {/* Ambient blurred backdrop */}
        <img
          src={clip.imageSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-lg opacity-40 scale-125 pointer-events-none"
        />

        {/* Crisp uncropped video preview */}
        <img
          src={clip.imageSrc}
          alt={clip.title}
          className="relative z-10 w-full h-full object-contain pointer-events-none"
        />

        {/* Hover play icon indicator */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
          <div className="w-8 h-8 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center border border-white/40 text-white text-xs">
            <Play className="w-3.5 h-3.5 ml-0.5 fill-white" />
          </div>
        </div>
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
            <Check className="w-3.5 h-3.5 text-white" />
            <span>Tersimpan! ✅</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            <span>Unduh MP4</span>
          </>
        )}
      </button>
    </div>
  );
}
