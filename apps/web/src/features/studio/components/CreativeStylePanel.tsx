import { useState } from "react";
import {
  Film,
  Sparkles,
  Type,
  Plus,
  Check,
  ChevronDown,
  Info,
  Wand2,
} from "lucide-react";
import type {
  EditingStylePreset,
  MotionGraphicPreset,
  SubtitleStylePreset,
} from "../presets/types";

interface CreativeStylePanelProps {
  editingStyle: string;
  setEditingStyle: (id: string) => void;
  motionGraphicStyle: string;
  setMotionGraphicStyle: (id: string) => void;
  subtitleStyle: string;
  setSubtitleStyle: (id: string) => void;
  editingStyles: EditingStylePreset[];
  motionGraphics: MotionGraphicPreset[];
  subtitleStyles: SubtitleStylePreset[];
  onAddNewPreset: (category: "editing" | "motion" | "subtitle", preset: any) => void;
  disabled?: boolean;
}

export function CreativeStylePanel({
  editingStyle,
  setEditingStyle,
  motionGraphicStyle,
  setMotionGraphicStyle,
  subtitleStyle,
  setSubtitleStyle,
  editingStyles,
  motionGraphics,
  subtitleStyles,
  onAddNewPreset,
  disabled = false,
}: CreativeStylePanelProps) {
  const [modalOpen, setModalOpen] = useState<"editing" | "motion" | "subtitle" | null>(null);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetDesc, setNewPresetDesc] = useState("");

  const currentEditing =
    editingStyles.find((s) => s.id === editingStyle) || editingStyles[0];
  const currentMotion =
    motionGraphics.find((m) => m.id === motionGraphicStyle) || motionGraphics[0];
  const currentSubtitle =
    subtitleStyles.find((sub) => sub.id === subtitleStyle) || subtitleStyles[0];

  const handleSaveNewPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalOpen || !newPresetName.trim()) return;

    const id = newPresetName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const newObj = {
      id,
      name: newPresetName.trim(),
      description: newPresetDesc.trim() || "Preset kustom buatan pengguna",
      icon: modalOpen === "editing" ? "🎬" : modalOpen === "motion" ? "🪄" : "✍️",
      badge: "Kustom",
    };

    onAddNewPreset(modalOpen, newObj);
    if (modalOpen === "editing") setEditingStyle(id);
    if (modalOpen === "motion") setMotionGraphicStyle(id);
    if (modalOpen === "subtitle") setSubtitleStyle(id);

    setNewPresetName("");
    setNewPresetDesc("");
    setModalOpen(null);
  };

  return (
    <div className="pt-3.5 border-t border-[#1b373e]/60 mt-3.5">
      {/* Section Title */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-[#2cd3c6]" />
          <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide">
            Kombinasi Gaya AI Terpisah (Edit Style • Motion Graphics • Subtitle)
          </h4>
        </div>
        <span className="text-[10px] text-[#7d979e] hidden sm:inline-block">
          Pilih 3 gaya terpisah — AI akan mengedit video sesuai kombinasi ini
        </span>
      </div>

      {/* 3 Distinct Preset Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Box 1: Gaya Editing (Edit Style) */}
        <div className="bg-[#12282f]/90 border border-[#1e3e46] rounded-xl p-3 flex flex-col justify-between transition-all hover:border-[#2cd3c6]/40">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[#8ca4aa] flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-[#2cd3c6]" />
                <span>1. Gaya Editing (Video Layout)</span>
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setModalOpen("editing")}
                className="text-[10px] text-[#2cd3c6] hover:text-[#42e8dc] font-medium flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                title="Tambah Preset Gaya Editing Baru"
              >
                <Plus className="w-3 h-3" />
                <span>Preset</span>
              </button>
            </div>

            {/* Custom Select Box */}
            <div className="relative mb-2">
              <select
                value={editingStyle}
                onChange={(e) => setEditingStyle(e.target.value)}
                disabled={disabled}
                className="w-full bg-[#162f36] border border-[#23474f] text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 appearance-none focus:outline-none focus:border-[#2cd3c6] cursor-pointer"
              >
                {editingStyles.map((item) => (
                  <option key={item.id} value={item.id} className="bg-[#10272c] text-white">
                    {item.icon} {item.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#79949a] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <p className="text-[11px] text-[#8aa3a9] leading-tight line-clamp-2">
              {currentEditing?.description}
            </p>
          </div>

          <div className="mt-2 pt-2 border-t border-[#1a383f] flex items-center justify-between text-[10px] text-[#6e8a90]">
            <span>Layout: 9:16 Vertikal</span>
            {currentEditing?.badge && (
              <span className="px-1.5 py-0.2 rounded bg-[#163840] text-[#2cd3c6] font-mono text-[9px]">
                {currentEditing.badge}
              </span>
            )}
          </div>
        </div>

        {/* Box 2: Gaya Motion Graphic */}
        <div className="bg-[#12282f]/90 border border-[#1e3e46] rounded-xl p-3 flex flex-col justify-between transition-all hover:border-[#2cd3c6]/40">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[#8ca4aa] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#2cd3c6]" />
                <span>2. Motion Graphics (Animasi)</span>
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setModalOpen("motion")}
                className="text-[10px] text-[#2cd3c6] hover:text-[#42e8dc] font-medium flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                title="Tambah Preset Motion Graphic Baru"
              >
                <Plus className="w-3 h-3" />
                <span>Preset</span>
              </button>
            </div>

            {/* Custom Select Box */}
            <div className="relative mb-2">
              <select
                value={motionGraphicStyle}
                onChange={(e) => setMotionGraphicStyle(e.target.value)}
                disabled={disabled}
                className="w-full bg-[#162f36] border border-[#23474f] text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 appearance-none focus:outline-none focus:border-[#2cd3c6] cursor-pointer"
              >
                {motionGraphics.map((item) => (
                  <option key={item.id} value={item.id} className="bg-[#10272c] text-white">
                    {item.icon} {item.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#79949a] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <p className="text-[11px] text-[#8aa3a9] leading-tight line-clamp-2">
              {currentMotion?.description}
            </p>
          </div>

          <div className="mt-2 pt-2 border-t border-[#1a383f] flex items-center justify-between text-[10px] text-[#6e8a90]">
            <span className="truncate">Elemen: {currentMotion?.type}</span>
            {currentMotion?.badge && (
              <span className="px-1.5 py-0.2 rounded bg-[#163840] text-[#2cd3c6] font-mono text-[9px]">
                {currentMotion.badge}
              </span>
            )}
          </div>
        </div>

        {/* Box 3: Gaya Subtitle */}
        <div className="bg-[#12282f]/90 border border-[#1e3e46] rounded-xl p-3 flex flex-col justify-between transition-all hover:border-[#2cd3c6]/40">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[#8ca4aa] flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-[#2cd3c6]" />
                <span>3. Gaya Subtitle (Tipografi)</span>
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setModalOpen("subtitle")}
                className="text-[10px] text-[#2cd3c6] hover:text-[#42e8dc] font-medium flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                title="Tambah Preset Gaya Subtitle Baru"
              >
                <Plus className="w-3 h-3" />
                <span>Preset</span>
              </button>
            </div>

            {/* Custom Select Box */}
            <div className="relative mb-2">
              <select
                value={subtitleStyle}
                onChange={(e) => setSubtitleStyle(e.target.value)}
                disabled={disabled}
                className="w-full bg-[#162f36] border border-[#23474f] text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 appearance-none focus:outline-none focus:border-[#2cd3c6] cursor-pointer"
              >
                {subtitleStyles.map((item) => (
                  <option key={item.id} value={item.id} className="bg-[#10272c] text-white">
                    {item.icon} {item.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#79949a] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <p className="text-[11px] text-[#8aa3a9] leading-tight line-clamp-2">
              {currentSubtitle?.description}
            </p>
          </div>

          {/* Subtitle Mini Live Preview Badge */}
          <div className="mt-2 pt-2 border-t border-[#1a383f] flex items-center justify-between text-[10px]">
            <span className="text-[#6e8a90]">Pratinjau:</span>
            {currentSubtitle.highlightStyle === "red-pill" ? (
              <span className="inline-flex items-center gap-1">
                <span className="text-white text-[10px]">Teks</span>
                <span className="bg-red-600 text-white font-bold text-[9px] px-1 rounded">Keyword</span>
              </span>
            ) : currentSubtitle.highlightStyle === "yellow-glow" ? (
              <span className="text-amber-300 font-bold text-[10px] drop-shadow-sm">
                KEYWORD
              </span>
            ) : (
              <span className="text-white font-medium text-[10px]">
                Clean White
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Modal: Tambah Preset Kustom Baru */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm bg-[#0e2125] border border-[#2cd3c6]/40 rounded-2xl p-5 shadow-2xl text-slate-100">
            <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#2cd3c6]" />
              <span>
                Tambah Preset{" "}
                {modalOpen === "editing"
                  ? "Gaya Editing"
                  : modalOpen === "motion"
                  ? "Motion Graphic"
                  : "Gaya Subtitle"}
              </span>
            </h4>
            <p className="text-xs text-[#7d979e] mb-4">
              Preset ini akan disimpan di folder preset dan dapat dipilih kapan saja.
            </p>

            <form onSubmit={handleSaveNewPreset} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-[#8ca4aa] block mb-1">
                  Nama Preset
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Alex Hormozi Style, MrBeast Pop..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="w-full h-9 bg-[#14282e] border border-[#1f3e46] rounded-lg px-3 text-xs text-white placeholder-[#58737a] focus:outline-none focus:border-[#2cd3c6]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8ca4aa] block mb-1">
                  Deskripsi Gaya
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan layout, warna keyword, atau animasi..."
                  value={newPresetDesc}
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  className="w-full bg-[#14282e] border border-[#1f3e46] rounded-lg p-2.5 text-xs text-white placeholder-[#58737a] focus:outline-none focus:border-[#2cd3c6] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-[#1b373e]">
                <button
                  type="button"
                  onClick={() => setModalOpen(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#14282e] text-[#8fa4aa] hover:text-white text-xs font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#20b2aa] hover:bg-[#2cd3c6] text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Preset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
