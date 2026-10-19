import { useState } from "react";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { DEFAULT_MOCK_PASSWORD } from "@/features/auth/mock-users";

export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [activePassword, setActivePassword] = useState(DEFAULT_MOCK_PASSWORD);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute password strength score (0 to 3)
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score++;

    if (score === 1) return { score: 1, label: "Lemah", color: "bg-red-500 text-red-400" };
    if (score === 2) return { score: 2, label: "Sedang", color: "bg-amber-500 text-amber-400" };
    return { score: 3, label: "Kuat", color: "bg-[#2cd3c6] text-[#2cd3c6]" };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation 1: Required fields
    if (!currentPassword) {
      setErrorMessage("Kata sandi saat ini wajib diisi.");
      return;
    }
    if (!newPassword) {
      setErrorMessage("Kata sandi baru wajib diisi.");
      return;
    }
    if (!confirmPassword) {
      setErrorMessage("Konfirmasi kata sandi baru wajib diisi.");
      return;
    }

    // Validation 2: Current password match
    if (currentPassword !== activePassword) {
      setErrorMessage(
        "Kata sandi saat ini tidak cocok. (Petunjuk demo: kata sandi bawaan adalah 'Password123!')"
      );
      return;
    }

    // Validation 3: New password differs from current
    if (newPassword === currentPassword) {
      setErrorMessage("Kata sandi baru tidak boleh sama dengan kata sandi saat ini.");
      return;
    }

    // Validation 4: Minimum length
    if (newPassword.length < 8) {
      setErrorMessage("Kata sandi baru minimal harus 8 karakter.");
      return;
    }

    // Validation 5: Complexity check
    const hasLetters = /[a-zA-Z]/.test(newPassword);
    const hasNumbers = /[0-9]/.test(newPassword);
    if (!hasLetters || !hasNumbers) {
      setErrorMessage("Kata sandi baru harus mengandung kombinasi huruf dan angka.");
      return;
    }

    // Validation 6: Confirmation match
    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }

    // Process update
    setIsSubmitting(true);
    setTimeout(() => {
      setActivePassword(newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsSubmitting(false);
      setSuccessMessage(
        "Kata sandi berhasil diperbarui! Silakan gunakan kata sandi baru untuk login sesi berikutnya."
      );
    }, 600);
  };

  return (
    <div className="rounded-2xl border border-[#1a363d] bg-[#0c1a1e]/90 p-5 sm:p-6 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-[#2cd3c6]" />
          <span>Keamanan & Ubah Kata Sandi</span>
        </h3>
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#133037] text-[#2cd3c6] border border-[#2cd3c6]/30 font-medium flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Terenkripsi</span>
        </span>
      </div>
      <p className="text-xs text-[#8ca4aa] mb-5">
        Perbarui kata sandi akun Anda secara berkala untuk menjaga keamanan akses studio & kuota rendering.
      </p>

      {/* Success Banner */}
      {successMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">{successMessage}</div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Password */}
        <div>
          <label className="block text-xs font-semibold text-[#8ca4aa] mb-1.5">
            Kata Sandi Saat Ini
          </label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Masukkan kata sandi saat ini..."
              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#0a171b] border border-[#1c3c44] text-white text-xs sm:text-sm focus:outline-none focus:border-[#2cd3c6] focus:ring-1 focus:ring-[#2cd3c6] transition"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-3 text-[#718b91] hover:text-white transition"
              title={showCurrent ? "Sembunyikan" : "Tampilkan"}
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-[#8ca4aa]">
              Kata Sandi Baru
            </label>
            {strength.label && (
              <span className={`text-[10px] font-bold ${strength.color}`}>
                Kekuatan: {strength.label}
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Minimal 8 karakter (huruf & angka)..."
              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#0a171b] border border-[#1c3c44] text-white text-xs sm:text-sm focus:outline-none focus:border-[#2cd3c6] focus:ring-1 focus:ring-[#2cd3c6] transition"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-3 text-[#718b91] hover:text-white transition"
              title={showNew ? "Sembunyikan" : "Tampilkan"}
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Strength meter bar */}
          {newPassword && (
            <div className="mt-2 flex items-center gap-1.5">
              <div
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  strength.score >= 1 ? strength.color.split(" ")[0] : "bg-[#183942]"
                }`}
              />
              <div
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  strength.score >= 2 ? strength.color.split(" ")[0] : "bg-[#183942]"
                }`}
              />
              <div
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  strength.score >= 3 ? strength.color.split(" ")[0] : "bg-[#183942]"
                }`}
              />
            </div>
          )}
        </div>

        {/* Confirm New Password */}
        <div>
          <label className="block text-xs font-semibold text-[#8ca4aa] mb-1.5">
            Konfirmasi Kata Sandi Baru
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Ulangi kata sandi baru..."
              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#0a171b] border border-[#1c3c44] text-white text-xs sm:text-sm focus:outline-none focus:border-[#2cd3c6] focus:ring-1 focus:ring-[#2cd3c6] transition"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-3 text-[#718b91] hover:text-white transition"
              title={showConfirm ? "Sembunyikan" : "Tampilkan"}
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
            className="px-5 py-2.5 rounded-xl bg-[#20b2aa] hover:bg-[#28c5bc] text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-[0_0_15px_rgba(32,178,170,0.3)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Lock className="w-4 h-4" />
            <span>{isSubmitting ? "Menyimpan..." : "Perbarui Kata Sandi"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

