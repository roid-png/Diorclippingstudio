import { Scissors, Zap, AlertTriangle } from "lucide-react";

interface ClippingLimitSelectorProps {
  clippingLimit: number;
  setClippingLimit: (limit: number) => void;
  totalQuota?: number;
  usedQuota?: number;
  disabled?: boolean;
}

export function ClippingLimitSelector({
  clippingLimit,
  setClippingLimit,
  totalQuota = 50,
  usedQuota = 5,
  disabled = false,
}: ClippingLimitSelectorProps) {
  const remainingQuota = Math.max(0, totalQuota - usedQuota);
  const isExceedingQuota = clippingLimit > remainingQuota;
  const quotaPercent = Math.min(100, Math.round((usedQuota / totalQuota) * 100));

  return (
    <div className="flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-[#8ca4aa] flex items-center gap-1.5">
          <Scissors className="w-3.5 h-3.5 text-[#2cd3c6]" />
          <span>Clipping Limit</span>
        </h3>
        <span className="text-[10px] text-[#2cd3c6] font-mono font-bold bg-[#133037] px-1.5 py-0.5 rounded border border-[#2cd3c6]/30">
          {clippingLimit} Klip
        </span>
      </div>

      {/* Grid 1 to 10 */}
      <div className="grid grid-cols-5 gap-1.5 w-full max-w-[210px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
          const isActive = clippingLimit === num;
          const isDisabled = disabled || num > remainingQuota;

          return (
            <button
              key={num}
              type="button"
              disabled={isDisabled}
              onClick={() => setClippingLimit(num)}
              className={`h-7 rounded-lg text-xs font-semibold transition-all flex items-center justify-center select-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                isActive
                  ? "bg-[#20b2aa] text-white shadow-[0_0_10px_rgba(32,178,170,0.5)] font-bold scale-[1.02]"
                  : "bg-[#14282e] text-[#8fa4aa] hover:bg-[#1a343c] hover:text-white"
              }`}
            >
              {num}
            </button>
          );
        })}
      </div>

      {/* Sisa Kuota Display */}
      <div className="mt-2 pt-1.5 border-t border-[#1b373e]/50 flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[#849ea4] flex items-center gap-1 font-medium">
            <Zap className="w-3 h-3 text-[#2cd3c6]" />
            <span>Sisa Kuota:</span>
          </span>
          <span className="text-white font-mono font-semibold">
            <span className="text-[#2cd3c6]">{remainingQuota}</span>
            <span className="text-[#59787f]"> / {totalQuota}</span>
          </span>
        </div>

        {/* Quota Progress Bar */}
        <div className="w-full h-1 bg-[#122328] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isExceedingQuota ? "bg-amber-400" : "bg-[#2cd3c6]"
            }`}
            style={{ width: `${quotaPercent}%` }}
          />
        </div>

        {/* Warning if exceeding */}
        {isExceedingQuota ? (
          <div className="flex items-center gap-1 text-[10px] text-amber-400 mt-0.5">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>Melebihi sisa kuota</span>
          </div>
        ) : (
          <div className="text-[10px] text-[#59787f] leading-tight">
            Memotong {clippingLimit} klip dari sisa kuota
          </div>
        )}
      </div>
    </div>
  );
}
