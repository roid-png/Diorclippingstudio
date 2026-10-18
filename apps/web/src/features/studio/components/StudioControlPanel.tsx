import { useRef, useState, type SVGProps } from "react";
import {
  Search,
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clipboard,
  X,
  Sparkles,
} from "lucide-react";
import type { ProcessingStatus, YouTubeVideoMetadata } from "../types";
import type {
  EditingStylePreset,
  MotionGraphicPreset,
  SubtitleStylePreset,
} from "../presets/types";
import { YouTubeConfirmCard } from "./YouTubeConfirmCard";
import { DurationSelector } from "./DurationSelector";
import { ClippingLimitSelector } from "./ClippingLimitSelector";
import { CreativeStylePanel } from "./CreativeStylePanel";

function YoutubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

interface StudioControlPanelProps {
  youtubeUrl: string;
  setYoutubeUrl: (url: string) => void;
  videoMetadata: YouTubeVideoMetadata | null;
  setVideoMetadata: (metadata: YouTubeVideoMetadata | null) => void;
  isValidatingUrl: boolean;
  onValidateAndConfirm: (url: string) => void;
  clippingLimit: number;
  setClippingLimit: (limit: number) => void;
  totalQuota?: number;
  usedQuota?: number;
  duration: number;
  setDuration: (duration: number) => void;
  editingStyle: string;
  setEditingStyle: (style: string) => void;
  motionGraphicStyle: string;
  setMotionGraphicStyle: (style: string) => void;
  subtitleStyle: string;
  setSubtitleStyle: (style: string) => void;
  editingStyles: EditingStylePreset[];
  motionGraphics: MotionGraphicPreset[];
  subtitleStyles: SubtitleStylePreset[];
  onAddNewPreset: (category: "editing" | "motion" | "subtitle", preset: any) => void;
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
  videoMetadata,
  setVideoMetadata,
  isValidatingUrl,
  onValidateAndConfirm,
  clippingLimit,
  setClippingLimit,
  totalQuota = 50,
  usedQuota = 5,
  duration,
  setDuration,
  editingStyle,
  setEditingStyle,
  motionGraphicStyle,
  setMotionGraphicStyle,
  subtitleStyle,
  setSubtitleStyle,
  editingStyles,
  motionGraphics,
  subtitleStyles,
  onAddNewPreset,
  refFileName,
  setRefFileName,
  status,
  statusMessage,
  onGenerate,
  errorMessage,
}: StudioControlPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRefFileName(file.name);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setYoutubeUrl(text.trim());
          onValidateAndConfirm(text.trim());
          setPasteNotice("Link berhasil ditempel dari clipboard!");
          setTimeout(() => setPasteNotice(null), 2500);
        }
      }
    } catch {
      setPasteNotice("Gunakan Ctrl+V untuk menempelkan link YouTube.");
      setTimeout(() => setPasteNotice(null), 3000);
    }
  };

  const handleClearUrl = () => {
    setYoutubeUrl("");
    setVideoMetadata(null);
  };

  const isProcessing = status === "downloading" || status === "analyzing";

  return (
    <section className="bg-[#0e2125]/90 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-4 sm:p-5 shadow-2xl mb-6 text-slate-100">
      {/* Row 1: YouTube Input + Main Action Button */}
      <div className="flex flex-col md:flex-row items-stretch gap-3 mb-3">
        {/* Input container */}
        <div className="relative flex-1 group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-500 flex items-center pointer-events-none">
            <YoutubeIcon className="w-4 h-4" />
          </div>

          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => {
              const val = e.target.value;
              setYoutubeUrl(val);
              if (val.trim()) {
                onValidateAndConfirm(val);
              } else {
                setVideoMetadata(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onValidateAndConfirm(youtubeUrl);
              }
            }}
            placeholder="Paste YouTube Link here... https://www.youtube.com/watch?v=V0k9u"
            className={`w-full h-11 bg-[#14282e] border ${
              errorMessage
                ? "border-red-500/60 focus:border-red-400"
                : videoMetadata
                ? "border-[#20b2aa]/70 focus:border-[#2cd3c6]"
                : "border-[#1f3e46] focus:border-[#2cd3c6]"
            } rounded-xl pl-10 pr-24 text-xs sm:text-sm text-gray-200 placeholder-[#58737a] focus:outline-none transition shadow-inner font-sans`}
          />

          {/* Quick Action Buttons inside Input */}
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {isValidatingUrl ? (
              <Loader2 className="w-4 h-4 text-[#2cd3c6] animate-spin" />
            ) : videoMetadata ? (
              <span className="text-emerald-400 p-1" title="Link YouTube Valid & Terverifikasi">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            ) : null}

            {youtubeUrl ? (
              <button
                type="button"
                onClick={handleClearUrl}
                className="p-1 text-[#658188] hover:text-white rounded transition cursor-pointer"
                title="Hapus Link"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="px-2 py-0.5 rounded-md bg-[#1d3a42] hover:bg-[#254953] text-[#2cd3c6] text-[11px] font-medium flex items-center gap-1 transition cursor-pointer shadow-xs"
                title="Tempel dari Clipboard"
              >
                <Clipboard className="w-3 h-3" />
                <span>Tempel</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onValidateAndConfirm(youtubeUrl)}
              className="p-1 text-[#58737a] hover:text-[#2cd3c6] transition cursor-pointer"
              title="Cek Link Video"
            >
              <Search className="w-4 h-4" />
            </button>
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

      {/* Paste notification toast */}
      {pasteNotice && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-[#143239] border border-[#20b2aa]/40 text-[#2cd3c6] text-xs flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{pasteNotice}</span>
        </div>
      )}

      {/* Video Title Confirmation Card */}
      {videoMetadata && !errorMessage && (
        <YouTubeConfirmCard
          metadata={videoMetadata}
          onClear={handleClearUrl}
        />
      )}

      {/* Error / Processing Feedback */}
      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2 animate-shake">
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

      {/* Row 2: 3 Columns Configuration Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-0 lg:divide-x divide-[#1d3a41]">
        {/* Column 1: Clipping Limit (Maks 10) & Sisa Kuota */}
        <div className="lg:pr-4">
          <ClippingLimitSelector
            clippingLimit={clippingLimit}
            setClippingLimit={setClippingLimit}
            totalQuota={totalQuota}
            usedQuota={usedQuota}
            disabled={isProcessing}
          />
        </div>

        {/* Column 2: Duration (30 Detik, 45 Detik, 1 Menit) */}
        <div className="lg:px-4">
          <DurationSelector
            duration={duration}
            setDuration={setDuration}
            disabled={isProcessing}
          />
        </div>

        {/* Column 3: AI Style Cloner */}
        <div className="lg:pl-4 flex flex-col justify-between">
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
      </div>

      {/* Row 3: 3 Distinct Preset Selectors (Editing Style, Motion Graphic, Subtitle) */}
      <CreativeStylePanel
        editingStyle={editingStyle}
        setEditingStyle={setEditingStyle}
        motionGraphicStyle={motionGraphicStyle}
        setMotionGraphicStyle={setMotionGraphicStyle}
        subtitleStyle={subtitleStyle}
        setSubtitleStyle={setSubtitleStyle}
        editingStyles={editingStyles}
        motionGraphics={motionGraphics}
        subtitleStyles={subtitleStyles}
        onAddNewPreset={onAddNewPreset}
        disabled={isProcessing}
      />
    </section>
  );
}
