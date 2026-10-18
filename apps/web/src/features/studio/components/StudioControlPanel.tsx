import React, { useRef, useState } from "react";
import { Search, Upload, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import type { ProcessingStatus } from "../types";

interface StudioControlPanelProps {
  youtubeUrl: string;
  setYoutubeUrl: (url: string) => void;
  clippingLimit: number;
  setClippingLimit: (limit: number) => void;
  duration: number;
  setDuration: (duration: number) => void;
  preset: string;
  setPreset: (preset: string) => void;
  autoMotionGraphic: boolean;
  setAutoMotionGraphic: (enabled: boolean) => void;
  refFileName: string;
  setRefFileName: (name: string) => void;
  status: ProcessingStatus;
  statusMessage: string;
  onGenerate: () => void;
  errorMessage: string | null;
}

export function StudioControlPanel({
  youtubeUrl,
  setYoutubeUrl,
  clippingLimit,
  setClippingLimit,
  duration,
  setDuration,
  preset,
  setPreset,
  autoMotionGraphic,
  setAutoMotionGraphic,
  refFileName,
  setRefFileName,
  status,
  statusMessage,
  onGenerate,
  errorMessage,
}: StudioControlPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRefFileName(file.name);
    }
  };

  const isProcessing = status === "downloading" || status === "analyzing";

  return (
    <section className="bg-[#0e2125]/90 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-4 sm:p-5 shadow-2xl mb-6 text-slate-100">
      {/* Row 1: YouTube Input + Main Action Button */}
      <div className="flex flex-col md:flex-row items-stretch gap-3 mb-3">
        {/* Input container */}
        <div className="relative flex-1 group">
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="Paste YouTube Link here... https://www.youtube.com/watch?v=V0k9u"
            className="w-full h-11 bg-[#14282e] border border-[#1f3e46] rounded-xl pl-4 pr-11 text-xs sm:text-sm text-gray-200 placeholder-[#58737a] focus:outline-none focus:border-[#2cd3c6] transition shadow-inner font-sans"
          />
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#58737a] group-hover:text-[#2cd3c6] transition cursor-pointer">
            <Search className="w-4 h-4" />
          </div>
        </div>

        {/* Generate Button: AUTO-CUT & GENERATE 🚀 */}
        <button
          type="button"
          onClick={onGenerate}
          disabled={isProcessing}
          className="h-11 px-7 rounded-xl bg-gradient-to-r from-[#17858c] via-[#20a3a7] to-[#2cd3c6] text-white text-xs sm:text-sm font-bold tracking-wider shadow-[0_0_20px_rgba(44,211,198,0.35)] hover:shadow-[0_0_25px_rgba(44,211,198,0.55)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shrink-0 select-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>MEMPROSES KLIP...</span>
            </>
          ) : (
            <>
              <span>AUTO-CUT & GENERATE 🚀</span>
            </>
          )}
        </button>
      </div>

      {/* Error / Processing Feedback */}
      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {statusMessage && !errorMessage && (
        <div className="mb-4 p-2.5 rounded-xl bg-[#132c32] border border-[#2cd3c6]/40 text-cyan-200 text-xs flex items-center gap-2">
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2cd3c6]" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Row 2: 4 Columns Configuration Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-0 lg:divide-x divide-[#1d3a41]">
        {/* Column 1: Clipping Limit */}
        <div className="lg:pr-4 flex flex-col justify-between">
          <h3 className="text-xs font-semibold text-[#8ca4aa] mb-2">
            Clipping Limit
          </h3>
          <div className="grid grid-cols-5 gap-1.5 w-full max-w-[210px]">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              const isActive = clippingLimit === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setClippingLimit(num)}
                  className={`h-7 rounded-lg text-xs font-semibold transition-all flex items-center justify-center select-none cursor-pointer ${
                    isActive
                      ? "bg-[#20b2aa] text-white shadow-[0_0_10px_rgba(32,178,170,0.5)] font-bold"
                      : "bg-[#14282e] text-[#8fa4aa] hover:bg-[#1a343c] hover:text-white"
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>

        {/* Column 2: Duration */}
        <div className="lg:px-4 flex flex-col justify-between">
          <h3 className="text-xs font-semibold text-[#8ca4aa] mb-2">
            Duration
          </h3>
          <div className="grid grid-cols-2 gap-1.5 w-full max-w-[200px]">
            {/* Top Left: 30 Detik */}
            <button
              type="button"
              onClick={() => setDuration(30)}
              className={`h-7 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center select-none cursor-pointer ${
                duration === 30
                  ? "bg-[#20b2aa] text-white shadow-[0_0_10px_rgba(32,178,170,0.5)] font-bold"
                  : "bg-[#14282e] text-[#8fa4aa] hover:bg-[#1a343c] hover:text-white"
              }`}
            >
              30 Detik
            </button>

            {/* Top Right: 45 (Active Teal Pill in screenshot) */}
            <button
              type="button"
              onClick={() => setDuration(45)}
              className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center select-none cursor-pointer ${
                duration === 45
                  ? "bg-[#20b2aa] text-white shadow-[0_0_10px_rgba(32,178,170,0.5)] font-bold"
                  : "bg-[#14282e] text-[#8fa4aa] hover:bg-[#1a343c] hover:text-white"
              }`}
            >
              45
            </button>

            {/* Bottom Left: Detik */}
            <button
              type="button"
              onClick={() => setDuration(45)}
              className="h-7 px-3 rounded-lg text-xs font-medium bg-[#14282e] text-[#8fa4aa] hover:bg-[#1a343c] hover:text-white flex items-center justify-center select-none cursor-pointer"
            >
              Detik
            </button>

            {/* Bottom Right: 60 Detik */}
            <button
              type="button"
              onClick={() => setDuration(60)}
              className={`h-7 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center select-none cursor-pointer ${
                duration === 60
                  ? "bg-[#20b2aa] text-white shadow-[0_0_10px_rgba(32,178,170,0.5)] font-bold"
                  : "bg-[#14282e] text-[#8fa4aa] hover:bg-[#1a343c] hover:text-white"
              }`}
            >
              60 Detik
            </button>
          </div>
        </div>

        {/* Column 3: AI Style Cloner */}
        <div className="lg:px-4 flex flex-col justify-between">
          <h3 className="text-xs font-semibold text-[#8ca4aa] mb-2 flex items-center gap-1">
            <span>AI Style Cloner</span>
            <span>🪄</span>
          </h3>

          <div className="flex flex-col gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="video/*"
              className="hidden"
            />
            {/* Dashed Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-8 border border-dashed border-[#294c53] bg-[#14282e]/50 hover:bg-[#173038] hover:border-[#2cd3c6]/60 rounded-xl px-3 text-[11px] text-[#93adb3] flex items-center justify-center gap-1.5 cursor-pointer transition select-none group"
            >
              <Upload className="w-3.5 h-3.5 text-[#2cd3c6] group-hover:scale-110 transition-transform" />
              <span>Upload Ref Video (5-15s)</span>
            </button>

            {/* File status */}
            <div className="flex items-center gap-1.5 text-[11px] text-[#849ea4] truncate">
              <FileText className="w-3.5 h-3.5 text-[#8fa4aa] shrink-0" />
              <span className="truncate">{refFileName}</span>
              <span className="text-emerald-400 font-medium shrink-0">(Cloned ✅)</span>
            </div>
          </div>
        </div>

        {/* Column 4: Subtitle & Motion Preset */}
        <div className="lg:pl-4 flex flex-col justify-between">
          <h3 className="text-xs font-semibold text-[#8ca4aa] mb-2">
            Subtitle & Motion Preset
          </h3>

          {/* Presets Row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
            {/* Netflix Style */}
            <button
              type="button"
              onClick={() => setPreset("netflix")}
              className={`px-2 py-1 rounded-full text-[10px] sm:text-[11px] font-medium transition flex items-center gap-1 select-none cursor-pointer ${
                preset === "netflix"
                  ? "bg-[#156670] border border-[#2cd3c6]/60 text-white shadow-sm"
                  : "bg-[#14282e] border border-[#1f3e46] text-[#7d979e] hover:text-white"
              }`}
            >
              <span>🍿</span>
              <span>Netflix Style (Minimal)</span>
            </button>

            {/* Viral Motion */}
            <button
              type="button"
              onClick={() => setPreset("viral")}
              className={`px-2 py-1 rounded-full text-[10px] sm:text-[11px] font-medium transition flex items-center gap-1 select-none cursor-pointer ${
                preset === "viral"
                  ? "bg-[#156670] border border-[#2cd3c6]/60 text-white shadow-sm"
                  : "bg-[#14282e] border border-[#1f3e46] text-[#7d979e] hover:text-white"
              }`}
            >
              <span>🔥</span>
              <span>Viral Motion (Bounce)</span>
            </button>

            {/* AI Cloned (Active) */}
            <button
              type="button"
              onClick={() => setPreset("ai-cloned")}
              className={`px-2 py-1 rounded-full text-[10px] sm:text-[11px] font-medium transition flex items-center gap-1 select-none cursor-pointer ${
                preset === "ai-cloned"
                  ? "bg-[#136f7c] border border-[#2cd3c6]/80 text-white shadow-[0_0_8px_rgba(44,211,198,0.3)]"
                  : "bg-[#14282e] border border-[#1f3e46] text-[#7d979e] hover:text-white"
              }`}
            >
              <span>🪄</span>
              <span>AI Cloned</span>
            </button>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1b373e]/50">
            <span className="text-[11px] text-[#819ca2] font-medium leading-tight">
              Auto Motion Graphic (Progress Bar & Zoom)
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={autoMotionGraphic}
              onClick={() => setAutoMotionGraphic(!autoMotionGraphic)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                autoMotionGraphic
                  ? "bg-[#2cd3c6] shadow-[0_0_8px_rgba(44,211,198,0.5)]"
                  : "bg-[#14282e] border border-[#1f3e46]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
                  autoMotionGraphic ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
