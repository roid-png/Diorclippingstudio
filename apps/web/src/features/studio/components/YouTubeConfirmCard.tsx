import type { SVGProps } from "react";
import { CheckCircle2, Clock, Eye, Film, Sparkles, X } from "lucide-react";
import type { YouTubeVideoMetadata } from "../types";

function YoutubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

interface YouTubeConfirmCardProps {
  metadata: YouTubeVideoMetadata;
  onClear: () => void;
  onConfirm?: () => void;
}

export function YouTubeConfirmCard({
  metadata,
  onClear,
  onConfirm,
}: YouTubeConfirmCardProps) {
  return (
    <div className="w-full bg-gradient-to-r from-[#10272c]/95 via-[#133037]/90 to-[#0e2429]/95 border border-[#20b2aa]/40 rounded-xl p-3.5 mb-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)] animate-fadeIn transition-all">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left Side: Thumbnail & Title Info */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Thumbnail with overlay tags */}
          <div className="relative w-24 sm:w-28 h-16 rounded-lg overflow-hidden shrink-0 bg-[#091518] border border-[#2cd3c6]/30 shadow-md group">
            <img
              src={metadata.thumbnailUrl}
              alt={metadata.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                // Fallback to local image if broken
                (e.target as HTMLImageElement).src = "/images/bg_clip_1.png";
              }}
            />
            {/* YouTube Icon Badge */}
            <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-xs p-0.5 rounded text-red-500">
              <YoutubeIcon className="w-3 h-3" />
            </div>

            {/* Duration pill */}
            <div className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-xs px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold text-white flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5 text-[#2cd3c6]" />
              <span>{metadata.durationFormatted}</span>
            </div>
          </div>

          {/* Video Metadata Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2cd3c6]/20 text-[#2cd3c6] border border-[#2cd3c6]/40">
                <CheckCircle2 className="w-3 h-3" />
                <span>Judul Video Terkonfirmasi</span>
              </span>
              <span className="text-[10px] text-[#7d99a0] flex items-center gap-1 font-mono">
                <Film className="w-3 h-3 text-[#2cd3c6]" />
                <span>ID: {metadata.videoId}</span>
              </span>
            </div>

            <h4 className="text-xs sm:text-sm font-bold text-white leading-snug line-clamp-2 title-glow">
              {metadata.title}
            </h4>

            <div className="flex items-center gap-3 mt-1 text-[11px] text-[#86a2a8] flex-wrap">
              <span className="font-medium text-slate-300">
                {metadata.channelTitle}
              </span>
              {metadata.viewCount && (
                <>
                  <span className="text-[#3c5961]">•</span>
                  <span className="flex items-center gap-1 text-[10px]">
                    <Eye className="w-3 h-3 text-[#5f7d84]" />
                    <span>{metadata.viewCount}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={onClear}
            className="px-2.5 py-1.5 rounded-lg bg-[#14282e] hover:bg-[#1c363e] border border-[#1f3e46] text-[#8ea5ab] hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer"
            title="Ganti dengan link lain"
          >
            <X className="w-3.5 h-3.5" />
            <span>Ganti Link</span>
          </button>

          {onConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              className="px-3 py-1.5 rounded-lg bg-[#20b2aa] hover:bg-[#2cd3c6] text-white text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_12px_rgba(32,178,170,0.4)] transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gunakan Video Ini</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
