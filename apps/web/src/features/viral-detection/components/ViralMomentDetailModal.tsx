import { useState } from "react";
import { X, Flame, Sparkles, Check, Clock, TrendingUp, Layers, HelpCircle } from "lucide-react";
import type { ViralClipItem } from "../types";
import { getCategoryMeta, getViralScoreMeta } from "../types";

interface ViralMomentDetailModalProps {
  clip: ViralClipItem | null;
  onClose: () => void;
  onToggleSelect: (clipId: string) => void;
}

export function ViralMomentDetailModal({
  clip,
  onClose,
  onToggleSelect,
}: ViralMomentDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!clip) return null;

  const catMeta = getCategoryMeta(clip.category);
  const scoreMeta = getViralScoreMeta(clip.viralScore);

  const handleCopyTranscript = () => {
    const text = clip.subtitles
      .map((s) => `[${s.speaker || "VOICE"}] ${s.text.replace(/<\/?hl>/g, "")}`)
      .join("\n");
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#0e2125] border border-[#2cd3c6]/40 rounded-2xl p-5 sm:p-6 shadow-2xl text-slate-100 flex flex-col max-h-[90vh] overflow-y-auto"
      >
        {/* Top Header: Skor Viral + Label Kategori + Rank */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Viral Score Badge with Flame & Tier */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md flex items-center gap-1.5 ${scoreMeta.badgeClass}`}
            >
              <Flame className={`w-3.5 h-3.5 ${scoreMeta.flameColor}`} />
              <span>Skor {clip.viralScoreFormatted}</span>
              <span className="opacity-90">• {scoreMeta.shortLabel}</span>
            </span>

            {/* Category Label Badge */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${catMeta.badgeClass}`}
            >
              <span>{catMeta.icon}</span>
              <span>{catMeta.label}</span>
            </span>

            {/* Rank & Duration */}
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#136f7c]/40 text-[#2cd3c6] border border-[#2cd3c6]/30 font-medium">
              Rank #{clip.rank} • {clip.duration}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#1a373f] text-[#8fa4aa] hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-base sm:text-lg font-bold text-white mb-2">
          {clip.title}
        </h3>

        {/* 2 Columns: Video Preview Thumbnail (Left) + AI Viral Breakdown (Right) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {/* Left Column: 9:16 Video Frame */}
          <div className="relative aspect-[9/16] max-h-[320px] rounded-xl overflow-hidden bg-black flex items-center justify-center shadow-inner mx-auto sm:mx-0">
            <img
              src={clip.imageSrc}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-md opacity-40 scale-125"
            />
            <img
              src={clip.imageSrc}
              alt={clip.title}
              className="relative z-10 w-full h-full object-contain"
            />
            <div className="absolute bottom-3 inset-x-3 z-20 bg-black/85 backdrop-blur-md rounded-xl p-2 text-center text-xs font-bold text-white">
              "{clip.highlightMoment}"
            </div>
          </div>

          {/* Right Column: AI Analysis & Metrics */}
          <div className="flex flex-col justify-between gap-3">
            {/* Why Viral Box */}
            <div className="bg-[#142a30] border border-[#234c56] rounded-xl p-3">
              <h4 className="text-xs font-bold text-[#2cd3c6] flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analisis AI: Kenapa Momen Ini Viral?</span>
              </h4>
              <p className="text-xs text-gray-200 leading-relaxed mb-2">
                {clip.whyViral}
              </p>
              <div className="pt-2 border-t border-[#1e444e] text-[11px] text-[#8ca4aa] flex items-start gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#2cd3c6] shrink-0 mt-0.5" />
                <span>{catMeta.algorithmReason}</span>
              </div>
            </div>

            {/* AI Retention Metrics Bars */}
            <div className="bg-[#142a30] border border-[#234c56] rounded-xl p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Metrik Potensi Viral</span>
                </h4>
                <span className="text-[10px] font-mono text-[#2cd3c6]">
                  {scoreMeta.reachPrediction}
                </span>
              </div>

              {/* Metric 1 */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#8ca4aa]">Retensi Hook 3 Detik</span>
                  <span className="font-bold text-emerald-400">
                    {clip.metrics.hookRetention}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#102428] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${clip.metrics.hookRetention}%` }}
                  />
                </div>
              </div>

              {/* Metric 2 */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#8ca4aa]">Energi & Sentimen Percakapan</span>
                  <span className="font-bold text-cyan-400">
                    {clip.metrics.sentimentEnergy}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#102428] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${clip.metrics.sentimentEnergy}%` }}
                  />
                </div>
              </div>

              {/* Metric 3 */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#8ca4aa]">Kekuatan Punchline / Solusi</span>
                  <span className="font-bold text-amber-400">
                    {clip.metrics.punchlineScore}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#102428] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${clip.metrics.punchlineScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Time range info */}
            <div className="flex items-center gap-2 text-xs text-[#8ca4aa]">
              <Clock className="w-3.5 h-3.5 text-[#2cd3c6]" />
              <span>
                Timestamp: <strong className="text-white">{clip.timeRange}</strong> (
                {clip.duration})
              </span>
            </div>
          </div>
        </div>

        {/* Subtitle / Transcript Section */}
        <div className="bg-[#12282f] border border-[#1e3c43] rounded-xl p-3.5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white">Transkrip Subtitle Terdeteksi</span>
            <button
              type="button"
              onClick={handleCopyTranscript}
              className="text-[11px] text-[#2cd3c6] hover:text-[#45ecdf] font-medium transition cursor-pointer"
            >
              {copied ? "Tersalin! ✅" : "Salin Teks"}
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
            {clip.subtitles.map((cue, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-xs p-1.5 rounded-lg bg-[#0e2125]/70 border border-[#1a373e]"
              >
                <span className="font-mono text-[10px] text-[#2cd3c6] shrink-0 pt-0.5">
                  +{cue.time}s
                </span>
                {cue.speaker && (
                  <span
                    className={`px-1 rounded text-[9px] font-black uppercase shrink-0 ${
                      cue.speaker === "HOST"
                        ? "bg-cyan-950 text-cyan-400 border border-cyan-800"
                        : "bg-red-950 text-red-400 border border-red-800"
                    }`}
                  >
                    {cue.speaker}
                  </span>
                )}
                <span className="text-gray-200">
                  {cue.text.replace(/<\/?hl>/g, "")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1b373e]">
          <button
            type="button"
            onClick={() => onToggleSelect(clip.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
              clip.isSelected
                ? "bg-[#16515a] border-[#2cd3c6] text-white"
                : "bg-[#14282e] border-[#1f3e46] text-[#8fa4aa] hover:text-white"
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{clip.isSelected ? "Klip Dipilih" : "Pilih Klip Ini"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#17858c] via-[#20a3a7] to-[#2cd3c6] text-white text-xs font-bold hover:brightness-110 shadow-lg cursor-pointer"
          >
            Tutup Pratinjau
          </button>
        </div>
      </div>
    </div>
  );
}
