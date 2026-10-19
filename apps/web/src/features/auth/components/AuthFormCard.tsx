import { useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  Layers,
  LoaderCircle,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { siteConfig } from "@/config/site";
import {
  DEFAULT_MOCK_PASSWORD,
  MOCK_USERS,
  type MockUserAccount,
} from "../mock-users";

interface AuthFormCardProps {
  mode: "sign-in" | "sign-up";
}

export function AuthFormCard({ mode }: AuthFormCardProps) {
  const signingUp = mode === "sign-up";
  const router = useRouter();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [selectedDemoUser, setSelectedDemoUser] = useState<string | null>(null);

  function handleSelectMockUser(user: MockUserAccount) {
    setSelectedDemoUser(user.id);
    setName(user.name);
    setEmail(user.email);
    setPassword(DEFAULT_MOCK_PASSWORD);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError("");

    try {
      const credentials = {
        email: email.trim(),
        password,
      };

      const result = signingUp
        ? await authClient.signUp.email({
            ...credentials,
            name: name.trim() || "Klip Creator",
          })
        : await authClient.signIn.email(credentials);

      if (result.error) {
        // If sign-in failed on mock user because user not yet registered in Better Auth,
        // automatically auto-register the mock user and sign in!
        if (!signingUp && selectedDemoUser) {
          const mockUser = MOCK_USERS.find((u) => u.id === selectedDemoUser);
          if (mockUser) {
            const signupRes = await authClient.signUp.email({
              email: mockUser.email,
              password: DEFAULT_MOCK_PASSWORD,
              name: mockUser.name,
            });

            if (!signupRes.error) {
              await router.invalidate();
              await navigate({ to: siteConfig.homePath, replace: true });
              return;
            }
          }
        }

        setError(
          result.error.message ||
            (signingUp
              ? "Gagal membuat akun baru. Silakan periksa data Anda."
              : "Email atau kata sandi tidak sesuai. Anda dapat menggunakan tombol Akun Tiruan di bawah.")
        );
        return;
      }

      await router.invalidate();
      await navigate({ to: siteConfig.homePath, replace: true });
    } catch {
      setError(
        "Koneksi ke server otentikasi bermasalah. Pastikan API server aktif."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      {/* Quota & Feature Highlight Banner */}
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-[#0a191d] to-purple-950/40 p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-400">
                Akses Studio Instan
              </span>
              <h4 className="text-xs font-bold text-white">
                50 Kuota Potong Klip per Hari
              </h4>
            </div>
          </div>
          <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 text-[11px] font-semibold text-cyan-300">
            Gratis Reset 00:00
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-300">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span>Auto-Cut Viral</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-purple-400 shrink-0" />
            <span>Preset 3 Pilar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>Akselerasi NVENC</span>
          </div>
        </div>
      </div>

      {/* Main Auth Card */}
      <div className="rounded-2xl border border-[#1e3c45] bg-[#09171b]/95 p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
        {/* Navigation Tabs between Sign In and Sign Up */}
        <div className="grid grid-cols-2 rounded-xl bg-[#061013] p-1 border border-[#14282e]">
          <Link
            to="/sign-in"
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs sm:text-sm font-bold transition-all ${
              !signingUp
                ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Masuk ke Studio
          </Link>
          <Link
            to="/sign-up"
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs sm:text-sm font-bold transition-all ${
              signingUp
                ? "bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Daftar Akun Baru
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-black text-white">
            {signingUp ? "Buat Akun Studio Baru" : "Selamat Datang Kembali"}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-300">
            {signingUp
              ? "Dapatkan langsung 50 kuota klip harian dan mulai potong video YouTube Anda secara otomatis."
              : "Masuk untuk melanjutkan proses rendering, konfigurasi 3 pilar, dan riwayat proyek."}
          </p>
        </div>

        {/* 1-Click Mock Accounts / Demo Profiles */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              Pilih Akun Tiruan untuk Masuk Cepat
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">1-Klik Isi Form</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {MOCK_USERS.map((user) => {
              const isSelected = selectedDemoUser === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelectMockUser(user)}
                  className={`group relative flex flex-col items-start rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-950/40 shadow-md ring-1 ring-cyan-400/50"
                      : "border-[#19353c] bg-[#0c1c21] hover:border-slate-500 hover:bg-[#10242b]"
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-1">
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="h-7 w-7 rounded-full object-cover border border-white/20"
                    />
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${user.badgeColor}`}
                    >
                      {user.badge}
                    </span>
                  </div>
                  <span className="mt-2 text-xs font-bold text-white truncate w-full">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate w-full">
                    {user.email}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Inputs */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          aria-busy={pending}
          aria-describedby={error ? "auth-error" : undefined}
        >
          <fieldset disabled={pending} className="space-y-4">
            <legend className="sr-only">
              {signingUp ? "Formulir Pendaftaran" : "Formulir Masuk"}
            </legend>

            {signingUp && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-slate-200">
                  Nama Lengkap
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Nama lengkap atau channel"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="pl-9 bg-[#061215] border-[#1e3c45] text-white text-xs sm:text-sm focus-visible:ring-cyan-500"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-200">
                Alamat Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="contoh@diorclipping.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-9 bg-[#061215] border-[#1e3c45] text-white text-xs sm:text-sm focus-visible:ring-cyan-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold text-slate-200"
                >
                  Kata Sandi
                </Label>
                {signingUp && (
                  <span className="text-[11px] text-slate-400">Minimal 8 karakter</span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={signingUp ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="pl-9 pr-10 bg-[#061215] border-[#1e3c45] text-white text-xs sm:text-sm focus-visible:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                  aria-label={showPassword ? "Sembunyikan sandi" : "Tampilkan sandi"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                id="auth-error"
                role="alert"
                className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs leading-relaxed text-rose-300"
              >
                {error}
              </div>
            )}

            <Button
              className={`w-full py-2.5 font-bold text-white shadow-lg transition-all ${
                signingUp
                  ? "bg-gradient-to-r from-purple-600 hover:from-purple-500 to-indigo-600 hover:to-indigo-500 shadow-purple-900/30"
                  : "bg-gradient-to-r from-cyan-600 hover:from-cyan-500 to-blue-600 hover:to-blue-500 shadow-cyan-900/30"
              }`}
              type="submit"
              size="lg"
              disabled={pending}
            >
              {pending ? (
                <LoaderCircle
                  className="animate-spin h-4 w-4 mr-2"
                  aria-hidden="true"
                />
              ) : null}
              {pending
                ? "Memproses..."
                : signingUp
                ? "Buat Akun & Dapatkan 50 Kuota"
                : "Masuk ke Studio Klip Viral"}
              {!pending && <ArrowRight className="h-4 w-4 ml-1.5" aria-hidden="true" />}
            </Button>
          </fieldset>
        </form>

        {/* Footer switch prompt */}
        <div className="border-t border-[#14292f] pt-4 text-center">
          <p className="text-xs text-slate-400">
            {signingUp ? "Sudah memiliki akun studio?" : "Belum memiliki akun?"}{" "}
            <Link
              to={signingUp ? "/sign-in" : "/sign-up"}
              className="font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-4"
            >
              {signingUp ? "Masuk Sekarang" : "Daftar Gratis 50 Kuota/Hari"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

