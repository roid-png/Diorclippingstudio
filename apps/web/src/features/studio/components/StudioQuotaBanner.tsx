import { Zap, RefreshCw, Clock, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

interface StudioQuotaBannerProps {
  totalQuota: number;
  usedQuota: number;
  onResetQuota?: () => void;
  lastDeduction?: { amount: number; timestamp: number } | null;
}

export function StudioQuotaBanner({
  totalQuota = 50,
  usedQuota = 5,
  onResetQuota,
  lastDeduction,
}: StudioQuotaBannerProps) {
  const [isResetting, setIsResetting] = useState(false);
  const remainingQuota = Math.max(0, totalQuota - usedQuota);
  const percentUsed = Math.min(100, Math.round((usedQuota / totalQuota) * 100));
  const percentRemaining = Math.max(0, 100 - percentUsed);

  const showRecentBadge =
    lastDeduction && Date.now() - lastDeduction.timestamp < 10000;

  const isExhausted = remainingQuota === 0;
  const isLow = remainingQuota > 0 && remainingQuota <= 10;

  const handleSimulateReset = () => {
    setIsResetting(true);
    setTimeout(() => {
      onResetQuota?.();
      setIsResetting(false);
    }, 400);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 mb-6 transition-all duration-300 ${
        isExhausted
          ? "bg-gradient-to-r from-red-950/40 via-[#181116] to-[#0f1d21] border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
          : isLow
          ? "bg-gradient-to-r from-amber-950/30 via-[#1a1c1a] to-[#0f1d21] border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
          : "bg-gradient-to-r from-[#0d2228]/80 via-[#112a32]/60 to-[#0c181c]/90 border-[#20b2aa]/30 shadow-[0_4px_24px_rgba(19,111,124,0.15)]"
      }`}
    >
      {/* Background ambient glow */}
      <div
        className={`absolute -right-12 -top-12 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 ${
          isExhausted ? "bg-red-500" : isLow ? "bg-amber-400" : "bg-[#2cd3c6]"
        }`}
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Section: Icon & Sisa Kuota Information */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-inner ${
              isExhausted
                ? "bg-red-500/20 text-red-400 border-red-500/30"
                : isLow
                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                : "bg-[#134954]/50 text-[#2cd3c6] border-[#20b2aa]/30"
            }`}
          >
            {isExhausted ? (
              <AlertTriangle className="w-5 h-5" />
            ) : isLow ? (
              <Zap className="w-5 h-5 animate-pulse" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Sisa Kuota Klip Hari Ini:
              </h2>
              <span
                className={`font-mono text-base sm:text-lg font-black px-2.5 py-0.5 rounded-lg border tracking-tight ${
                  isExhausted
                    ? "bg-red-500/20 text-red-400 border-red-500/40"
                    : isLow
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-[#123941] text-[#2cd3c6] border-[#2cd3c6]/40"
                }`}
              >
                {remainingQuota} / {totalQuota} Klip
              </span>
              {showRecentBadge && (
                <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold animate-in fade-in zoom-in-95 duration-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>-{lastDeduction?.amount} Klip Selesai Dipotong!</span>
                </span>
              )}
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700 font-medium">
                Maks. 10 klip / proses
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[#8ca4aa]">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#2cd3c6]" />
                <span>Reset otomatis setiap hari pukul <strong>00:00 WIB</strong></span>
              </span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="flex items-center gap-1 text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Total 50 Klip/Hari per akun</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Progress & Action Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Progress bar and numeric label */}
          <div className="w-full sm:w-44 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-[11px] text-[#8ca4aa] font-medium">
              <span>Pemakaian</span>
              <span className="text-white font-mono">{percentUsed}% ({usedQuota} terpakai)</span>
            </div>
            <div className="h-2 w-full bg-[#0a171b] rounded-full overflow-hidden border border-[#183942]">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isExhausted
                    ? "bg-gradient-to-r from-red-600 to-red-400"
                    : isLow
                    ? "bg-gradient-to-r from-amber-500 to-amber-300"
                    : "bg-gradient-to-r from-[#136f7c] to-[#2cd3c6]"
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onResetQuota && (
              <button
                type="button"
                onClick={handleSimulateReset}
                disabled={isResetting}
                title="Simulasi Reset Kuota Harian (00:00 WIB)"
                className="px-2.5 py-1.5 rounded-xl bg-[#14282e] hover:bg-[#1c3841] border border-[#20b2aa]/30 text-xs font-semibold text-[#8ca4aa] hover:text-white flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin text-[#2cd3c6]" : ""}`} />
                <span className="hidden sm:inline">Reset Kuota</span>
              </button>
            )}

            <Link
              to="/project-history"
              className="px-3 py-1.5 rounded-xl bg-[#136f7c]/50 hover:bg-[#136f7c] border border-[#2cd3c6]/40 text-xs font-semibold text-[#2cd3c6] hover:text-white flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>Riwayat Proyek</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Warning message if quota is exhausted */}
      {isExhausted && (
        <div className="mt-3 pt-3 border-t border-red-500/20 flex items-center justify-between text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              Kuota pemotongan video hari ini telah habis (50/50). Tunggu reset otomatis pukul 00:00 WIB atau tekan tombol <strong>Reset Kuota</strong> di atas untuk simulasi demo.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

