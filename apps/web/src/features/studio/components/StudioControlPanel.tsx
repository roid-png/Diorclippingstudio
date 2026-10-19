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
  RotateCcw,
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
}

interface StudioControlPanelProps {
  youtubeUrl: string;
  setYoutubeUrl: (url: string) => void;
  clippingLimit: number;
  setClippingLimit: (limit: number) => void;
  duration: number;
  setDuration: (duration: number) => void;
  presets: DynamicPresetItem[];
  selectedPresetId: string;
  setSelectedPresetId: (id: string) => void;
  enableMotionGraphic: boolean;
  setEnableMotionGraphic: (enabled: boolean) => void;
  refFileName: string;
  setRefFileName: (name: string) => void;
  onUploadReferenceVideo?: (file: File) => void;
  isCloningStyle?: boolean;
  status: string;
  statusMessage: string;
  onGenerate: () => void;
  onReset: () => void;
  errorMessage: string | null;
}

export function StudioControlPanel({
  youtubeUrl,
  setYoutubeUrl,
  clippingLimit,
  setClippingLimit,
  duration,
  setDuration,
  presets,
  selectedPresetId,
  setSelectedPresetId,
  enableMotionGraphic,
  setEnableMotionGraphic,
  refFileName,
  setRefFileName,
  onUploadReferenceVideo,
  isCloningStyle = false,
  status,
  statusMessage,
  onGenerate,
  onReset,
  errorMessage,
}: StudioControlPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const isProcessing =
    status === "downloading" ||
    status === "analyzing" ||
    status === "processing" ||
    status === "rendering";

  return (
    <section className="bg-[#0e2125]/90 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-4 sm:p-5 shadow-2xl mb-6 text-slate-100">
      {/* Baris 1: Input URL YouTube + Tombol aksi utama "AUTO-CUT & GENERATE 🚀" + Tombol kecil "Reset / Bersihkan" */}
      <div className="flex flex-col md:flex-row items-stretch gap-3 mb-4">
        {/* Input container */}
        <div className="relative flex-1 group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-500 flex items-center pointer-events-none">
            <YoutubeIcon className="w-5 h-5" />
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
            placeholder="Paste YouTube Link here... contoh: https://www.youtube.com/watch?v=..."
            className={`w-full h-11 bg-[#14282e] border ${
              errorMessage
                ? "border-red-500/60 focus:border-red-400"
                : youtubeUrl.includes("youtu")
                ? "border-[#20b2aa]/70 focus:border-[#2cd3c6]"
                : "border-[#1f3e46] focus:border-[#2cd3c6]"
            } rounded-xl pl-11 pr-24 text-xs sm:text-sm text-gray-200 placeholder-[#58737a] focus:outline-none transition shadow-inner font-sans`}
          />

          {/* Quick Action Buttons inside Input */}
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {youtubeUrl.includes("youtu") && (
              <span className="text-emerald-400 p-1" title="Link YouTube Valid">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            )}

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
          </div>
        </div>

        {/* Action Buttons: Reset / Bersihkan + AUTO-CUT & GENERATE 🚀 */}
        <div className="flex items-center gap-2">
          {/* Tombol kecil "Reset / Bersihkan" di samping input */}
          <button
            type="button"
            onClick={onReset}
            disabled={isProcessing}
            title="Reset dan bersihkan seluruh input & hasil klip ke kondisi kosong"
            className="h-11 px-3.5 rounded-xl border border-[#23454d] bg-[#14282e] hover:bg-[#1a343b] hover:border-[#2cd3c6]/40 text-[#8da5ab] hover:text-white text-xs font-medium flex items-center gap-1.5 transition select-none cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#2cd3c6]" />
            <span className="hidden sm:inline">Reset / Bersihkan</span>
          </button>

          {/* Tombol aksi utama "AUTO-CUT & GENERATE 🚀" (gradasi teal menyala) */}
          <button
            type="button"
            onClick={onGenerate}
            disabled={isProcessing || !youtubeUrl.trim()}
            className="h-11 px-6 sm:px-7 rounded-xl text-xs sm:text-sm font-bold tracking-wider transition-all flex items-center justify-center gap-2 shrink-0 select-none bg-gradient-to-r from-[#17858c] via-[#20a3a7] to-[#2cd3c6] text-white shadow-[0_0_20px_rgba(44,211,198,0.35)] hover:shadow-[0_0_25px_rgba(44,211,198,0.55)] hover:brightness-110 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>MEMPROSES KLIP...</span>
              </>
            ) : (
              <span>AUTO-CUT & GENERATE 🚀</span>
            )}
          </button>
        </div>
      </div>

      {/* Paste notification toast */}
      {pasteNotice && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-[#143239] border border-[#20b2aa]/40 text-[#2cd3c6] text-xs flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{pasteNotice}</span>
        </div>
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

      {/* Baris 2: 4 Kolom Pengaturan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-[#1a3339]">
        {/* Kolom 1: Clipping Limit (tombol angka 1 sampai 10) */}
        <div className="flex flex-col justify-between">
          <label className="text-xs font-semibold text-[#8ca4aa] mb-2 flex items-center justify-between">
            <span>Clipping Limit</span>
            <span className="text-[#2cd3c6] font-bold font-mono text-xs">{clippingLimit} Klip</span>
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              const isSelected = clippingLimit === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setClippingLimit(num)}
                  disabled={isProcessing}
                  className={`h-8 rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? "bg-gradient-to-r from-[#17858c] to-[#2cd3c6] text-white shadow-[0_0_10px_rgba(44,211,198,0.3)] border border-[#2cd3c6]"
                      : "bg-[#14282e] hover:bg-[#1a333a] text-[#8ea5aa] border border-[#1f3e46]"
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>

        {/* Kolom 2: Duration (tombol pill pilihan 30 Detik, 45 Detik, dan 60 Detik) */}
        <div className="flex flex-col justify-between">
          <label className="text-xs font-semibold text-[#8ca4aa] mb-2 flex items-center justify-between">
            <span>Target Durasi</span>
            <span className="text-[#2cd3c6] font-bold font-mono text-xs">{duration}s</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[30, 45, 60].map((dur) => {
              const isSelected = duration === dur;
              return (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setDuration(dur)}
                  disabled={isProcessing}
                  className={`h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? "bg-gradient-to-r from-[#17858c] to-[#2cd3c6] text-white shadow-[0_0_10px_rgba(44,211,198,0.3)] border border-[#2cd3c6]"
                      : "bg-[#14282e] hover:bg-[#1a333a] text-[#8ea5aa] border border-[#1f3e46]"
                  }`}
                >
                  {dur} Detik
                </button>
              );
            })}
          </div>
        </div>

        {/* Kolom 3: AI Style Cloner 🪄 (area upload dashed untuk video referensi 5-15s) */}
        <div className="flex flex-col justify-between">
          <label className="text-xs font-semibold text-[#8ca4aa] mb-2 flex items-center gap-1">
            <span>AI Style Cloner</span>
            <span>🪄</span>
          </label>
          <div className="flex flex-col gap-1.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="video/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCloningStyle || isProcessing}
              className="w-full h-8 border border-dashed border-[#294c53] bg-[#14282e]/50 hover:bg-[#173038] hover:border-[#2cd3c6]/60 rounded-xl px-2.5 text-[11px] text-[#93adb3] flex items-center justify-center gap-1.5 cursor-pointer transition select-none group"
            >
              {isCloningStyle ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-[#2cd3c6] animate-spin" />
                  <span>Menganalisis Gaya...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 text-[#2cd3c6] group-hover:scale-110 transition-transform" />
                  <span>Upload Ref Video (5-15s)</span>
                </>
              )}
            </button>

            {refFileName && (
              <div className="flex items-center gap-1.5 text-[10px] text-[#849ea4] truncate px-1">
                <FileText className="w-3 h-3 text-[#8fa4aa] shrink-0" />
                <span className="truncate">{refFileName}</span>
                <span className="text-emerald-400 font-medium shrink-0">✅</span>
              </div>
            )}
          </div>
        </div>

        {/* Kolom 4: Subtitle & Motion Preset (pilihan preset dinamis dari /api/presets + Toggle Switch Motion Graphic) */}
        <div className="flex flex-col justify-between">
          <label className="text-xs font-semibold text-[#8ca4aa] mb-2 flex items-center justify-between">
            <span>Gaya & Motion Preset</span>
          </label>
          <div className="flex flex-col gap-2">
            {/* Dropdown / Preset Selector */}
            <select
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              disabled={isProcessing}
              className="w-full h-8 bg-[#14282e] border border-[#1f3e46] rounded-xl px-2.5 text-xs text-gray-200 focus:outline-none focus:border-[#2cd3c6] transition cursor-pointer"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0e2125] text-white">
                  {p.name}
                </option>
              ))}
            </select>

            {/* Toggle Switch: Auto Motion Graphic (Progress Bar & Zoom) */}
            <label className="flex items-center justify-between px-1 cursor-pointer select-none group">
              <span className="text-[11px] text-[#8ca4aa] group-hover:text-gray-200 transition">
                Auto Motion Graphic
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enableMotionGraphic}
                onClick={() => setEnableMotionGraphic(!enableMotionGraphic)}
                disabled={isProcessing}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enableMotionGraphic ? "bg-[#2cd3c6]" : "bg-[#1b343b]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    enableMotionGraphic ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
