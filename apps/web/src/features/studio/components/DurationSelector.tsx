import { Clock } from "lucide-react";

export interface DurationOption {
  value: number;
  label: string;
  subLabel?: string;
  description: string;
}

export const DURATION_OPTIONS: DurationOption[] = [
  {
    value: 30,
    label: "30 Detik",
    subLabel: "30s",
    description: "Format kilat untuk YouTube Shorts & Instagram Reels",
  },
  {
    value: 45,
    label: "45 Detik",
    subLabel: "45s",
    description: "Durasi sweetspot viralitas tertinggi untuk story-driven clips",
  },
  {
    value: 60,
    label: "1 Menit",
    subLabel: "60s",
    description: "Klip mendalam dengan konteks utuh untuk TikTok & Reels",
  },
];

interface DurationSelectorProps {
  duration: number;
  setDuration: (duration: number) => void;
  disabled?: boolean;
}

export function DurationSelector({
  duration,
  setDuration,
  disabled = false,
}: DurationSelectorProps) {
  const currentOption =
    DURATION_OPTIONS.find((opt) => opt.value === duration) || DURATION_OPTIONS[1];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-[#8ca4aa] flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#2cd3c6]" />
          <span>Duration</span>
        </h3>
        <span className="text-[10px] text-[#2cd3c6] font-mono font-medium">
          {currentOption.label}
        </span>
      </div>

      {/* 3 Duration Buttons: 30 Detik, 45 Detik, 1 Menit */}
      <div className="grid grid-cols-3 gap-1.5 w-full max-w-[240px]">
        {DURATION_OPTIONS.map((option) => {
          const isActive = duration === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => setDuration(option.value)}
              title={`${option.label} (${option.subLabel}): ${option.description}`}
              className={`h-7 px-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? "bg-[#20b2aa] text-white shadow-[0_0_10px_rgba(32,178,170,0.5)] font-bold"
                  : "bg-[#14282e] text-[#8fa4aa] hover:bg-[#1a343c] hover:text-white"
              }`}
            >
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* Subtle duration hint */}
      <div className="mt-2 text-[10px] text-[#69858c] leading-tight truncate">
        {currentOption.description}
      </div>
    </div>
  );
}
