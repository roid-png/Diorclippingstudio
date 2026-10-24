import { CheckCircle2, Loader2, Sparkles, Video, Cpu, Scissors } from "lucide-react";
import type { ProcessingStatus } from "../types";

interface ProcessingProgressBarProps {
  status: ProcessingStatus;
  progressPercent: number;
  currentStepMessage: string;
  step?: 1 | 2 | 3;
  currentClipIndex?: number;
  totalClips?: number;
  clippingLimit: number;
  duration: number;
  onCancel?: () => void;
}

export function ProcessingProgressBar({
  status,
  progressPercent,
  currentStepMessage,
  step,
  currentClipIndex,
  totalClips,
  clippingLimit,
  duration,
  onCancel,
}: ProcessingProgressBarProps) {
  if (status !== "downloading" && status !== "analyzing") {
    return null;
  }

  const currentStep =
    step ||
    (progressPercent >= 100
      ? 3
      : progressPercent >= 35
      ? 3
      : progressPercent >= 20
      ? 2
      : 1);

  const steps = [
    {
      id: 1,
      name: "Unduh Sumber",
      icon: Video,
      isDone: currentStep > 1,
      isActive: currentStep === 1,
      subtext: currentStep > 1 ? "Selesai ✓" : "Mengekstrak...",
    },
    {
      id: 2,
      name: "Analisis Momen Viral",
      icon: Cpu,
      isDone: currentStep > 2,
      isActive: currentStep === 2,
      subtext: currentStep > 2 ? "Selesai ✓" : currentStep === 2 ? "Kurasi AI..." : "Menunggu",
    },
    {
      id: 3,
      name: "Auto-Cut 9:16",
      icon: Scissors,
      isDone: progressPercent >= 100,
      isActive: currentStep === 3,
      subtext:
        progressPercent >= 100
          ? "Selesai ✓"
          : currentStep === 3 && currentClipIndex && totalClips
          ? `Klip ${currentClipIndex}/${totalClips}`
          : currentStep === 3
          ? "Merender..."
          : "Menunggu",
    },
  ];

  return (
    <div className="w-full bg-[#0c1f23] border border-[#20b2aa]/40 rounded-2xl p-4 sm:p-5 shadow-md mb-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#14353d] border border-[#2cd3c6]/40 flex items-center justify-center text-[#2cd3c6] shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin text-[#2cd3c6]" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <span>Sedang Memproses Klip Otomatis</span>
              <Sparkles className="w-3.5 h-3.5 text-[#2cd3c6]" />
            </h4>
            <p className="text-[11px] text-[#86a2a8] leading-tight">
              {currentStepMessage}
            </p>
          </div>
        </div>

        {/* Percentage & Badge */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <span className="text-xs font-mono font-bold text-[#2cd3c6] bg-[#14353d] px-2 py-0.5 rounded-lg border border-[#2cd3c6]/30">
            {progressPercent}%
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[11px] text-[#7d979e] hover:text-red-400 px-2 py-0.5 rounded transition cursor-pointer"
            >
              Batalkan
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar with Shimmer */}
      <div className="relative w-full h-2.5 bg-[#091518] rounded-full overflow-hidden p-0.5 border border-[#1e3c43] mb-4">
        <div
          className="h-full bg-gradient-to-r from-[#17858c] via-[#20b2aa] to-[#2cd3c6] rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(44,211,198,0.6)]"
          style={{ width: `${Math.max(5, progressPercent)}%` }}
        />
      </div>

      {/* 3 Step Visual Steppers */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1b3940]/60">
        {steps.map((step) => {
          const StepIcon = step.icon;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all ${
                step.isActive
                  ? "bg-[#14353d] border-[#2cd3c6]/60 text-white shadow-[0_0_10px_rgba(44,211,198,0.2)]"
                  : step.isDone
                  ? "bg-[#0f282e]/60 border-[#20b2aa]/30 text-[#8ba3a9]"
                  : "bg-[#0b1b1e]/40 border-transparent text-[#587278]"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                  step.isDone
                    ? "text-emerald-400"
                    : step.isActive
                    ? "text-[#2cd3c6] animate-pulse"
                    : "text-[#587278]"
                }`}
              >
                {step.isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : step.isActive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <StepIcon className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-semibold truncate leading-tight">
                  {step.name}
                </p>
                <p className="text-[9px] text-[#6e8a91] truncate">
                  {step.subtext}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="mt-3 flex items-center justify-between text-[10px] text-[#6f8b92]">
        <span>Target: {clippingLimit} klip berdurasi {duration} detik</span>
        <span className="font-mono">Format Vertikal 9:16 • 1080p 60fps</span>
      </div>
    </div>
  );
}
