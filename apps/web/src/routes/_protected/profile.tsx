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
  Undo2,
  AlertCircle,
  Link2,
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
import { ProfileLivePreviewCard } from "@/features/auth/components/ProfileLivePreviewCard";

export const Route = createFileRoute("/_protected/profile")({
  head: () => ({ meta: [{ title: `Profil Pengguna & Avatar | ${siteConfig.name}` }] }),
  component: ProfilePage,
});

const ROLE_BADGES = [
  "Content Creator",
  "Pro Video Editor",
  "Podcast Curator",
  "Viral Clip Specialist",
  "Media Agency",
];

function ProfilePage() {
  const [sessionUser, setSessionUser] = useState<StoredSessionUser>(DEFAULT_DEMO_USER);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>(
    DEFAULT_DEMO_USER.avatarUrl || "/images/michael_avatar.png"
  );
  const [customAvatarInput, setCustomAvatarInput] = useState<string>("");
  const [fullName, setFullName] = useState<string>(DEFAULT_DEMO_USER.name);
  const [badge, setBadge] = useState<string>(DEFAULT_DEMO_USER.badge || "Content Creator");
  const [bio, setBio] = useState<string>(
    "Kreator video pendek fokus YouTube Shorts & TikTok viral. Menggunakan preset THEO 5-FIX."
  );

  const [nameError, setNameError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
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
      if (current.badge) {
        setBadge(current.badge);
      }
    }
  }, []);

  const isDirty =
    fullName.trim() !== sessionUser.name ||
    selectedAvatarUrl !== sessionUser.avatarUrl ||
    badge !== (sessionUser.badge || "Content Creator");

  const handleNameChange = (val: string) => {
    setFullName(val);
    if (!val.trim()) {
      setNameError("Nama tampilan tidak boleh kosong.");
    } else if (val.trim().length < 2) {
      setNameError("Nama minimal 2 karakter.");
    } else if (val.trim().length > 40) {
      setNameError("Nama maksimal 40 karakter.");
    } else {
      setNameError(null);
    }
  };

  const handleSelectDefaultAvatar = (avatar: DefaultAvatarOption) => {
    setSelectedAvatarUrl(avatar.url);
    setAvatarError(null);
  };

  const handleApplyCustomAvatar = () => {
    const trimmed = customAvatarInput.trim();
    if (!trimmed) {
      setAvatarError("Masukkan URL gambar yang valid terlebih dahulu.");
      return;
    }
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setAvatarError("URL harus dimulai dengan http:// atau https://");
      return;
    }
    setSelectedAvatarUrl(trimmed);
    setAvatarError(null);
  };

  const handleRevertChanges = () => {
    setFullName(sessionUser.name);
    setSelectedAvatarUrl(sessionUser.avatarUrl || "/images/michael_avatar.png");
    setBadge(sessionUser.badge || "Content Creator");
    setNameError(null);
    setAvatarError(null);
    setCustomAvatarInput("");
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || nameError) {
      setNameError("Silakan masukkan nama tampilan yang valid.");
      return;
    }

    const updated = savePersistentSession({
      ...sessionUser,
      name: fullName.trim(),
      avatarUrl: selectedAvatarUrl,
      badge,
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
    <div className="w-full text-slate-100 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between py-2 px-1 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/app" className="text-[#6d868c] hover:text-[#2cd3c6] transition">
            Dashboard
          </Link>
          <span className="text-[#3c565d]">/</span>
          <span className="text-[#6d868c]">Akun & Kuota</span>
          <span className="text-[#3c565d]">/</span>
          <span className="text-white font-medium tracking-wide">
            Ubah Profil & Pratinjau
          </span>
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
            Perubahan profil berhasil disimpan! Foto profil dan nama tampilan langsung diperbarui di seluruh aplikasi.
          </span>
        </div>
      )}

      {/* Main Grid: Left 2 Cols (Edit Form & Avatars), Right 1 Col (Live Preview & Quota) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Form Ubah Nama & Foto Profil */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Section: Form Ubah Profil */}
          <div className="rounded-2xl border border-[#1a363d] bg-[#0c1a1e]/90 p-5 sm:p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-[#2cd3c6]" />
                <span>Form Ubah Nama & Foto Profil</span>
              </h2>
              {isDirty && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium">
                  Perubahan Belum Disimpan
                </span>
              )}
            </div>
            <p className="text-xs text-[#8ca4aa] mb-5">
              Setiap ketikan pada nama atau pemilihan avatar langsung terlihat pada kotak pratinjau di sebelah kanan.
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Nama Tampilan */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#8ca4aa]">
                    Nama Tampilan Kreator
                  </label>
                  <span className="text-[10px] text-[#718b91] font-mono">
                    {fullName.length}/40 karakter
                  </span>
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Contoh: Sonia Evangelyn"
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-[#0a171b] border text-white text-sm focus:outline-none transition ${
                    nameError
                      ? "border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      : "border-[#1c3c44] focus:border-[#2cd3c6] focus:ring-1 focus:ring-[#2cd3c6]"
                  }`}
                  required
                />
                {nameError && (
                  <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{nameError}</span>
                  </div>
                )}
              </div>

              {/* Role / Persona Badge Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#8ca4aa] mb-1.5">
                  Peran / Persona Akun
                </label>
                <div className="flex flex-wrap gap-2">
                  {ROLE_BADGES.map((b) => {
                    const isSelected = badge === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBadge(b)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          isSelected
                            ? "bg-[#20b2aa] text-slate-950 shadow-[0_0_12px_rgba(32,178,170,0.4)]"
                            : "bg-[#0f2125] text-slate-300 border border-[#1b373e] hover:bg-[#142d33] hover:text-white"
                        }`}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* URL Foto Profil Kustom (Opsional) */}
              <div>
                <label className="block text-xs font-semibold text-[#8ca4aa] mb-1.5">
                  Tautan Foto Profil Kustom (Opsional)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={customAvatarInput}
                      onChange={(e) => {
                        setCustomAvatarInput(e.target.value);
                        if (avatarError) setAvatarError(null);
                      }}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#0a171b] border border-[#1c3c44] text-white text-xs sm:text-sm focus:outline-none focus:border-[#2cd3c6] focus:ring-1 focus:ring-[#2cd3c6] transition"
                    />
                    <Link2 className="w-4 h-4 text-[#718b91] absolute left-3 top-3" />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustomAvatar}
                    className="px-3.5 py-2.5 rounded-xl bg-[#14282e] hover:bg-[#1d3d46] border border-[#20b2aa]/30 text-xs font-semibold text-[#2cd3c6] hover:text-white transition cursor-pointer shrink-0"
                  >
                    Terapkan URL
                  </button>
                </div>
                {avatarError && (
                  <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{avatarError}</span>
                  </div>
                )}
              </div>

              {/* Bio Singkat */}
              <div>
                <label className="block text-xs font-semibold text-[#8ca4aa] mb-1.5">
                  Bio / Catatan Kreator
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Catatan fokus gaya video atau kanal YouTube..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a171b] border border-[#1c3c44] text-white text-xs sm:text-sm focus:outline-none focus:border-[#2cd3c6] focus:ring-1 focus:ring-[#2cd3c6] transition"
                />
              </div>

              {/* Action Buttons: Simpan & Batal */}
              <div className="pt-3 border-t border-[#16353d] flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleRevertChanges}
                  disabled={!isDirty}
                  className="px-4 py-2 rounded-xl bg-[#122328] hover:bg-[#1a333b] border border-[#1c3c44] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Batal / Kembalikan</span>
                </button>

                <button
                  type="submit"
                  disabled={!isDirty || !!nameError}
                  className="px-6 py-2.5 rounded-xl bg-[#20b2aa] hover:bg-[#28c5bc] text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-[0_0_15px_rgba(32,178,170,0.3)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan Profil</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section: Galeri Avatar Bawaan Cepat */}
          <div className="rounded-2xl border border-[#1a363d] bg-[#0c1a1e]/90 p-5 sm:p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#2cd3c6]" />
                  <span>Pilihan Avatar Bawaan (Klik untuk Pratinjau)</span>
                </h3>
                <p className="text-xs text-[#8ca4aa] mt-0.5">
                  Klik avatar mana saja di bawah ini untuk melihat pratinjaunya secara langsung di sebelah kanan.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {DEFAULT_AVATARS.map((avatar) => {
                const isSelected = selectedAvatarUrl === avatar.url;

                return (
                  <div
                    key={avatar.id}
                    onClick={() => handleSelectDefaultAvatar(avatar)}
                    className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col items-center text-center ${
                      isSelected
                        ? "bg-[#13323a]/90 border-[#2cd3c6] shadow-[0_0_15px_rgba(44,211,198,0.25)] ring-1 ring-[#2cd3c6]"
                        : "bg-[#0f2125]/70 border-[#1a373e] hover:bg-[#142d33] hover:border-[#20b2aa]/40"
                    }`}
                  >
                    <div className="relative mb-2">
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

                    <span className="text-xs font-bold text-white truncate max-w-full">
                      {avatar.name}
                    </span>
                    <span className="text-[10px] text-[#2cd3c6] font-mono mt-0.5">
                      {avatar.tag}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Live Preview Component & Daily Quota Status */}
        <div className="flex flex-col gap-6">
          {/* Dedicated Live Preview Card Component */}
          <ProfileLivePreviewCard
            name={fullName}
            avatarUrl={selectedAvatarUrl}
            badge={badge}
            email={sessionUser.email}
            isDirty={isDirty}
          />

          {/* Daily Quota Status Card */}
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

            <div className="space-y-2 text-xs text-[#8ca4aa]">
              <div className="flex items-center justify-between py-1 border-b border-[#132c32]">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#2cd3c6]" />
                  <span>Jadwal Reset:</span>
                </span>
                <strong className="text-white">00:00 WIB</strong>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#132c32]">
                <span>Alokasi Harian:</span>
                <strong className="text-white">50 Klip / Hari</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetQuota}
              disabled={isResettingQuota}
              className="w-full mt-1 py-2 rounded-xl bg-[#122e35] hover:bg-[#1a3d46] border border-[#20b2aa]/30 text-xs font-semibold text-[#2cd3c6] flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResettingQuota ? "animate-spin" : ""}`} />
              <span>Simulasi Reset Kuota (00:00 WIB)</span>
            </button>
          </div>

          {/* Quick Navigation Card */}
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
          </div>
        </div>
      </div>
    </div>
  );
}
