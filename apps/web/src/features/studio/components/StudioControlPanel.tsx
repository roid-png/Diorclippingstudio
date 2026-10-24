import { useRef, useState, type SVGProps } from "react";
import {
  Upload,
  UploadCloud,
  FileVideo,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clipboard,
  X,
  Sparkles,
  RotateCcw,
  Minus,
  Plus,
  Scissors,
  Subtitles,
  Sliders,
  Type,
  Wand2,
  Check,
  Music,
} from "lucide-react";

function YoutubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export interface DynamicPresetItem {
  id: string;
  name: string;
  description?: string;
  colorGrading?: string;
  pipelineMode?: string;
  accentColor?: string;
  enableHook?: boolean;
  enableTopMotion?: boolean;
  enablePolish?: boolean;
  badge?: string;
  isCloned?: boolean;
  layoutArchitecture?: string;
  subtitleBehavior?: string;
  hookTypographyStyle?: string;
  styleVariant?: number;
  subtitleStyle?: {
    fontName?: string;
    fontSize?: number;
    primaryColor?: string;
    highlightColor?: string;
  };
}

export type PipelineMode = "raw_cut" | "clean_subtitle" | "netflix_editorial" | "clone_only";

export const SUBTITLE_FONTS = [
  "Montserrat ExtraBold",
  "Plus Jakarta Sans",
  "Poppins Black",
  "Anton",
  "Bebas Neue",
] as const;

export interface StudioControlPanelProps {
  inputMode: "youtube" | "upload";
  setInputMode: (mode: "youtube" | "upload") => void;
  youtubeUrl: string;
  setYoutubeUrl: (url: string) => void;
  uploadedVideoFile: File | null;
  setUploadedVideoFile: (file: File | null) => void;

  // Kolom 1: Output Target
  clipCount: number;
  setClipCount: (count: number) => void;
  targetDuration: number;
  setTargetDuration: (duration: number) => void;

  // Kolom 2: Editing Pipeline
  pipelineMode: PipelineMode;
  setPipelineMode: (mode: PipelineMode) => void;

  // Kolom 3: Style & Typography
  presets: DynamicPresetItem[];
  selectedPresetId: string;
  setSelectedPresetId: (id: string) => void;
  subtitleFont: string;
  setSubtitleFont: (font: string) => void;

  // Kolom 4: Reference & Polish
  refFileName: string;
  setRefFileName: (name: string) => void;
  onUploadReferenceVideo?: (file: File) => void;
  isCloningStyle?: boolean;
  hasActiveClone?: boolean;
  onCancelClone?: () => void;
  tempCloneSummary?: string;
  enableHook: boolean;
  setEnableHook: (enabled: boolean) => void;
  enablePolish: boolean;
  setEnablePolish: (enabled: boolean) => void;

  // Fase 8: Motion Animation toggles for Clone Style & Finishing
  enableCloneTopMotion?: boolean;
  setEnableCloneTopMotion?: (enabled: boolean) => void;
  enableCloneBottomMotion?: boolean;
  setEnableCloneBottomMotion?: (enabled: boolean) => void;

  // Fase 1: Custom Background Music (BGM) Upload
  uploadedBgmFile?: File | null;
  setUploadedBgmFile?: (file: File | null) => void;
  enableBgmDucking?: boolean;
  setEnableBgmDucking?: (enabled: boolean) => void;
  bgmBaseVolume?: number;
  setBgmBaseVolume?: (vol: number) => void;

  // System & Action Props
  status: string;
  statusMessage: string;
  onGenerate: () => void;
  onReset: () => void;
  errorMessage: string | null;

  // Backward-compatibility aliases
  clippingLimit?: number;
  setClippingLimit?: (limit: number) => void;
  duration?: number;
  setDuration?: (duration: number) => void;
  selectedFont?: string;
  setSelectedFont?: (font: string) => void;
  compositionMode?: any;
  setCompositionMode?: (mode: any) => void;
  enableMotionGraphic?: boolean;
  setEnableMotionGraphic?: (enabled: boolean) => void;
  enableCinematicHook?: boolean;
  setEnableCinematicHook?: (enabled: boolean) => void;
  hookFont?: string;
  setHookFont?: (font: string) => void;
  colorPolish?: boolean;
  setColorPolish?: (enabled: boolean) => void;
}

export function StudioControlPanel(props: StudioControlPanelProps) {
  const {
    inputMode,
    setInputMode,
    youtubeUrl,
    setYoutubeUrl,
    uploadedVideoFile,
    setUploadedVideoFile,
    clipCount: propClipCount,
    setClipCount: propSetClipCount,
    targetDuration: propTargetDuration,
    setTargetDuration: propSetTargetDuration,
    pipelineMode,
    setPipelineMode,
    presets,
    selectedPresetId,
    setSelectedPresetId,
    subtitleFont: propSubtitleFont,
    setSubtitleFont: propSetSubtitleFont,
    refFileName,
    setRefFileName,
    onUploadReferenceVideo,
    isCloningStyle = false,
    hasActiveClone = false,
    onCancelClone,
    tempCloneSummary,
    enableHook: propEnableHook,
    setEnableHook: propSetEnableHook,
    enablePolish: propEnablePolish,
    setEnablePolish: propSetEnablePolish,
    enableCloneTopMotion = false,
    setEnableCloneTopMotion,
    enableCloneBottomMotion = false,
    setEnableCloneBottomMotion,
    status,
    statusMessage,
    onGenerate,
    onReset,
    errorMessage,
    clippingLimit,
    setClippingLimit,
    duration,
    setDuration,
    selectedFont,
    setSelectedFont,
    enableCinematicHook,
    setEnableCinematicHook,
    colorPolish,
    setColorPolish,
    uploadedBgmFile,
    setUploadedBgmFile,
    enableBgmDucking = true,
    setEnableBgmDucking,
    bgmBaseVolume = 0.15,
    setBgmBaseVolume,
  } = props;

  // Resolve values with fallback to backward-compat aliases
  const clipCount = propClipCount ?? clippingLimit ?? 5;
  const setClipCount = (val: number) => {
    propSetClipCount?.(val);
    setClippingLimit?.(val);
  };

  const targetDuration = propTargetDuration ?? duration ?? 45;
  const setTargetDuration = (val: number) => {
    propSetTargetDuration?.(val);
    setDuration?.(val);
  };

  const subtitleFont = propSubtitleFont ?? selectedFont ?? "Montserrat ExtraBold";
  const setSubtitleFont = (val: string) => {
    propSetSubtitleFont?.(val);
    setSelectedFont?.(val);
  };

  const enableHook = propEnableHook ?? enableCinematicHook ?? true;
  const setEnableHook = (val: boolean) => {
    propSetEnableHook?.(val);
    setEnableCinematicHook?.(val);
  };

  const enablePolish = propEnablePolish ?? colorPolish ?? true;
  const setEnablePolish = (val: boolean) => {
    propSetEnablePolish?.(val);
    setColorPolish?.(val);
  };

  const refFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const bgmFileInputRef = useRef<HTMLInputElement>(null);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleRefFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRefFileName(file.name);
      if (onUploadReferenceVideo) {
        onUploadReferenceVideo(file);
      }
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setYoutubeUrl(text.trim());
          setPasteNotice("Link berhasil ditempel dari clipboard");
          setTimeout(() => setPasteNotice(null), 2500);
        }
      }
    } catch {
      setPasteNotice("Gunakan Ctrl+V untuk menempelkan link YouTube");
      setTimeout(() => setPasteNotice(null), 3000);
    }
  };

  const isProcessing =
    status === "downloading" ||
    status === "analyzing" ||
    status === "processing" ||
    status === "rendering";

  return (
    <section className="bg-[#0b171a] border border-[#18343b] rounded-2xl p-4 sm:p-5 shadow-xl mb-6 text-slate-100">
      {/* ============================================================== */}
      {/* BAGIAN A — UNIFIED COMMAND BAR (Baris 1)                        */}
      {/* ============================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch gap-3">
        {/* Kiri: Segmented switch [ Link YouTube | Upload File ] */}
        <div className="flex items-center gap-1 p-1 bg-[#071114] rounded-xl border border-[#163037] shrink-0 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setInputMode("youtube")}
            disabled={isProcessing}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              inputMode === "youtube"
                ? "bg-[#143d46] text-[#2cd3c6] shadow-[0_0_12px_rgba(44,211,198,0.25)] border border-[#2cd3c6]/40"
                : "text-[#7a969d] hover:text-white"
            }`}
          >
            <YoutubeIcon className="w-4 h-4 text-red-500" />
            <span>Link YouTube</span>
          </button>
          <button
            type="button"
            onClick={() => setInputMode("upload")}
            disabled={isProcessing}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              inputMode === "upload"
                ? "bg-[#143d46] text-[#2cd3c6] shadow-[0_0_12px_rgba(44,211,198,0.25)] border border-[#2cd3c6]/40"
                : "text-[#7a969d] hover:text-white"
            }`}
          >
            <Upload className="w-4 h-4 text-[#2cd3c6]" />
            <span>Upload File</span>
          </button>
        </div>

        {/* Tengah: Input URL YouTube ATAU Indikator File Video */}
        <div className="flex-1 min-w-0">
          {inputMode === "youtube" ? (
            <div className="relative group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-500 flex items-center pointer-events-none">
                <YoutubeIcon className="w-4 h-4" />
              </div>

              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isProcessing && youtubeUrl.trim()) {
                    onGenerate();
                  }
                }}
                disabled={isProcessing}
                placeholder="Paste YouTube Link here... contoh: https://www.youtube.com/watch?v=..."
                className={`w-full h-11 bg-[#0f2429] border ${
                  errorMessage
                    ? "border-red-500/60 focus:border-red-400"
                    : youtubeUrl.includes("youtu")
                    ? "border-[#20b2aa]/70 focus:border-[#2cd3c6]"
                    : "border-[#1c383f] focus:border-[#2cd3c6]"
                } rounded-xl pl-10 pr-24 text-xs sm:text-sm text-gray-200 placeholder-[#58737a] focus:outline-none transition shadow-inner font-sans`}
              />

              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {youtubeUrl.includes("youtu") && (
                  <span className="text-emerald-400 p-1" title="Link YouTube Valid">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                )}

                {youtubeUrl ? (
                  <button
                    type="button"
                    onClick={() => setYoutubeUrl("")}
                    disabled={isProcessing}
                    className="p-1 text-[#658188] hover:text-white rounded transition cursor-pointer"
                    title="Hapus Link"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    disabled={isProcessing}
                    className="px-2.5 py-1 rounded-md bg-[#183941] hover:bg-[#204953] text-[#2cd3c6] text-[11px] font-medium flex items-center gap-1 transition cursor-pointer shadow-xs"
                    title="Tempel dari Clipboard"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                    <span>Paste</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  setUploadedVideoFile(file);
                }
              }}
              onClick={() => videoFileInputRef.current?.click()}
              className={`h-11 rounded-xl border border-dashed px-3.5 flex items-center justify-between gap-3 transition cursor-pointer select-none ${
                isDragging
                  ? "bg-[#143d46] border-[#2cd3c6]"
                  : uploadedVideoFile
                  ? "bg-[#0f282f] border-[#2cd3c6]/60"
                  : "bg-[#0f2429] border-[#1c383f] hover:bg-[#132c32] hover:border-[#2cd3c6]/50"
              }`}
            >
              <input
                ref={videoFileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-matroska,video/webm,.mp4,.mov,.mkv,.webm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setUploadedVideoFile(file);
                }}
                className="hidden"
              />

              {uploadedVideoFile ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5 truncate">
                    <FileVideo className="w-4 h-4 text-[#2cd3c6] shrink-0" />
                    <span className="text-xs font-semibold text-white truncate">
                      {uploadedVideoFile.name}
                    </span>
                    <span className="text-[11px] text-[#7fa3aa] shrink-0">
                      ({(uploadedVideoFile.size / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadedVideoFile(null);
                    }}
                    className="p-1 rounded hover:bg-[#1a3840] text-[#7fa3aa] hover:text-white transition"
                    title="Ganti File"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-[#2cd3c6]" />
                    <span className="text-xs text-[#8ca4aa]">
                      Pilih atau seret file video (MP4 / MOV / MKV, maks 2GB)
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#163840] text-[#2cd3c6] text-[11px] font-medium border border-[#2cd3c6]/30">
                    Browse
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Kanan: Tombol Reset & Generate Clips */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onReset}
            disabled={isProcessing}
            title="Reset dan bersihkan seluruh input & hasil klip"
            className="h-11 px-3.5 rounded-xl border border-[#1f3b42] bg-[#0f2429] hover:bg-[#153239] hover:border-[#2cd3c6]/40 text-[#8da5ab] hover:text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer select-none disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#2cd3c6]" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={onGenerate}
            disabled={
              isProcessing ||
              (inputMode === "youtube" ? !youtubeUrl.trim() : !uploadedVideoFile)
            }
            className="h-11 px-6 rounded-xl text-xs sm:text-sm font-bold tracking-wide transition flex items-center justify-center gap-2 select-none bg-gradient-to-r from-[#17858c] via-[#20a3a7] to-[#2cd3c6] text-white shadow-[0_0_20px_rgba(44,211,198,0.3)] hover:shadow-[0_0_25px_rgba(44,211,198,0.5)] hover:brightness-110 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Clips</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Paste Notification Toast */}
      {pasteNotice && (
        <div className="mt-3 px-3 py-1.5 rounded-lg bg-[#143239] border border-[#20b2aa]/40 text-[#2cd3c6] text-xs flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>{pasteNotice}</span>
        </div>
      )}

      {/* Error Feedback */}
      {errorMessage && (
        <div className="mt-3 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2 animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span className="break-words">
            {errorMessage.includes("524") ||
            errorMessage.includes("Cloudflare") ||
            errorMessage.includes("A timeout occurred")
              ? "Server transkripsi sibuk atau file audio terlalu panjang, silakan coba beberapa saat lagi."
              : errorMessage.replace(/<[^>]*>?/gm, " ").trim()}
          </span>
        </div>
      )}

      {/* Status Message */}
      {statusMessage && !errorMessage && (
        <div className="mt-3 p-2.5 rounded-xl bg-[#112a30] border border-[#2cd3c6]/40 text-cyan-200 text-xs flex items-center gap-2">
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2cd3c6]" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* BAGIAN B — 4-COLUMN CLEAN BENTO GRID (Baris 2)                 */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-[#18343b]">
        {/* ============================================================ */}
        {/* KOLOM 1: OUTPUT TARGET (Kuantitas & Durasi)                  */}
        {/* ============================================================ */}
        <div className="bg-[#0e2126] border border-[#1b3a42] rounded-xl p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#18343b]">
              <div className="flex items-center gap-2 text-xs font-bold text-white tracking-wider uppercase">
                <Sliders className="w-3.5 h-3.5 text-[#2cd3c6]" />
                <span>Output Target</span>
              </div>
              <span className="text-[10px] text-[#719097] font-medium">Kuantitas & Durasi</span>
            </div>

            {/* Stepper Jumlah Klip */}
            <div className="mb-3.5">
              <div className="flex items-center justify-between text-xs text-[#8ca4aa] mb-1.5 font-medium">
                <span>Jumlah Klip:</span>
                <span className="text-white font-mono font-bold">{clipCount} Klip</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setClipCount(Math.max(1, clipCount - 1))}
                  disabled={isProcessing || clipCount <= 1}
                  className="w-8 h-8 rounded-lg bg-[#142d33] hover:bg-[#1a3840] border border-[#20444d] text-gray-200 flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
                  title="Kurangi Klip"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 h-8 rounded-lg bg-[#0a171a] border border-[#1c383f] flex items-center justify-center text-sm font-mono font-bold text-[#2cd3c6]">
                  {clipCount}
                </div>
                <button
                  type="button"
                  onClick={() => setClipCount(Math.min(10, clipCount + 1))}
                  disabled={isProcessing || clipCount >= 10}
                  className="w-8 h-8 rounded-lg bg-[#142d33] hover:bg-[#1a3840] border border-[#20444d] text-gray-200 flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
                  title="Tambah Klip"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick shortcut pills */}
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {[3, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setClipCount(num)}
                    disabled={isProcessing}
                    className={`h-6 rounded text-[11px] font-semibold transition cursor-pointer ${
                      clipCount === num
                        ? "bg-[#1b4952] text-[#2cd3c6] border border-[#2cd3c6]/40"
                        : "bg-[#12282e] text-[#7fa3aa] hover:text-white border border-[#1b3a42]"
                    }`}
                  >
                    {num} Klip
                  </button>
                ))}
              </div>
            </div>

            {/* Segmented Pill Durasi */}
            <div>
              <div className="flex items-center justify-between text-xs text-[#8ca4aa] mb-1.5 font-medium">
                <span>Target Durasi:</span>
                <span className="text-white font-mono font-bold">{targetDuration}s</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 bg-[#0a171a] p-1 rounded-lg border border-[#1c383f]">
                {[30, 45, 60].map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setTargetDuration(dur)}
                    disabled={isProcessing}
                    className={`h-7 rounded-md text-xs font-semibold transition cursor-pointer ${
                      targetDuration === dur
                        ? "bg-[#194a53] text-[#2cd3c6] shadow-sm font-bold border border-[#2cd3c6]/40"
                        : "text-[#7fa3aa] hover:text-white"
                    }`}
                  >
                    {dur}s
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* KOLOM 2: EDITING PIPELINE (Mode Komposisi Visual)            */}
        {/* ============================================================ */}
        <div className="bg-[#0e2126] border border-[#1b3a42] rounded-xl p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#18343b]">
              <div className="flex items-center gap-2 text-xs font-bold text-white tracking-wider uppercase">
                <Scissors className="w-3.5 h-3.5 text-[#2cd3c6]" />
                <span>Editing Pipeline</span>
              </div>
              <span className="text-[10px] text-[#719097] font-medium">4 Mode Nyata</span>
            </div>

            <div className="flex flex-col gap-2">
              {/* Option 1: raw_cut */}
              <button
                type="button"
                onClick={() => setPipelineMode("raw_cut")}
                disabled={isProcessing}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                  pipelineMode === "raw_cut"
                    ? "bg-[#143840] border-[#2cd3c6] shadow-[0_0_12px_rgba(44,211,198,0.2)]"
                    : "bg-[#0b1a1e] border-[#18343b] hover:border-[#204750]"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-bold text-white">Raw Cut 9:16</span>
                  {pipelineMode === "raw_cut" && <Check className="w-3.5 h-3.5 text-[#2cd3c6]" />}
                </div>
                <p className="text-[10px] text-[#7fa3aa] leading-tight">
                  Backdrop blur instan tanpa subtitle & header
                </p>
              </button>

              {/* Option 2: clean_subtitle */}
              <button
                type="button"
                onClick={() => setPipelineMode("clean_subtitle")}
                disabled={isProcessing}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                  pipelineMode === "clean_subtitle"
                    ? "bg-[#143840] border-[#2cd3c6] shadow-[0_0_12px_rgba(44,211,198,0.2)]"
                    : "bg-[#0b1a1e] border-[#18343b] hover:border-[#204750]"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-bold text-white">Clean Subtitle</span>
                  {pipelineMode === "clean_subtitle" && <Check className="w-3.5 h-3.5 text-[#2cd3c6]" />}
                </div>
                <p className="text-[10px] text-[#7fa3aa] leading-tight">
                  Backdrop blur 9:16 + burn-in subtitle .ass
                </p>
              </button>

              {/* Option 3: netflix_editorial */}
              <button
                type="button"
                onClick={() => setPipelineMode("netflix_editorial")}
                disabled={isProcessing}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                  pipelineMode === "netflix_editorial"
                    ? "bg-[#143840] border-[#2cd3c6] shadow-[0_0_12px_rgba(44,211,198,0.2)]"
                    : "bg-[#0b1a1e] border-[#18343b] hover:border-[#204750]"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-bold text-white">Netflix Editorial</span>
                  {pipelineMode === "netflix_editorial" && (
                    <Check className="w-3.5 h-3.5 text-[#2cd3c6]" />
                  )}
                </div>
                <p className="text-[10px] text-[#7fa3aa] leading-tight">
                  Hook Teaser + Motion Graphic + Subtitle
                </p>
              </button>

              {/* Option 4: clone_only (Sesuai Clone Saja) */}
              <button
                type="button"
                onClick={() => {
                  setPipelineMode("clone_only");
                  const cloned = presets.find((p) => p.isCloned || p.id.startsWith("cloned-") || p.id === "ai-cloned");
                  if (cloned) {
                    setSelectedPresetId(cloned.id);
                  }
                }}
                disabled={isProcessing}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                  pipelineMode === "clone_only"
                    ? "bg-[#143840] border-[#2cd3c6] shadow-[0_0_12px_rgba(44,211,198,0.2)]"
                    : "bg-[#0b1a1e] border-[#18343b] hover:border-[#204750]"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#2cd3c6]" />
                    <span className="text-xs font-bold text-white">Sesuai Clone Saja</span>
                  </div>
                  {pipelineMode === "clone_only" && (
                    <Check className="w-3.5 h-3.5 text-[#2cd3c6]" />
                  )}
                </div>
                <p className="text-[10px] text-[#7fa3aa] leading-tight">
                  Tiru 100% gaya & warna video referensi
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* KOLOM 3: STYLE & TYPOGRAPHY (Preset & Font Subtitle)         */}
        {/* ============================================================ */}
        <div className="bg-[#0e2126] border border-[#1b3a42] rounded-xl p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#18343b]">
              <div className="flex items-center gap-2 text-xs font-bold text-white tracking-wider uppercase">
                <Type className="w-3.5 h-3.5 text-[#2cd3c6]" />
                <span>Style & Typography</span>
              </div>
              <span className="text-[10px] text-[#719097] font-medium">Preset & Font</span>
            </div>

            {/* Dropdown Visual Preset */}
            <div className="mb-3.5">
              <label className="block text-xs font-medium text-[#8ca4aa] mb-1.5">
                Visual Preset:
              </label>
              <select
                value={selectedPresetId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedPresetId(newId);
                  const found = presets.find((p) => p.id === newId);
                  if (found) {
                    if (found.subtitleStyle?.fontName && SUBTITLE_FONTS.includes(found.subtitleStyle.fontName as any)) {
                      setSubtitleFont(found.subtitleStyle.fontName as any);
                    }
                    if (found.isCloned || found.pipelineMode === "clone_only") {
                      setPipelineMode("clone_only");
                    } else if (found.pipelineMode && (found.pipelineMode === "raw_cut" || found.pipelineMode === "clean_subtitle" || found.pipelineMode === "netflix_editorial")) {
                      setPipelineMode(found.pipelineMode as any);
                    }
                    if (typeof found.enableHook === "boolean") {
                      setEnableHook(found.enableHook);
                    }
                    if (typeof found.enablePolish === "boolean") {
                      setEnablePolish(found.enablePolish);
                    }
                  }
                }}
                disabled={isProcessing}
                className="w-full h-8 bg-[#0b1a1e] border border-[#1c383f] rounded-lg px-2 text-xs text-gray-200 focus:outline-none focus:border-[#2cd3c6] transition cursor-pointer"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0b171a] text-white">
                    {p.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-[#719097] mt-1 block truncate">
                Palet: {presets.find((p) => p.id === selectedPresetId)?.name || selectedPresetId}
              </span>
            </div>

            {/* Dropdown Subtitle Font */}
            <div>
              <label className="block text-xs font-medium text-[#8ca4aa] mb-1.5">
                Font Subtitle:
              </label>
              <select
                value={subtitleFont}
                onChange={(e) => setSubtitleFont(e.target.value)}
                disabled={isProcessing}
                className="w-full h-8 bg-[#0b1a1e] border border-[#1c383f] rounded-lg px-2 text-xs text-gray-200 focus:outline-none focus:border-[#2cd3c6] transition cursor-pointer"
              >
                {SUBTITLE_FONTS.map((font) => (
                  <option key={font} value={font} className="bg-[#0b171a] text-white">
                    {font}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-[#719097] mt-1 block truncate">
                Font aktif: <span className="text-[#2cd3c6] font-semibold">{subtitleFont}</span>
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* KOLOM 4: REFERENCE & POLISH (AI Style Cloner & Finishing)    */}
        {/* ============================================================ */}
        <div className="bg-[#0e2126] border border-[#1b3a42] rounded-xl p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#18343b]">
              <div className="flex items-center gap-2 text-xs font-bold text-white tracking-wider uppercase">
                <Wand2 className="w-3.5 h-3.5 text-[#2cd3c6]" />
                <span>Reference & Polish</span>
              </div>
              <span className="text-[10px] text-[#719097] font-medium">Cloner & Efek</span>
            </div>

            {/* AI Style Cloner Upload */}
            <div className="mb-3.5">
              <input
                type="file"
                ref={refFileInputRef}
                onChange={handleRefFileUpload}
                accept="video/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => refFileInputRef.current?.click()}
                disabled={isCloningStyle || isProcessing}
                className="w-full h-8 border border-dashed border-[#20444d] bg-[#0b1a1e] hover:bg-[#132c32] hover:border-[#2cd3c6]/60 rounded-lg px-2.5 text-[11px] text-[#93adb3] flex items-center justify-center gap-2 transition cursor-pointer select-none group"
              >
                {isCloningStyle ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-[#2cd3c6] animate-spin" />
                    <span>Cloning style...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5 text-[#2cd3c6] group-hover:scale-110 transition-transform" />
                    <span>Clone Video Style (5-15s)</span>
                  </>
                )}
              </button>

              {/* Status Badge Mode Clone Aktif & Tombol Batal Clone */}
              {hasActiveClone && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#143d46]/70 border border-[#2cd3c6]/50 mt-2 shadow-sm">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-[#2cd3c6] animate-pulse shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-bold text-[#2cd3c6] truncate">
                        Mode Clone Aktif: Siap Diterapkan ke Video
                      </span>
                      {tempCloneSummary ? (
                        <span className="text-[9px] text-[#8ca4aa] truncate">
                          {tempCloneSummary}
                        </span>
                      ) : refFileName ? (
                        <span className="text-[9px] text-[#8ca4aa] truncate">
                          Ref: {refFileName}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {onCancelClone && (
                    <button
                      type="button"
                      onClick={onCancelClone}
                      disabled={isProcessing}
                      className="px-2 py-1 text-[10px] font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 rounded transition cursor-pointer shrink-0 flex items-center gap-1"
                      title="Batalkan Clone dan Kembali ke Mode Reguler"
                    >
                      <X className="w-3 h-3" />
                      <span>Batal Clone</span>
                    </button>
                  )}
                </div>
              )}

              {!hasActiveClone && refFileName && (
                <div className="flex items-center gap-1.5 text-[10px] text-[#849ea4] truncate mt-1.5 px-1">
                  <FileText className="w-3 h-3 text-[#2cd3c6] shrink-0" />
                  <span className="truncate">{refFileName}</span>
                  <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                </div>
              )}
            </div>

            {/* Custom Background Music (BGM) Upload & Auto-Ducking */}
            <div className="mb-3.5 pt-2 border-t border-[#18343b]">
              <div className="flex items-center justify-between pb-1.5 mb-1.5">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#2cd3c6] flex items-center gap-1.5">
                  <Music className="w-3 h-3 text-[#2cd3c6]" />
                  Custom Backsound MP3
                </span>
                <span className="text-[9px] text-[#719097] font-medium">Groq AI Matcher</span>
              </div>

              <input
                type="file"
                ref={bgmFileInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadedBgmFile?.(file);
                  }
                }}
                accept="audio/*,.mp3,.wav,.m4a,.aac"
                className="hidden"
              />

              {!uploadedBgmFile ? (
                <button
                  type="button"
                  onClick={() => bgmFileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full h-8 border border-dashed border-[#20444d] bg-[#0b1a1e] hover:bg-[#132c32] hover:border-[#2cd3c6]/60 rounded-lg px-2.5 text-[11px] text-[#93adb3] flex items-center justify-center gap-2 transition cursor-pointer select-none group"
                >
                  <Music className="w-3.5 h-3.5 text-[#2cd3c6] group-hover:scale-110 transition-transform" />
                  <span>Pilih Musik Backsound (MP3/WAV)</span>
                </button>
              ) : (
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#0f282e] border border-[#2cd3c6]/50 shadow-sm">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Music className="w-3.5 h-3.5 text-[#2cd3c6] shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-bold text-white truncate">
                        {uploadedBgmFile.name}
                      </span>
                      <span className="text-[9px] text-[#2cd3c6]">
                        {(uploadedBgmFile.size / 1024 / 1024).toFixed(1)} MB • Auto-cut {targetDuration}s (Groq AI)
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedBgmFile?.(null);
                      if (bgmFileInputRef.current) bgmFileInputRef.current.value = "";
                    }}
                    disabled={isProcessing}
                    className="p-1 rounded text-rose-400 hover:text-white hover:bg-rose-900/50 transition cursor-pointer shrink-0"
                    title="Hapus file musik"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Auto-Ducking Info & Toggle */}
              {uploadedBgmFile && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#0b1a1e] border border-[#18343b] mt-1.5">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-white">Auto-Ducking Vokal (-20dB)</span>
                    <span className="text-[9px] text-[#719097]">Musik mengecil saat vokal bicara (Hook 4.5s)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableBgmDucking?.(!enableBgmDucking)}
                    disabled={isProcessing}
                    className={`w-9 h-4.5 flex items-center rounded-full p-0.5 transition cursor-pointer shrink-0 ${
                      enableBgmDucking ? "bg-[#2cd3c6] justify-end" : "bg-[#18343b] justify-start"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full bg-white shadow-md transform transition ${
                        enableBgmDucking ? "bg-[#0b171a]" : "bg-gray-400"
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            {/* Toggles: Cold-Open Hook & Cinema Polish */}
            <div className="flex flex-col gap-2 pt-1">
              {/* Toggle Cold-Open Hook */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#0b1a1e] border border-[#18343b]">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Cold-Open Hook (4.5s)</span>
                  <span className="text-[10px] text-[#719097]">Klimaks di detik 0-4.5</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableHook(!enableHook)}
                  disabled={isProcessing}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition cursor-pointer ${
                    enableHook ? "bg-[#2cd3c6] justify-end" : "bg-[#18343b] justify-start"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white shadow-md transform transition ${
                      enableHook ? "bg-[#0b171a]" : "bg-gray-400"
                    }`}
                  />
                </button>
              </div>

              {/* Toggle Cinema Vignette & SFX */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#0b1a1e] border border-[#18343b]">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Cinema Vignette & SFX</span>
                  <span className="text-[10px] text-[#719097]">Vignette + audio SFX</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEnablePolish(!enablePolish)}
                  disabled={isProcessing}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition cursor-pointer ${
                    enablePolish ? "bg-[#2cd3c6] justify-end" : "bg-[#18343b] justify-start"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white shadow-md transform transition ${
                      enablePolish ? "bg-[#0b171a]" : "bg-gray-400"
                    }`}
                  />
                </button>
              </div>

              {/* Fase 8: Motion Animation Toggles (Top Kinetic Header & Bottom Progress Bar) */}
              <div className="pt-2 border-t border-[#18343b] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-[#2cd3c6] flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-[#2cd3c6]" />
                    Motion Animation
                  </span>
                  {(hasActiveClone || pipelineMode === "clone_only") && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2cd3c6]/20 text-[#2cd3c6] font-semibold border border-[#2cd3c6]/40">
                      Clone Ready
                    </span>
                  )}
                </div>

                {/* Toggle Top Kinetic Header */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#0b1a1e] border border-[#18343b] hover:border-[#2cd3c6]/40 transition">
                  <div className="flex flex-col pr-2">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      Top Kinetic Header
                    </span>
                    <span className="text-[10px] text-[#719097]">
                      Header animasi 1080x480 (anti-tumpang tindih)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableCloneTopMotion?.(!enableCloneTopMotion)}
                    disabled={isProcessing}
                    className={`w-10 h-5 flex items-center rounded-full p-0.5 transition cursor-pointer shrink-0 ${
                      enableCloneTopMotion ? "bg-[#2cd3c6] justify-end" : "bg-[#18343b] justify-start"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white shadow-md transform transition ${
                        enableCloneTopMotion ? "bg-[#0b171a]" : "bg-gray-400"
                      }`}
                    />
                  </button>
                </div>

                {/* Toggle Bottom Kinetic Progress Bar */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#0b1a1e] border border-[#18343b] hover:border-[#2cd3c6]/40 transition">
                  <div className="flex flex-col pr-2">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      Bottom Progress Bar
                    </span>
                    <span className="text-[10px] text-[#719097]">
                      Kinetic bar dinamis + auto-safe margin teks
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableCloneBottomMotion?.(!enableCloneBottomMotion)}
                    disabled={isProcessing}
                    className={`w-10 h-5 flex items-center rounded-full p-0.5 transition cursor-pointer shrink-0 ${
                      enableCloneBottomMotion ? "bg-[#2cd3c6] justify-end" : "bg-[#18343b] justify-start"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white shadow-md transform transition ${
                        enableCloneBottomMotion ? "bg-[#0b171a]" : "bg-gray-400"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
