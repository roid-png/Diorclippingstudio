import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { siteConfig } from "@/config/site";
import {
  Palette,
  Sparkles,
  Plus,
  CheckCircle2,
  Trash2,
  Lock,
  Wand2,
  Type,
  Film,
  Zap,
  ArrowRight,
  X,
  Loader2,
  RefreshCw,
  Layers,
  Check,
} from "lucide-react";
import { API_URL } from "@/lib/env";

export const Route = createFileRoute("/_protected/presets")({
  head: () => ({ meta: [{ title: `Preset Management | ${siteConfig.name}` }] }),
  component: PresetsManagementPage,
});

export interface PresetSubtitleStyle {
  fontName: string;
  fontSize: number;
  primaryColor: string;
  highlightColor: string;
  outlineColor: string;
  outlineWidth: number;
  alignment: number;
  marginV: number;
  bold: boolean;
  animation?: string;
  bounceScale?: number;
  showSpeakerTag?: boolean;
}

export interface PresetMotionGraphic {
  progressBar: boolean;
  punchZoom: boolean;
  punchZoomScale?: number;
}

export interface PresetItem {
  id: string;
  name: string;
  description: string;
  format: string;
  width: number;
  height: number;
  colorGrading: string;
  transition: string;
  subtitleStyle: PresetSubtitleStyle;
  motionGraphic: PresetMotionGraphic;
  pipelineMode?: "netflix_editorial" | "clean_subtitles" | "raw_cut" | string;
  accentColor?: string;
  enableHook?: boolean;
  enableTopMotion?: boolean;
  enablePolish?: boolean;
  badge?: string;
  isCustom?: boolean;
  isCloned?: boolean;
  layoutArchitecture?: string;
  subtitleBehavior?: string;
  hookTypographyStyle?: string;
  styleVariant?: number;
  createdAt?: string;
}

export const STUDIO_FONTS = [
  "Montserrat ExtraBold",
  "Plus Jakarta Sans",
  "Poppins Black",
  "Anton",
  "Bebas Neue",
];

export const ACCENT_COLOR_PRESETS = [
  { label: "Merah Netflix", hex: "#E50914" },
  { label: "Teal Modern", hex: "#14B8A6" },
  { label: "Emas Elegan", hex: "#FACC15" },
  { label: "Hijau Emerald", hex: "#10B981" },
];

export const PIPELINE_MODE_OPTIONS = [
  {
    id: "netflix_editorial",
    name: "Netflix Editorial (Full Motion)",
    desc: "Hook 4s + Infografis Atas + Subtitle 2-Layer + Cinema SFX",
  },
  {
    id: "clean_subtitles",
    name: "Clean Subtitle (2-Layer)",
    desc: "Subtitle Sinematik 2-Layer Tanpa Infografis Atas",
  },
  {
    id: "raw_cut",
    name: "Raw Cut 9:16",
    desc: "Potongan Vertikal 1080x1920 Murni Tanpa Overlay",
  },
];

const COLOR_GRADING_TEMPLATES = [
  {
    label: "Moody Sinematik (Contrast +12%, Saturation -12%)",
    value: "eq=contrast=1.12:brightness=-0.03:saturation=0.88",
  },
  {
    label: "Vibrant Pop (Contrast +8%, Saturation +25%)",
    value: "eq=contrast=1.08:brightness=0.02:saturation=1.25",
  },
  {
    label: "Soft Pastel Film (Contrast -5%, Brightness +5%)",
    value: "eq=contrast=0.95:brightness=0.05:saturation=0.90",
  },
  {
    label: "Dark Podcast High Contrast (Contrast +15%)",
    value: "eq=contrast=1.15:brightness=-0.04:saturation=1.05",
  },
  {
    label: "Natural Clean (No Grading)",
    value: "",
  },
];

export function PresetsManagementPage() {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Form State for creating custom preset with modern studio options
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    description: "",
    pipelineMode: "netflix_editorial",
    accentColor: "#E50914",
    enableHook: true,
    enableTopMotion: true,
    enablePolish: true,
    colorGrading: COLOR_GRADING_TEMPLATES[0].value,
    fontName: "Montserrat ExtraBold",
    fontSize: 26,
    primaryColor: "&H00FFFFFF",
    highlightColor: "&H0000FFFF",
    outlineWidth: 3,
    animation: "bounce-popup",
    punchZoom: true,
  });

  const fetchPresets = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/presets`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPresets(data.data);
      }
    } catch (err) {
      console.warn("[Presets] Gagal fetch presets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  const handleOpenCreateModal = () => {
    const timestamp = Math.floor(Math.random() * 900 + 100);
    setFormData({
      id: `custom-style-${timestamp}`,
      name: `Koleksi Gaya #${timestamp}`,
      description: "Gaya kustom Dior Clipping dengan tipografi studio & motion graphic.",
      pipelineMode: "netflix_editorial",
      accentColor: "#E50914",
      enableHook: true,
      enableTopMotion: true,
      enablePolish: true,
      colorGrading: COLOR_GRADING_TEMPLATES[0].value,
      fontName: "Montserrat ExtraBold",
      fontSize: 26,
      primaryColor: "&H00FFFFFF",
      highlightColor: "&H0000FFFF",
      outlineWidth: 3,
      animation: "bounce-popup",
      punchZoom: true,
    });
    setIsModalOpen(true);
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.id.trim()) return;

    setIsSaving(true);
    try {
      const payload = {
        id: formData.id.toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
        name: formData.name.trim(),
        description: formData.description.trim(),
        format: "9:16",
        width: 1080,
        height: 1920,
        pipelineMode: formData.pipelineMode,
        accentColor: formData.accentColor,
        enableHook: formData.enableHook,
        enableTopMotion: formData.enableTopMotion,
        enablePolish: formData.enablePolish,
        colorGrading: formData.colorGrading,
        transition: "fade",
        subtitleStyle: {
          fontName: formData.fontName,
          fontSize: Number(formData.fontSize) || 26,
          primaryColor: formData.primaryColor,
          highlightColor: formData.highlightColor,
          outlineColor: "&H00000000",
          outlineWidth: Number(formData.outlineWidth) || 3,
          alignment: 2,
          marginV: 80,
          bold: true,
          animation: formData.animation,
          bounceScale: 1.15,
          showSpeakerTag: false,
        },
        motionGraphic: {
          progressBar: false, // Hapus garis bawah kuno
          punchZoom: formData.punchZoom,
          punchZoomScale: 1.15,
        },
        badge: "Kustom",
        isCustom: true,
      };

      const res = await fetch(`${API_URL}/api/presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) {
        setFeedbackMessage(`Preset "${result.data.name}" berhasil disimpan ke server!`);
        setTimeout(() => setFeedbackMessage(null), 3500);
        setIsModalOpen(false);
        await fetchPresets();
      } else {
        alert(result.message || (res.status === 503 ? "Backend server sedang memuat, silakan coba beberapa detik lagi." : "Gagal menyimpan preset."));
      }
    } catch (err: any) {
      alert("Koneksi ke backend terputus atau server sedang restart. Pastikan backend aktif (port 5000) lalu coba kembali.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePreset = async (preset: PresetItem) => {
    if (preset.id === "renx-viral-clipper" || preset.id === "netflix-cinematic" || preset.id === "viral-motion") {
      alert("Preset default sistem tidak dapat dihapus agar sistem selalu memiliki template cadangan.");
      return;
    }

    const confirmed = window.confirm(`Apakah Anda yakin ingin menghapus preset "${preset.name}" dari server?`);
    if (!confirmed) return;

    setDeletingId(preset.id);
    try {
      const res = await fetch(`${API_URL}/api/presets/${preset.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        setFeedbackMessage(`Preset "${preset.name}" berhasil dihapus.`);
        setTimeout(() => setFeedbackMessage(null), 3000);
        setPresets((prev) => prev.filter((p) => p.id !== preset.id));
        await fetchPresets();
      } else {
        alert(result.message || "Gagal menghapus preset.");
      }
    } catch (err: any) {
      alert(err?.message || "Gagal menghubungi server untuk menghapus preset.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleApplyToDashboard = (preset: PresetItem) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("dior_applied_preset", JSON.stringify(preset));
      sessionStorage.setItem("dior_selected_preset_id", preset.id);
    }
    navigate({ to: "/app" });
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-fadeIn text-slate-100">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className="fixed top-16 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#0f2a30] border border-[#2cd3c6] text-teal-200 text-xs font-semibold shadow-[0_0_20px_rgba(44,211,198,0.35)] flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#2cd3c6] shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Header Presets Management */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#0d2228]/85 via-[#112a32]/75 to-[#0c181c]/90 border border-[#1d3d45] shadow-xl">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#13434c] to-[#20a3a7] p-2 flex items-center justify-center border border-[#2cd3c6]/40 shadow-[0_0_15px_rgba(44,211,198,0.25)] text-white">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">
              Preset Management & Custom Studio
            </h1>
            <p className="text-xs text-[#8ca7ae]">
              Koleksi template editing video vertikal 9:16 (Tipografi studio, pipeline mode, warna aksen, & visual motion).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchPresets}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-[#23454d] bg-[#14282e] hover:bg-[#1a343b] text-xs text-[#8da5ab] hover:text-white transition flex items-center gap-1.5 cursor-pointer"
            title="Muat Ulang Preset dari Server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#1a858c] via-[#21a6a3] to-[#2cd3c6] text-white text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-[0_0_15px_rgba(44,211,198,0.3)] hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Buat Template Baru</span>
          </button>
        </div>
      </div>

      {/* Presets Grid */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[#2cd3c6] animate-spin" />
          <span className="text-xs text-[#7e9ca2]">Membaca koleksi template preset dari disk server...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {presets.map((preset) => {
            const isSystemDefault = preset.id === "renx-viral-clipper" || preset.id === "netflix-cinematic" || preset.id === "viral-motion";
            const isCloned = preset.id.startsWith("cloned-") || preset.id === "ai-cloned" || preset.isCloned;
            const sub = preset.subtitleStyle;
            const accent = preset.accentColor || "#E50914";

            return (
              <div
                key={preset.id}
                className="rounded-2xl border border-[#1e3c43] bg-[#0e2125] p-4 flex flex-col justify-between gap-4 shadow-md hover:border-[#2cd3c6]/40 transition group relative"
              >
                {/* Top Info & Delete Action */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 pr-1">
                      <h3 className="text-sm font-bold text-white group-hover:text-[#2cd3c6] transition truncate">
                        {preset.name}
                      </h3>
                      <span className="text-[10px] font-mono text-[#7e9ca2] block truncate">
                        ID: {preset.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Badge Tipe Preset */}
                      {isCloned ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1">
                          <Wand2 className="w-2.5 h-2.5 text-pink-400" />
                          <span>AI Cloned</span>
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            isSystemDefault
                              ? "bg-teal-500/20 text-teal-300 border-teal-500/30"
                              : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                          }`}
                        >
                          {isSystemDefault ? "Default 9:16" : "Kustom"}
                        </span>
                      )}

                      {/* Tombol Hapus (Trash2) - Kecuali 2 Preset Default Utama */}
                      {!isSystemDefault ? (
                        <button
                          type="button"
                          onClick={() => handleDeletePreset(preset)}
                          disabled={deletingId === preset.id}
                          className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white p-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                          title="Hapus Preset dari Server"
                        >
                          {deletingId === preset.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ) : (
                        <span
                          className="p-2 rounded-xl bg-slate-800/40 text-slate-500 border border-slate-700/40 cursor-not-allowed"
                          title="Preset Default Sistem (Dilindungi)"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-[#8ca4aa] line-clamp-2 leading-relaxed min-h-[32px]">
                    {preset.description || "Preset pengeditan video vertikal Dior Clipping."}
                  </p>

                  {/* 9:16 Visual Mockup Preview */}
                  <div className="relative w-full aspect-[9/10] rounded-xl overflow-hidden bg-gradient-to-br from-[#071518] to-[#12282e] border border-[#183940] flex flex-col items-center justify-between p-3 select-none shadow-inner">
                    <div className="w-full flex items-center justify-between text-[9px] font-mono text-gray-400">
                      <span className="px-1.5 py-0.5 rounded bg-black/60 flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: accent }}
                        />
                        <span>9:16</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-black/60 text-[#2cd3c6] font-semibold">
                        {preset.pipelineMode === "clean_subtitles"
                          ? "Clean 2-Layer"
                          : preset.pipelineMode === "raw_cut"
                          ? "Raw Cut"
                          : "Netflix Editorial"}
                      </span>
                    </div>

                    {/* Subtitle Typography Simulation */}
                    <div className="text-center bg-black/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 max-w-[95%] shadow-lg">
                      <span
                        style={{
                          fontFamily: sub.fontName || "Montserrat ExtraBold, sans-serif",
                          fontWeight: sub.bold ? "900" : "normal",
                        }}
                        className="text-xs tracking-wide block"
                      >
                        <span className="text-white">KATA </span>
                        <span
                          style={{ color: accent }}
                          className="font-extrabold underline decoration-white/40"
                        >
                          HIGHLIGHT{" "}
                        </span>
                        <span className="text-white">AKTIF</span>
                      </span>
                      <div className="text-[9px] text-gray-400 mt-1 flex items-center justify-center gap-1">
                        <Type className="w-2.5 h-2.5 text-[#2cd3c6]" />
                        <span>{sub.fontName || "Montserrat ExtraBold"}</span>
                      </div>
                    </div>

                    {/* Feature Indicators Pill */}
                    <div className="w-full flex items-center justify-center gap-1.5 text-[9px] text-gray-400">
                      {preset.enableHook !== false && (
                        <span className="px-1.5 py-0.5 rounded bg-[#162e34] text-[#2cd3c6] border border-[#20b2aa]/30">
                          Hook 4s
                        </span>
                      )}
                      {preset.enableTopMotion !== false && (
                        <span className="px-1.5 py-0.5 rounded bg-[#162e34] text-purple-300 border border-purple-500/30">
                          Top Motion
                        </span>
                      )}
                      {preset.enablePolish !== false && (
                        <span className="px-1.5 py-0.5 rounded bg-[#162e34] text-amber-300 border border-amber-500/30">
                          SFX
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Properties Pills */}
                  <div className="space-y-1.5 text-[11px] text-[#7e9ca2] pt-1">
                    <div className="flex items-center justify-between py-0.5 border-b border-[#142d33]">
                      <span>Font Subtitle:</span>
                      <strong className="text-white truncate max-w-[150px]">{sub.fontName}</strong>
                    </div>
                    <div className="flex items-center justify-between py-0.5 border-b border-[#142d33]">
                      <span>Warna Aksen:</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block border border-white/20"
                          style={{ backgroundColor: accent }}
                        />
                        <span className="font-mono text-white text-[10px]">{accent}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-0.5">
                      <span>Pipeline Mode:</span>
                      <span className="text-[#2cd3c6] font-medium truncate max-w-[140px]">
                        {preset.pipelineMode === "clean_subtitles"
                          ? "Clean Subtitle"
                          : preset.pipelineMode === "raw_cut"
                          ? "Raw Cut 9:16"
                          : "Netflix Editorial"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action: Gunakan di Dashboard */}
                <button
                  type="button"
                  onClick={() => handleApplyToDashboard(preset)}
                  className="w-full h-9 rounded-xl bg-[#142e34] hover:bg-[#1a3d46] border border-[#20b2aa]/40 text-[#2cd3c6] hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer group-hover:bg-[#1a3d46]"
                >
                  <span>Gunakan di Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Buat Template Preset Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-[#09171b] border border-[#1e3c43] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-4 border-b border-[#183940] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#2cd3c6]" />
                <h2 className="text-sm font-bold text-white">Buat Template Preset Baru</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#132d33] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePreset} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Nama Preset
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Podcast Investigasi Moody"
                  className="w-full px-3 py-2 rounded-xl bg-[#071316] border border-[#1b3c43] text-white focus:outline-none focus:border-[#2cd3c6]"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Deskripsi Singkat
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Nuansa visual dan karakteristik gaya..."
                  className="w-full px-3 py-2 rounded-xl bg-[#071316] border border-[#1b3c43] text-white focus:outline-none focus:border-[#2cd3c6]"
                />
              </div>

              {/* Pilihan Mode Pipeline */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Mode Pipeline
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {PIPELINE_MODE_OPTIONS.map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => setFormData({ ...formData, pipelineMode: opt.id })}
                      className={`p-2.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                        formData.pipelineMode === opt.id
                          ? "bg-[#143d46] border-[#2cd3c6] text-white shadow-[0_0_10px_rgba(44,211,198,0.2)]"
                          : "bg-[#071316] border-[#1b3c43] text-[#8ca4aa] hover:border-[#2cd3c6]/40"
                      }`}
                    >
                      <div className="font-bold text-[11px] mb-0.5">{opt.name.split(" ")[0]}</div>
                      <div className="text-[10px] leading-tight opacity-80">{opt.desc.slice(0, 32)}...</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pilihan Warna Aksen Utama */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Warna Aksen Utama (Highlight & Motion)
                </label>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {ACCENT_COLOR_PRESETS.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setFormData({ ...formData, accentColor: color.hex })}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
                        formData.accentColor === color.hex
                          ? "border-white bg-[#14282e] text-white shadow-sm"
                          : "border-[#1e3c43] bg-[#071316] text-[#8ca4aa] hover:text-white"
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span>{color.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.accentColor}
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                  />
                  <input
                    type="text"
                    value={formData.accentColor}
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-[#071316] border border-[#1b3c43] text-white font-mono text-xs uppercase"
                  />
                </div>
              </div>

              {/* Font Studio (5 Font Utama) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Font Subtitle Studio
                  </label>
                  <select
                    value={formData.fontName}
                    onChange={(e) => setFormData({ ...formData, fontName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#071316] border border-[#1b3c43] text-white focus:outline-none focus:border-[#2cd3c6]"
                  >
                    {STUDIO_FONTS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Ukuran Font (pt)
                  </label>
                  <input
                    type="number"
                    min={18}
                    max={40}
                    value={formData.fontSize}
                    onChange={(e) => setFormData({ ...formData, fontSize: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-[#071316] border border-[#1b3c43] text-white focus:outline-none focus:border-[#2cd3c6]"
                  />
                </div>
              </div>

              {/* Formula Color Grading */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Formula Color Grading (FFmpeg EQ)
                </label>
                <select
                  value={formData.colorGrading}
                  onChange={(e) => setFormData({ ...formData, colorGrading: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#071316] border border-[#1b3c43] text-white focus:outline-none focus:border-[#2cd3c6]"
                >
                  {COLOR_GRADING_TEMPLATES.map((t) => (
                    <option key={t.label} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggles Fitur Modern */}
              <div className="space-y-2 pt-1">
                {/* Cold-Open Hook Toggle */}
                <div className="p-3 rounded-xl bg-[#071316] border border-[#142d33] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white">Cold-Open Hook (4.5s)</span>
                    <p className="text-[10px] text-gray-400">Cuplikan klimaks menggigit di detik 00:00 s/d 00:04</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.enableHook}
                    onChange={(e) => setFormData({ ...formData, enableHook: e.target.checked })}
                    className="w-4 h-4 accent-[#2cd3c6] cursor-pointer"
                  />
                </div>

                {/* Infografis Penjelasan Atas Toggle */}
                <div className="p-3 rounded-xl bg-[#071316] border border-[#142d33] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white">Infografis Penjelasan Atas</span>
                    <p className="text-[10px] text-gray-400">Multi-beat visual motion graphic dinamis di area atas</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.enableTopMotion}
                    onChange={(e) => setFormData({ ...formData, enableTopMotion: e.target.checked })}
                    className="w-4 h-4 accent-[#2cd3c6] cursor-pointer"
                  />
                </div>

                {/* Cinema Vignette & Audio SFX Toggle */}
                <div className="p-3 rounded-xl bg-[#071316] border border-[#142d33] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white">Cinema Vignette & Audio SFX</span>
                    <p className="text-[10px] text-gray-400">Polesan frame sinematik dan efek suara transisi whoosh</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.enablePolish}
                    onChange={(e) => setFormData({ ...formData, enablePolish: e.target.checked })}
                    className="w-4 h-4 accent-[#2cd3c6] cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#183940]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#14282e] hover:bg-[#1a343b] text-gray-300 font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#1a858c] to-[#2cd3c6] text-white font-bold flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Simpan Template Preset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
