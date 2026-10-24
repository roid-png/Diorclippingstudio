import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  User,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Camera,
  Save,
  AlertCircle,
  Key,
  Upload,
  Download,
  Copy,
  Eye,
  EyeOff,
  Activity,
  Layers,
  ArrowLeft,
  Sliders,
  Check,
  Zap,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { API_URL } from "@/lib/env";
import {
  getPersistentSession,
  savePersistentSession,
  DEFAULT_DEMO_USER,
  type StoredSessionUser,
} from "@/features/auth/session-storage";
import { DEFAULT_AVATARS, type DefaultAvatarOption } from "@/features/auth/default-avatars";

export const Route = createFileRoute("/_protected/profile")({
  head: () => ({ meta: [{ title: `Pengaturan Akun & API Keys | ${siteConfig.name}` }] }),
  component: ProfilePage,
});

interface ApiKeyStatusItem {
  name: string;
  type: "gemini" | "groq";
  role: "primary" | "backup";
  status: "active" | "warning" | "rate_limited" | "invalid" | "unconfigured" | "error";
  label: string;
  quotaRules: string;
  details: string;
  latencyMs?: number;
  remainingRequests?: string;
  remainingTokens?: string;
  resetTime?: string;
}

interface KeyDefinition {
  name: string;
  label: string;
  type: "gemini" | "groq";
  role: "primary" | "backup";
  description: string;
  quotaRule: string;
}

const KEY_DEFINITIONS: KeyDefinition[] = [
  // Gemini Primary
  {
    name: "GEMINI_API_KEY_TRANSCRIPTION",
    label: "Gemini Transkripsi Audio",
    type: "gemini",
    role: "primary",
    description: "Kunci utama ekstraksi audio WAV & transkripsi kata Gemini",
    quotaRule: "15 RPM • 1,000,000 TPM • 1,500 RPD",
  },
  {
    name: "GEMINI_API_KEY_CURATION",
    label: "Gemini Kurasi Momen Viral",
    type: "gemini",
    role: "primary",
    description: "Kunci utama kurasi momen berpotensi viral & penentuan hook",
    quotaRule: "15 RPM • 1,000,000 TPM • 1,500 RPD",
  },
  {
    name: "GEMINI_API_KEY_ART_DIRECTOR",
    label: "Gemini Art Director & Beats",
    type: "gemini",
    role: "primary",
    description: "Kunci perancang 4 kartu infografis & animasi header kinetik",
    quotaRule: "15 RPM • 1,000,000 TPM • 1,500 RPD",
  },
  {
    name: "GEMINI_API_KEY_STYLE_CLONER",
    label: "Gemini Universal Style Cloner",
    type: "gemini",
    role: "primary",
    description: "Kunci analisis video referensi & cloning visual otomatis",
    quotaRule: "15 RPM • 1,000,000 TPM • 1,500 RPD",
  },
  {
    name: "GEMINI_API_KEY",
    label: "Gemini Fallback Utama",
    type: "gemini",
    role: "primary",
    description: "Kunci umum utama jika direktori spesifik tidak terisi",
    quotaRule: "15 RPM • 1,000,000 TPM • 1,500 RPD",
  },

  // Gemini Backup
  {
    name: "GEMINI_API_KEY_TRANSCRIPTION_BACKUP",
    label: "Gemini Transkripsi (Cadangan)",
    type: "gemini",
    role: "backup",
    description: "Otomatis aktif saat kuota transkripsi utama mencapai limit",
    quotaRule: "15 RPM • 1,000,000 TPM • 1,500 RPD",
  },
  {
    name: "GEMINI_API_KEY_CURATION_BACKUP",
    label: "Gemini Kurasi (Cadangan)",
    type: "gemini",
    role: "backup",
    description: "Otomatis aktif saat kuota kurasi utama mencapai limit",
    quotaRule: "15 RPM • 1,000,000 TPM • 1,500 RPD",
  },
  {
    name: "GEMINI_API_KEY_ART_DIRECTOR_BACKUP",
    label: "Gemini Art Director (Cadangan)",
    type: "gemini",
    role: "backup",
    description: "Otomatis aktif saat kuota art director utama mencapai limit",
    quotaRule: "15 RPM • 1,000,000 TPM • 1,500 RPD",
  },
  {
    name: "GEMINI_API_KEY_STYLE_CLONER_BACKUP",
    label: "Gemini Style Cloner (Cadangan)",
    type: "gemini",
    role: "backup",
    description: "Otomatis aktif saat kuota style cloner utama mencapai limit",
    quotaRule: "15 RPM • 1,000,000 TPM • 1,500 RPD",
  },
  {
    name: "GEMINI_API_KEY_BACKUP",
    label: "Gemini Fallback Cadangan",
    type: "gemini",
    role: "backup",
    description: "Kunci umum cadangan untuk seluruh pipeline Google Gemini",
    quotaRule: "15 RPM • 1,000,000 TPM • 1,500 RPD",
  },

  // Groq
  {
    name: "GROQ_API_KEY_PRIMARY",
    label: "Groq Whisper (Utama)",
    type: "groq",
    role: "primary",
    description: "Transkripsi acoustic kata-per-kata ultra-cepat (216x real-time)",
    quotaRule: "20 RPM • 2,000 RPD • 30k TPM",
  },
  {
    name: "GROQ_API_KEY_BACKUP",
    label: "Groq Whisper (Cadangan)",
    type: "groq",
    role: "backup",
    description: "Failover otomatis saat limit request Whisper utama habis",
    quotaRule: "20 RPM • 2,000 RPD • 30k TPM",
  },
];

function ProfilePage() {
  // 1. Profile State
  const [sessionUser, setSessionUser] = useState<StoredSessionUser>(DEFAULT_DEMO_USER);
  const [profileName, setProfileName] = useState<string>(DEFAULT_DEMO_USER.name);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string>(
    DEFAULT_DEMO_USER.avatarUrl || "/images/michael_avatar.png"
  );
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // 2. API Keys State
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [keyStatuses, setKeyStatuses] = useState<Record<string, ApiKeyStatusItem>>({});
  const [visibleKeyNames, setVisibleKeyNames] = useState<Record<string, boolean>>({});
  const [activeFilter, setActiveFilter] = useState<"all" | "gemini_primary" | "gemini_backup" | "groq">("all");
  const [isLoadingKeys, setIsLoadingKeys] = useState<boolean>(true);
  const [isSavingKeys, setIsSavingKeys] = useState<boolean>(false);
  const [isCheckingKeys, setIsCheckingKeys] = useState<boolean>(false);
  const [testingKeyName, setTestingKeyName] = useState<string | null>(null);

  // Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const envFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load Session and API Keys on mount
  useEffect(() => {
    // 1. Load local profile session
    const current = getPersistentSession();
    if (current) {
      setSessionUser(current);
      setProfileName(current.name);
      if (current.avatarUrl) {
        setProfileAvatarUrl(current.avatarUrl);
      }
    }

    // 2. Load API keys from backend
    fetchApiKeys();
  }, []);

  const STORAGE_KEY = "dior_clipping_api_keys";

  const fetchApiKeys = async () => {
    setIsLoadingKeys(true);
    let localBackup: Record<string, string> = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localBackup = JSON.parse(raw);
    } catch {}

    try {
      const res = await fetch(`${API_URL}/api/settings/api-keys`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const serverKeys: Record<string, string> = json.data;
          const serverHasKeys = Object.values(serverKeys).some((v) => v && v.length > 5);
          const localHasKeys = Object.values(localBackup).some((v) => v && v.length > 5);

          if (!serverHasKeys && localHasKeys) {
            // Server kosong (misal Codespace baru dibuat atau restart), pulihkan otomatis dari browser!
            setApiKeys(localBackup);
            fetch(`${API_URL}/api/settings/api-keys`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ keys: localBackup }),
            }).then(() => {
              showToast("Kunci API otomatis dipulihkan dari browser lokal ke server .env!");
              runKeysCheck(localBackup);
            }).catch(() => {
              runKeysCheck(localBackup);
            });
          } else {
            const merged = { ...localBackup, ...serverKeys };
            setApiKeys(merged);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            runKeysCheck(merged);
          }
        }
      } else if (Object.keys(localBackup).length > 0) {
        setApiKeys(localBackup);
        runKeysCheck(localBackup);
      }
    } catch {
      if (Object.keys(localBackup).length > 0) {
        setApiKeys(localBackup);
        showToast("Server offline. Kunci API dimuat dari penyimpanan lokal browser.");
        runKeysCheck(localBackup);
      } else {
        showToast("Gagal memuat API Keys dari server.");
      }
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const runKeysCheck = async (keysToCheck: Record<string, string>) => {
    setIsCheckingKeys(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/check-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: keysToCheck }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const statusMap: Record<string, ApiKeyStatusItem> = {};
          for (const item of json.data) {
            statusMap[item.name] = item;
          }
          setKeyStatuses(statusMap);
        }
      }
    } catch {}
    finally {
      setIsCheckingKeys(false);
    }
  };

  // Handle local avatar file upload from browser
  const handleAvatarFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setProfileAvatarUrl(result);
      showToast("Foto profil baru dipilih!");
    };
    reader.readAsDataURL(file);
  };

  // Save profile changes
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      showToast("Nama profil tidak boleh kosong.");
      return;
    }

    setIsSavingProfile(true);
    const updated = savePersistentSession({
      name: profileName.trim(),
      avatarUrl: profileAvatarUrl,
    });
    setSessionUser(updated);

    // Sync across tabs & header
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }

    setIsSavingProfile(false);
    showToast("Profil berhasil disimpan!");
  };

  // Handle Key Input Changes
  const handleKeyChange = (keyName: string, val: string) => {
    setApiKeys((prev) => ({ ...prev, [keyName]: val }));
  };

  // Toggle Visibility of an API Key
  const toggleVisibility = (keyName: string) => {
    setVisibleKeyNames((prev) => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  // Save all keys to all directory .env files and runtime environment
  const handleSaveAllKeys = async () => {
    setIsSavingKeys(true);
    // Simpan ke localStorage browser seketika agar tidak pernah hilang
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(apiKeys));
    } catch {}

    try {
      const res = await fetch(`${API_URL}/api/settings/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: apiKeys }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(json.message || "Semua API Keys berhasil disimpan ke sistem & browser!");
        // Re-check keys health
        runKeysCheck(apiKeys);
      } else {
        showToast(json.message || "Tersimpan di browser, tetapi gagal menulis ke server.");
      }
    } catch {
      showToast("Tersimpan di browser lokal, server sedang offline.");
    } finally {
      setIsSavingKeys(false);
    }
  };

  // Upload and parse .env or text file
  const handleUploadEnvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const lines = content.split(/\r?\n/);
      const extracted: Record<string, string> = { ...apiKeys };
      let count = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;

        const rawKey = trimmed.slice(0, eqIdx).trim();
        const rawVal = trimmed.slice(eqIdx + 1).replace(/^["']|["']$/g, "").trim();

        if (KEY_DEFINITIONS.some((k) => k.name === rawKey)) {
          extracted[rawKey] = rawVal;
          count++;
        }
      }

      setApiKeys(extracted);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(extracted));
      } catch {}
      showToast(`${count} kunci API berhasil diimpor! Klik 'Simpan ke Sistem' untuk menerapkan.`);
      runKeysCheck(extracted);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Download .env file to user computer
  const handleDownloadEnvFile = () => {
    const lines = [
      "# ===================================================================",
      "# DIOR CLIPPING STUDIO - CADANGAN KUNCI API (.ENV)",
      "# ===================================================================",
      "",
    ];
    for (const [k, v] of Object.entries(apiKeys)) {
      if (v) lines.push(`${k}="${v}"`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env";
    a.click();
    URL.revokeObjectURL(url);
    showToast("File .env berhasil diunduh ke komputer Anda!");
  };

  // Copy .env format to clipboard
  const handleCopyEnvToClipboard = () => {
    const lines: string[] = [];
    for (const [k, v] of Object.entries(apiKeys)) {
      if (v) lines.push(`${k}="${v}"`);
    }
    navigator.clipboard.writeText(lines.join("\n"));
    showToast("Format .env berhasil disalin ke clipboard!");
  };

  // Test single key directly
  const handleTestSingleKey = async (keyName: string) => {
    setTestingKeyName(keyName);
    const keyVal = apiKeys[keyName] || "";
    try {
      const res = await fetch(`${API_URL}/api/settings/check-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: { [keyName]: keyVal } }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const item = json.data[0];
          setKeyStatuses((prev) => ({ ...prev, [keyName]: item }));
          showToast(`Kunci ${item.label}: ${item.details}`);
        }
      }
    } catch {
      showToast("Gagal melakukan pengetesan kunci.");
    } finally {
      setTestingKeyName(null);
    }
  };

  // Filtered keys
  const filteredKeys = KEY_DEFINITIONS.filter((k) => {
    if (activeFilter === "gemini_primary") return k.type === "gemini" && k.role === "primary";
    if (activeFilter === "gemini_backup") return k.type === "gemini" && k.role === "backup";
    if (activeFilter === "groq") return k.type === "groq";
    return true;
  });

  return (
    <div className="w-full flex flex-col gap-8 animate-fadeIn text-slate-100 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#0f2a30] border border-[#2cd3c6] text-teal-200 text-xs font-semibold shadow-[0_0_20px_rgba(44,211,198,0.35)] flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-[#2cd3c6] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden inputs */}
      <input
        ref={envFileInputRef}
        type="file"
        accept=".env,.txt"
        className="hidden"
        onChange={handleUploadEnvFile}
      />
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileSelected}
      />

      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1b343b] pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#6e8e95] mb-1">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-[#2cd3c6] font-semibold">Pengaturan Akun & API Keys</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide flex items-center gap-2.5">
            <span>Pengaturan Akun & Manajemen API Keys</span>
            <Sparkles className="w-5 h-5 text-[#2cd3c6]" />
          </h1>
          <p className="text-xs text-[#7e9ca2] mt-0.5">
            Pilih profil mandiri dari browser, kelola seluruh direktori kunci Google Gemini & Groq, serta pantau limit penggunaan token secara real-time.
          </p>
        </div>

        <Link
          to="/app"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#122e35] hover:bg-[#194049] border border-[#2cd3c6]/40 text-[#2cd3c6] text-xs font-bold transition shadow-sm shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Studio</span>
        </Link>
      </div>

      {/* BAGIAN 1: PROFIL PENGGUNA (BROWSER PROFILE STYLE) */}
      <section className="bg-[#0b1b1e] border border-[#1d3d44] rounded-2xl p-5 sm:p-6 shadow-lg">
        <div className="flex items-center justify-between pb-4 border-b border-[#163036] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#14353d] border border-[#2cd3c6]/40 flex items-center justify-center text-[#2cd3c6]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Profil Pengguna</h2>
              <p className="text-[11px] text-[#719096]">
                Pilih avatar langsung dari file browser perangkat Anda atau pilih avatar siap pakai.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={isSavingProfile}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#17858c] to-[#20b2aa] hover:from-[#1da3ab] hover:to-[#2cd3c6] text-[#071316] font-bold text-xs transition shadow-[0_0_15px_rgba(44,211,198,0.3)] active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSavingProfile ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            )}
            <span>Simpan Profil</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Avatar Picker & Preview */}
          <div className="md:col-span-4 flex flex-col items-center sm:items-start gap-3">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#2cd3c6] shadow-[0_0_20px_rgba(44,211,198,0.25)] bg-[#12282e]">
                <img
                  src={profileAvatarUrl}
                  alt={profileName}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => avatarFileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-[#2cd3c6] text-[10px] font-bold gap-1 cursor-pointer"
                title="Pilih foto profil dari browser/perangkat"
              >
                <Camera className="w-5 h-5" />
                <span>Ganti Foto</span>
              </button>
            </div>

            <div className="flex flex-col gap-1 text-center sm:text-left">
              <button
                type="button"
                onClick={() => avatarFileInputRef.current?.click()}
                className="text-xs font-semibold text-[#2cd3c6] hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Pilih Foto dari Perangkat (Browser)</span>
              </button>
              <span className="text-[10px] text-[#6d8a90]">Format PNG, JPG, WebP (otomatis tersimpan lokal)</span>
            </div>
          </div>

          {/* Profile Name & Quick Avatar Presets */}
          <div className="md:col-span-8 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                Nama Tampilan Profil
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Masukkan nama tampilan..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#081518] border border-[#1b3b42] focus:border-[#2cd3c6] text-sm text-white placeholder-gray-500 outline-none transition"
              />
            </div>

            {/* Browser Avatar Presets */}
            <div>
              <label className="block text-[11px] font-semibold text-[#7e9ca2] mb-2">
                Atau Pilih Avatar Browser Bawaan:
              </label>
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {DEFAULT_AVATARS.slice(0, 6).map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setProfileAvatarUrl(av.url)}
                    className={`w-10 h-10 rounded-full overflow-hidden border-2 transition shrink-0 cursor-pointer ${
                      profileAvatarUrl === av.url
                        ? "border-[#2cd3c6] scale-110 shadow-[0_0_12px_rgba(44,211,198,0.5)]"
                        : "border-[#1e3c43] opacity-60 hover:opacity-100 hover:border-gray-400"
                    }`}
                    title={av.name}
                  >
                    <img src={av.url} alt={av.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BAGIAN 2: MULTI-COLUMN API KEY DIRECTORY (GEMINI & GROQ SAJA) */}
      <section className="bg-[#0b1b1e] border border-[#1d3d44] rounded-2xl p-5 sm:p-6 shadow-lg">
        {/* Header Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-[#163036] gap-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#14353d] border border-[#2cd3c6]/40 flex items-center justify-center text-[#2cd3c6]">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Manajemen API Key & Monitoring Kuota</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#14373e] border border-[#20b2aa]/40 text-[#2cd3c6]">
                  Gemini & Groq Saja
                </span>
              </h2>
              <p className="text-[11px] text-[#719096]">
                Paste kunci langsung, upload file .env, serta pantau limit rate & token usage secara real-time.
              </p>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Upload .env Button */}
            <button
              type="button"
              onClick={() => envFileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#112a30] hover:bg-[#16373f] border border-[#20b2aa]/40 text-[#2cd3c6] text-xs font-semibold transition active:scale-95 cursor-pointer"
              title="Upload file .env untuk mengisi semua kolom kunci secara otomatis"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import .env</span>
            </button>

            {/* Download Backup .env */}
            <button
              type="button"
              onClick={handleDownloadEnvFile}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#112a30] hover:bg-[#16373f] border border-[#20b2aa]/40 text-[#2cd3c6] text-xs font-semibold transition active:scale-95 cursor-pointer"
              title="Unduh cadangan .env ke komputer Anda"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .env</span>
            </button>

            {/* Copy .env format to clipboard */}
            <button
              type="button"
              onClick={handleCopyEnvToClipboard}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#112a30] hover:bg-[#16373f] border border-[#20b2aa]/40 text-[#2cd3c6] text-xs font-semibold transition active:scale-95 cursor-pointer"
              title="Salin seluruh kunci dalam format .env ke clipboard"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Teks</span>
            </button>

            {/* Live Refresh Status Button */}
            <button
              type="button"
              onClick={() => runKeysCheck(apiKeys)}
              disabled={isCheckingKeys}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#112a30] hover:bg-[#16373f] border border-[#2cd3c6]/40 text-teal-200 text-xs font-semibold transition active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Cek koneksi dan sisa kuota semua kunci ke Google & Groq"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingKeys ? "animate-spin text-[#2cd3c6]" : ""}`} />
              <span>{isCheckingKeys ? "Mengecek Kuota..." : "Refresh Status Limit"}</span>
            </button>

            {/* Save All Keys to System Button */}
            <button
              type="button"
              onClick={handleSaveAllKeys}
              disabled={isSavingKeys}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#17858c] to-[#20b2aa] hover:from-[#1da3ab] hover:to-[#2cd3c6] text-[#071316] font-bold text-xs transition shadow-[0_0_15px_rgba(44,211,198,0.3)] active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSavingKeys ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Simpan ke Sistem</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-5 border-b border-[#142d33]">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              activeFilter === "all"
                ? "bg-[#163c45] border border-[#2cd3c6]/60 text-[#2cd3c6] shadow-sm"
                : "text-[#7a99a0] hover:text-white hover:bg-[#11252a]"
            }`}
          >
            Semua Kunci ({KEY_DEFINITIONS.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("gemini_primary")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              activeFilter === "gemini_primary"
                ? "bg-[#163c45] border border-[#2cd3c6]/60 text-[#2cd3c6] shadow-sm"
                : "text-[#7a99a0] hover:text-white hover:bg-[#11252a]"
            }`}
          >
            Gemini Kunci Utama (5)
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("gemini_backup")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              activeFilter === "gemini_backup"
                ? "bg-[#163c45] border border-[#2cd3c6]/60 text-[#2cd3c6] shadow-sm"
                : "text-[#7a99a0] hover:text-white hover:bg-[#11252a]"
            }`}
          >
            Gemini Kunci Cadangan (5)
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("groq")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              activeFilter === "groq"
                ? "bg-[#163c45] border border-[#2cd3c6]/60 text-[#2cd3c6] shadow-sm"
                : "text-[#7a99a0] hover:text-white hover:bg-[#11252a]"
            }`}
          >
            Groq Whisper (2)
          </button>
        </div>

        {/* Multi-Column Key Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredKeys.map((def) => {
            const currentVal = apiKeys[def.name] || "";
            const isVisible = visibleKeyNames[def.name] || false;
            const statusInfo = keyStatuses[def.name];
            const isTesting = testingKeyName === def.name;

            // Status Badge Colors & Icons
            let badgeBg = "bg-gray-800/60 border-gray-700 text-gray-400";
            let badgeDot = "bg-gray-400";
            let badgeText = "Belum Diisi";

            if (statusInfo) {
              if (statusInfo.status === "active") {
                badgeBg = "bg-emerald-950/50 border-emerald-500/40 text-emerald-300";
                badgeDot = "bg-emerald-400";
                badgeText = "Aktif & Aman";
              } else if (statusInfo.status === "warning") {
                badgeBg = "bg-amber-950/50 border-amber-500/40 text-amber-300";
                badgeDot = "bg-amber-400";
                badgeText = "Mendekati Limit";
              } else if (statusInfo.status === "rate_limited") {
                badgeBg = "bg-rose-950/50 border-rose-500/40 text-rose-300";
                badgeDot = "bg-rose-400";
                badgeText = "Limit Tercapai (429)";
              } else if (statusInfo.status === "invalid") {
                badgeBg = "bg-rose-950/50 border-rose-500/40 text-rose-300";
                badgeDot = "bg-rose-400";
                badgeText = "Kunci Tidak Valid";
              } else if (statusInfo.status === "unconfigured") {
                badgeBg = "bg-gray-800/60 border-gray-700 text-gray-400";
                badgeDot = "bg-gray-400";
                badgeText = "Belum Diisi";
              } else {
                badgeBg = "bg-amber-950/50 border-amber-500/40 text-amber-300";
                badgeDot = "bg-amber-400";
                badgeText = "Status Error";
              }
            } else if (currentVal && currentVal.length > 8) {
              badgeBg = "bg-[#14353d] border-[#2cd3c6]/40 text-[#2cd3c6]";
              badgeDot = "bg-[#2cd3c6]";
              badgeText = "Siap Divalidasi";
            }

            return (
              <div
                key={def.name}
                className="bg-[#081518] border border-[#18343b] rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md hover:border-[#20b2aa]/40 transition group"
              >
                {/* Header Card: Title, Badge, Status */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#2cd3c6] transition">
                        {def.label}
                      </h3>
                      <p className="font-mono text-[10px] text-[#5e7c82] truncate">
                        {def.name}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${badgeBg}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${badgeDot}`} />
                      <span>{badgeText}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#719096] leading-tight mb-2">
                    {def.description}
                  </p>

                  {/* Quota & Token Telemetry Box */}
                  <div className="bg-[#0b1c20] border border-[#16333a] rounded-lg p-2.5 text-[10px] space-y-1 mb-2">
                    <div className="flex items-center justify-between text-[#7d9b9f]">
                      <span>Aturan Limit:</span>
                      <span className="font-mono font-bold text-[#2cd3c6]">{def.quotaRule}</span>
                    </div>

                    {/* Groq Live Requests Telemetry */}
                    {statusInfo?.remainingRequests && (
                      <div className="flex items-center justify-between text-[#8aa8ae] border-t border-[#12282d] pt-1 mt-1">
                        <span>Sisa Request:</span>
                        <span className="font-mono font-bold text-emerald-300">
                          {statusInfo.remainingRequests}
                        </span>
                      </div>
                    )}

                    {/* Latency & Diagnosis */}
                    {statusInfo && statusInfo.status !== "unconfigured" && (
                      <div className="flex items-center justify-between text-[#759398] border-t border-[#12282d] pt-1 mt-1">
                        <span>Status Diagnostik:</span>
                        <span className="truncate max-w-[170px]" title={statusInfo.details}>
                          {statusInfo.latencyMs ? `${statusInfo.latencyMs}ms • ` : ""}
                          {statusInfo.label}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Input Field & Test Action */}
                <div className="space-y-2">
                  <div className="relative flex items-center">
                    <input
                      type={isVisible ? "text" : "password"}
                      value={currentVal}
                      onChange={(e) => handleKeyChange(def.name, e.target.value)}
                      placeholder={`Paste nilai ${def.name}...`}
                      className="w-full pl-3 pr-10 py-2 rounded-lg bg-[#050e10] border border-[#1b3a41] focus:border-[#2cd3c6] text-xs font-mono text-gray-200 placeholder-gray-600 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => toggleVisibility(def.name)}
                      className="absolute right-2 text-gray-500 hover:text-[#2cd3c6] p-1 transition cursor-pointer"
                      title={isVisible ? "Sembunyikan" : "Tampilkan teks kunci"}
                    >
                      {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#567379]">
                      {currentVal ? `${currentVal.length} karakter` : "Kosong"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTestSingleKey(def.name)}
                      disabled={isTesting || !currentVal}
                      className="text-[#2cd3c6] hover:underline font-semibold disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                    >
                      {isTesting ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Menguji...</span>
                        </>
                      ) : (
                        <span>Uji Kunci Ini</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="mt-6 pt-4 border-t border-[#16333a] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#6e8e95]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2cd3c6]" />
            <span>Kunci otomatis tersinkronisasi ke seluruh direktori (.env, backend, dan runtime) tanpa restart manual.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveAllKeys}
              disabled={isSavingKeys}
              className="text-[#2cd3c6] font-bold hover:underline cursor-pointer"
            >
              Simpan Perubahan
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
