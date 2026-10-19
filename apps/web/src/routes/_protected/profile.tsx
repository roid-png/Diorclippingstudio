import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  User,
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Camera,
  ArrowRight,
  Save,
  Film,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import {
  getPersistentSession,
  savePersistentSession,
  resetPersistentUserQuota,
  DEFAULT_DEMO_USER,
  type StoredSessionUser,
} from "@/features/auth/session-storage";
import { DEFAULT_AVATARS, type DefaultAvatarOption } from "@/features/auth/default-avatars";

export const Route = createFileRoute("/_protected/profile")({
  head: () => ({ meta: [{ title: `Profil Pengguna & Avatar | ${siteConfig.name}` }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const [sessionUser, setSessionUser] = useState<StoredSessionUser>(DEFAULT_DEMO_USER);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>(
    DEFAULT_DEMO_USER.avatarUrl || "/images/michael_avatar.png"
  );
  const [fullName, setFullName] = useState<string>(DEFAULT_DEMO_USER.name);
  const [bio, setBio] = useState<string>(
    "Kreator video pendek fokus YouTube Shorts & TikTok viral. Menggunakan preset THEO 5-FIX."
  );
  const [isSavedAlert, setIsSavedAlert] = useState<boolean>(false);
  const [isResettingQuota, setIsResettingQuota] = useState<boolean>(false);

  useEffect(() => {
    const current = getPersistentSession();
    if (current) {
      setSessionUser(current);
      if (current.avatarUrl) {
        setSelectedAvatarUrl(current.avatarUrl);
      }
      setFullName(current.name);
    }
  }, []);

  const handleSelectAvatar = (avatar: DefaultAvatarOption) => {
    setSelectedAvatarUrl(avatar.url);
    const updated = savePersistentSession({
      ...sessionUser,
      avatarUrl: avatar.url,
    });
    setSessionUser(updated);
    setIsSavedAlert(true);
    setTimeout(() => setIsSavedAlert(false), 3000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    const updated = savePersistentSession({
      ...sessionUser,
      name: fullName.trim(),
      avatarUrl: selectedAvatarUrl,
    });
    setSessionUser(updated);
    setIsSavedAlert(true);
    setTimeout(() => setIsSavedAlert(false), 3500);
  };

  const handleResetQuota = () => {
    setIsResettingQuota(true);
    setTimeout(() => {
      const reset = resetPersistentUserQuota();
      setSessionUser(reset);
      setIsResettingQuota(false);
      setIsSavedAlert(true);
      setTimeout(() => setIsSavedAlert(false), 3000);
    }, 400);
  };

  const remainingQuota = Math.max(0, sessionUser.dailyQuota - sessionUser.usedQuota);
  const percentUsed = Math.min(
    100,
    Math.round((sessionUser.usedQuota / sessionUser.dailyQuota) * 100)
  );

  return (
    <div className="w-full text-slate-100 max-w-5xl mx-auto pb-12">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between py-2 px-1 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/app" className="text-[#6d868c] hover:text-[#2cd3c6] transition">
            Dashboard
          </Link>
          <span className="text-[#3c565d]">/</span>
          <span className="text-[#6d868c]">Akun & Kuota</span>
          <span className="text-[#3c565d]">/</span>
          <span className="text-white font-medium tracking-wide">Profil Pengguna</span>
        </div>

        <Link
          to="/app"
          className="px-3 py-1.5 rounded-xl bg-[#142f36] hover:bg-[#1b3e47] border border-[#20b2aa]/40 text-[#2cd3c6] text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <Film className="w-3.5 h-3.5" />
          <span>Kembali ke Studio</span>
        </Link>
      </div>

      {/* Save Success Alert Banner */}
      {isSavedAlert && (
        <div className="mb-6 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-medium">
            Perubahan profil berhasil disimpan! Avatar dan identitas akun telah disinkronkan.
          </span>
        </div>
      )}

      {/* Header Profile Identity Card */}
      <div className="relative overflow-hidden rounded-2xl border border-[#1b373e] bg-gradient-to-r from-[#0a1a1e] via-[#0d2228] to-[#071316] p-6 mb-8 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#136f7c]/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Main Avatar Preview with Active Ring */}
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-[#2cd3c6] shadow-[0_0_20px_rgba(44,211,198,0.3)] bg-[#12282e]">
                <img
                  src={selectedAvatarUrl}
                  alt={sessionUser.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div
                title="Avatar Bawaan Aktif"
                className="absolute -bottom-1.5 -right-1.5 p-1 rounded-full bg-[#0a171a] border border-[#2cd3c6] text-[#2cd3c6]"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                  {sessionUser.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  {sessionUser.badge || "Content Creator"}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#133037] text-[#2cd3c6] border border-[#2cd3c6]/30">
                  ID: {sessionUser.id}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#8ca4aa] mb-3">{sessionUser.email}</p>

              {/* Status pills */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e242b] border border-[#1b3d45] text-slate-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Akun Terverifikasi</span>
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 font-semibold">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>50 Klip / Hari</span>
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e242b] border border-[#1b3d45] text-[#8ca4aa]">
                  <Clock className="w-3.5 h-3.5 text-[#2cd3c6]" />
                  <span>Reset 00:00 WIB</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quota Overview Meter */}
          <div className="w-full md:w-64 p-4 rounded-xl bg-[#09171b]/90 border border-[#16353d] flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8ca4aa] flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-[#2cd3c6]" />
                <span>Sisa Kuota Hari Ini</span>
              </span>
              <span className="font-mono font-bold text-white">
                <span className="text-[#2cd3c6] text-sm">{remainingQuota}</span>
                <span className="text-[#59787f]"> / {sessionUser.dailyQuota}</span>
              </span>
            </div>

            <div className="h-2 w-full bg-[#0d2228] rounded-full overflow-hidden border border-[#1a3d46]">
              <div
                className="h-full bg-gradient-to-r from-[#136f7c] to-[#2cd3c6] transition-all duration-300"
                style={{ width: `${percentUsed}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#718b91] pt-1">
              <span>{sessionUser.usedQuota} klip terpotong</span>
              <button
                type="button"
                onClick={handleResetQuota}
                disabled={isResettingQuota}
                className="text-[#2cd3c6] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isResettingQuota ? "animate-spin" : ""}`} />
                <span>Reset Demo</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Avatar Bawaan Gallery */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="rounded-2xl border border-[#1a363d] bg-[#0c1a1e]/90 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#2cd3c6]" />
                  <span>Pilih Avatar Bawaan</span>
                </h2>
                <p className="text-xs text-[#8ca4aa] mt-0.5">
                  Pilih salah satu avatar bawaan untuk merepresentasikan gaya dan persona konten Anda.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#133037] text-[#2cd3c6] border border-[#2cd3c6]/30 font-medium">
                {DEFAULT_AVATARS.length} Pilihan Avatar
              </span>
            </div>

            {/* Grid of Default Avatars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {DEFAULT_AVATARS.map((avatar) => {
                const isSelected = selectedAvatarUrl === avatar.url;

                return (
                  <div
                    key={avatar.id}
                    onClick={() => handleSelectAvatar(avatar)}
                    className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-3.5 text-left ${
                      isSelected
                        ? "bg-[#13323a]/90 border-[#2cd3c6] shadow-[0_0_15px_rgba(44,211,198,0.25)] ring-1 ring-[#2cd3c6]"
                        : "bg-[#0f2125]/70 border-[#1a373e] hover:bg-[#142d33] hover:border-[#20b2aa]/40"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-[#234b55] bg-[#12282e]">
                        <img
                          src={avatar.url}
                          alt={avatar.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#2cd3c6] text-black flex items-center justify-center font-bold text-[10px] shadow">
                          ✓
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-sm font-bold text-white truncate">
                          {avatar.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0a171b] text-[#2cd3c6] border border-[#2cd3c6]/30 font-mono shrink-0">
                          {avatar.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#7d979d] line-clamp-2 leading-relaxed">
                        {avatar.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form: Edit Profil */}
          <div className="rounded-2xl border border-[#1a363d] bg-[#0c1a1e]/90 p-5 sm:p-6">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 mb-1">
              <User className="w-5 h-5 text-[#2cd3c6]" />
              <span>Informasi & Pengaturan Akun</span>
            </h2>
            <p className="text-xs text-[#8ca4aa] mb-5">
              Sesuaikan nama tampilan dan informasi publik kreator Anda.
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8ca4aa] mb-1.5">
                  Nama Tampilan
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masukkan nama Anda..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a171b] border border-[#1c3c44] text-white text-sm focus:outline-none focus:border-[#2cd3c6] focus:ring-1 focus:ring-[#2cd3c6] transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8ca4aa] mb-1.5">
                  Alamat Email (Login)
                </label>
                <input
                  type="email"
                  value={sessionUser.email}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#071214] border border-[#173036] text-slate-400 text-sm cursor-not-allowed"
                />
                <span className="text-[10px] text-[#59787f] mt-1 block">
                  Email akun terdaftar untuk kuota 50 klip/hari.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8ca4aa] mb-1.5">
                  Bio / Catatan Kreator
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tulis bio atau catatan fokus konten Anda..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a171b] border border-[#1c3c44] text-white text-sm focus:outline-none focus:border-[#2cd3c6] focus:ring-1 focus:ring-[#2cd3c6] transition"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-[#718b91]">
                  Avatar yang dipilih:{" "}
                  <strong className="text-white">
                    {DEFAULT_AVATARS.find((a) => a.url === selectedAvatarUrl)?.name ||
                      "Kustom / Bawaan"}
                  </strong>
                </span>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#20b2aa] hover:bg-[#28c5bc] text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-[0_0_15px_rgba(32,178,170,0.3)] cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Col: Quota Details & Quick Guide */}
        <div className="flex flex-col gap-6">
          {/* Daily Quota Card */}
          <div className="rounded-2xl border border-[#1a363d] bg-gradient-to-b from-[#0f2429] to-[#0a181c] p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#2cd3c6]" />
                <span>Status Kuota Klip</span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                Aktif
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#071316] border border-[#142d33] flex flex-col items-center text-center">
              <span className="text-[11px] text-[#8ca4aa] font-medium uppercase tracking-wider">
                Sisa Kuota Hari Ini
              </span>
              <div className="my-2 flex items-baseline gap-1">
                <span className="text-3xl font-black text-[#2cd3c6] font-mono">
                  {remainingQuota}
                </span>
                <span className="text-sm text-[#59787f] font-mono">
                  / {sessionUser.dailyQuota}
                </span>
              </div>
              <span className="text-xs text-[#7d979d]">
                Maks. 10 klip per satu kali proses potong
              </span>
            </div>

            <div className="space-y-2.5 text-xs text-[#8ca4aa]">
              <div className="flex items-center justify-between py-1 border-b border-[#132c32]">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#2cd3c6]" />
                  <span>Jadwal Reset:</span>
                </span>
                <strong className="text-white">00:00 WIB</strong>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#132c32]">
                <span>Total Alokasi Harian:</span>
                <strong className="text-white">50 Klip / Hari</strong>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#132c32]">
                <span>Tipe Akun:</span>
                <strong className="text-purple-300 capitalize">{sessionUser.role}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetQuota}
              disabled={isResettingQuota}
              className="w-full mt-2 py-2.5 rounded-xl bg-[#122e35] hover:bg-[#1a3d46] border border-[#20b2aa]/30 text-xs font-semibold text-[#2cd3c6] flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResettingQuota ? "animate-spin" : ""}`} />
              <span>Simulasi Reset Kuota (00:00 WIB)</span>
            </button>
          </div>

          {/* Quick Links Card */}
          <div className="rounded-2xl border border-[#1a363d] bg-[#0c1a1e]/90 p-5 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Akses Cepat Fitur
            </h3>
            <Link
              to="/app"
              className="p-3 rounded-xl bg-[#0f2125] hover:bg-[#152e34] border border-[#183940] flex items-center justify-between text-xs font-medium text-slate-200 transition group"
            >
              <span>🎬 Studio Potong Video</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#2cd3c6] group-hover:translate-x-0.5 transition" />
            </Link>
            <Link
              to="/project-history"
              className="p-3 rounded-xl bg-[#0f2125] hover:bg-[#152e34] border border-[#183940] flex items-center justify-between text-xs font-medium text-slate-200 transition group"
            >
              <span>📁 Riwayat Proyek Klip</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#2cd3c6] group-hover:translate-x-0.5 transition" />
            </Link>
            <Link
              to="/viral-clips"
              className="p-3 rounded-xl bg-[#0f2125] hover:bg-[#152e34] border border-[#183940] flex items-center justify-between text-xs font-medium text-slate-200 transition group"
            >
              <span>🔥 Deteksi Momen Viral</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#2cd3c6] group-hover:translate-x-0.5 transition" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

