import { useState } from "react";
import {
  Film,
  Wand2,
  Type,
  Plus,
  Check,
  Sparkles,
  FolderOpen,
  Sliders,
  Highlighter,
  Clock,
  Volume2,
  Eye,
} from "lucide-react";
import type {
  AutoEditClipItem,
  AutoEditClipConfig,
  EditingStylePreset,
  MotionGraphicPreset,
  SubtitleStylePreset,
} from "../types";

interface ThreePillarStyleWorkspaceProps {
  clip: AutoEditClipItem;
  editingStyles: EditingStylePreset[];
  motionGraphics: MotionGraphicPreset[];
  subtitleStyles: SubtitleStylePreset[];
  onUpdateConfig: (partial: Partial<AutoEditClipConfig>) => void;
  onUpdateSubtitleLine: (
    lineId: string,
    updates: { text?: string; speaker?: "NARASUMBER" | "HOST" }
  ) => void;
  onAddNewPreset: (
    pillar: "editing" | "motion" | "subtitle",
    preset: any
  ) => void;
  onJumpToTime: (seconds: number) => void;
}

export function ThreePillarStyleWorkspace({
  clip,
  editingStyles,
  motionGraphics,
  subtitleStyles,
  onUpdateConfig,
  onUpdateSubtitleLine,
  onAddNewPreset,
  onJumpToTime,
}: ThreePillarStyleWorkspaceProps) {
  const [activeModal, setActiveModal] = useState<
    "editing" | "motion" | "subtitle" | null
  >(null);
  const [presetName, setPresetName] = useState("");
  const [presetDesc, setPresetDesc] = useState("");
  const [referenceFolderScanned, setReferenceFolderScanned] = useState(false);

  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal || !presetName.trim()) return;

    const id = `${activeModal}-${Date.now()}`;
    if (activeModal === "editing") {
      const newEditing: EditingStylePreset = {
        id,
        name: presetName.trim(),
        description:
          presetDesc.trim() ||
          "Gaya framing & transisi sinematik kustom buatan pengguna",
        icon: "🎬",
        badge: "Custom Preset",
        layout: "center-ambient",
        aspectRatio: "9:16",
      };
      onAddNewPreset("editing", newEditing);
      onUpdateConfig({ editingStyleId: id });
    } else if (activeModal === "motion") {
      const newMotion: MotionGraphicPreset = {
        id,
        name: presetName.trim(),
        description:
          presetDesc.trim() ||
          "Animasi infografis & progress bar dinamis kustom",
        icon: "🪄",
        badge: "Custom Preset",
        type: "infographic-bars",
        features: ["Custom Overlay", "Dynamic Keyframes"],
      };
      onAddNewPreset("motion", newMotion);
      onUpdateConfig({ motionGraphicId: id });
    } else if (activeModal === "subtitle") {
      const newSub: SubtitleStylePreset = {
        id,
        name: presetName.trim(),
        description:
          presetDesc.trim() ||
          "Tipografi subtitle & highlight kata kunci kustom",
        icon: "✍️",
        badge: "Custom Preset",
        fontFamily: "Inter, sans-serif",
        speakerBadge: true,
        highlightStyle: "red-pill",
      };
      onAddNewPreset("subtitle", newSub);
      onUpdateConfig({ subtitleStyleId: id });
    }

    setPresetName("");
    setPresetDesc("");
    setActiveModal(null);
  };

  const handleScanReferenceFolder = () => {
    setReferenceFolderScanned(true);
    setTimeout(() => setReferenceFolderScanned(false), 3500);
  };

  const handleWrapHighlightWord = (lineId: string, currentText: string) => {
    if (currentText.includes("<hl>")) {
      // Remove highlight tags if already highlighted
      onUpdateSubtitleLine(lineId, {
        text: currentText.replace(/<\/?hl>/g, ""),
      });
      return;
    }
    // Highlight the first 2-3 impactful words
    const words = currentText.split(" ");
    if (words.length >= 3) {
      const highlighted = `${words[0]} <hl>${words[1]} ${words[2]}</hl> ${words
        .slice(3)
        .join(" ")}`;
      onUpdateSubtitleLine(lineId, { text: highlighted.trim() });
    } else {
      onUpdateSubtitleLine(lineId, { text: `<hl>${currentText}</hl>` });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* =====================================================================
          PILAR 1: GAYA EDIT SINEMATIK (EDITING STYLE & LAYOUT)
      ===================================================================== */}
      <section className="bg-[#0e2125]/90 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#20b2aa]/15 border border-[#2cd3c6]/30 flex items-center justify-center text-[#2cd3c6]">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>1. Gaya Edit Sinematik (Video Framing & Transisi)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#13363e] text-[#2cd3c6] border border-[#2cd3c6]/30 font-semibold">
                  Pilar 1
                </span>
              </h3>
              <p className="text-[11px] text-[#8ca4aa]">
                Mengatur tata letak kamera 9:16, ambient blur, transisi antar-potongan, dan gradasi warna film.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleScanReferenceFolder}
              className="px-2.5 py-1.5 rounded-xl bg-[#142c33] hover:bg-[#1a3a43] border border-[#2cd3c6]/30 text-[#2cd3c6] text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Baca referensi video dari folder lokal DIOR_CLIPPING"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>
                {referenceFolderScanned
                  ? "THEO 5-FIX.mp4 Terbaca ✅"
                  : "Baca Folder Referensi"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal("editing")}
              className="px-2.5 py-1.5 rounded-xl bg-[#20b2aa] hover:bg-[#2cd3c6] text-black text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Tambah Preset Edit</span>
            </button>
          </div>
        </div>

        {/* Preset Cards Grid for Editing Style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3.5">
          {editingStyles.map((style) => {
            const isSelected = clip.config.editingStyleId === style.id;
            return (
              <div
                key={style.id}
                onClick={() => onUpdateConfig({ editingStyleId: style.id })}
                className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? "bg-[#14373f] border-[#2cd3c6] shadow-[0_0_15px_rgba(44,211,198,0.2)]"
                    : "bg-[#12262b]/80 border-[#1d3940] hover:border-[#2cd3c6]/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{style.icon}</span>
                    <span className="text-xs font-bold text-white">
                      {style.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {style.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 font-semibold">
                        {style.badge}
                      </span>
                    )}
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-[#2cd3c6] text-black flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-[#93adb3] leading-snug">
                  {style.description}
                </p>
                {style.sourceReference && (
                  <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Ref: {style.sourceReference}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sub-controls: Transition & Color Grade */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#1b373e]">
          <div>
            <label className="block text-[11px] font-semibold text-[#8ca4aa] mb-1">
              Gaya Transisi Antar-Potongan:
            </label>
            <select
              value={clip.config.transitionType}
              onChange={(e) =>
                onUpdateConfig({
                  transitionType: e.target
                    .value as AutoEditClipConfig["transitionType"],
                })
              }
              className="w-full h-8 bg-[#14282e] border border-[#1f3e46] focus:border-[#2cd3c6] rounded-xl px-2.5 text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="j-cut-cinema">🎬 J-Cut Sinematik (Audio Halus ala Netflix)</option>
              <option value="jump-cut">⚡ Jump Cut Cepat (Tanpa Jeda Nafas)</option>
              <option value="flash-zoom">💥 Flash Punch-In Transition</option>
              <option value="smooth-dissolve">🌊 Smooth Cross-Dissolve</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#8ca4aa] mb-1">
              Tone & Color Grading Sinematik:
            </label>
            <select
              value={clip.config.colorGrade}
              onChange={(e) =>
                onUpdateConfig({
                  colorGrade: e.target.value as AutoEditClipConfig["colorGrade"],
                })
              }
              className="w-full h-8 bg-[#14282e] border border-[#1f3e46] focus:border-[#2cd3c6] rounded-xl px-2.5 text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="dark-teal-moody">🌑 Dark Moody Teal (Theo Reference)</option>
              <option value="netflix-warm">🍿 Netflix Warm Documentary</option>
              <option value="crisp-contrast">✨ Crisp High-Contrast Studio</option>
              <option value="natural">🌿 Natural Original Video</option>
            </select>
          </div>
        </div>
      </section>

      {/* =====================================================================
          PILAR 2: MOTION GRAPHIC PILIHAN (INFOGRAFIS & VISUAL OVERLAY)
      ===================================================================== */}
      <section className="bg-[#0e2125]/90 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>2. Motion Graphic Pilihan (Infografis & Animasi)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950/60 text-purple-300 border border-purple-400/30 font-semibold">
                  Pilar 2
                </span>
              </h3>
              <p className="text-[11px] text-[#8ca4aa]">
                Pilih elemen visual dinamis seperti kartu bar infografis atas, counter statistik, dan zoom otomatis.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveModal("motion")}
            className="px-2.5 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-black text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Tambah Preset Motion</span>
          </button>
        </div>

        {/* Preset Cards Grid for Motion Graphics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3.5">
          {motionGraphics.map((motion) => {
            const isSelected = clip.config.motionGraphicId === motion.id;
            return (
              <div
                key={motion.id}
                onClick={() =>
                  onUpdateConfig({
                    motionGraphicId: motion.id,
                    infographicEnabled: motion.type !== "none",
                  })
                }
                className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? "bg-purple-950/40 border-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.2)]"
                    : "bg-[#12262b]/80 border-[#1d3940] hover:border-purple-400/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{motion.icon}</span>
                    <span className="text-xs font-bold text-white">
                      {motion.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {motion.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-400/30 font-semibold">
                        {motion.badge}
                      </span>
                    )}
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-purple-400 text-black flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-[#93adb3] leading-snug">
                  {motion.description}
                </p>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {motion.features.map((feat, i) => (
                    <span
                      key={i}
                      className="text-[9px] px-1.5 py-0.2 rounded bg-black/40 text-gray-300 border border-white/10"
                    >
                      {feat}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Toggle Switches for Individual Motion Elements */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-[#1b373e]">
          <button
            type="button"
            onClick={() =>
              onUpdateConfig({
                infographicEnabled: !clip.config.infographicEnabled,
              })
            }
            className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
              clip.config.infographicEnabled
                ? "bg-[#14353d] border-[#2cd3c6]/50 text-white"
                : "bg-[#112227] border-[#1c363e] text-[#6d868c]"
            }`}
          >
            <span className="text-[11px] font-semibold">📊 Infografis Atas</span>
            <span
              className={`w-2 h-2 rounded-full ${
                clip.config.infographicEnabled ? "bg-[#2cd3c6]" : "bg-gray-600"
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateConfig({ autoZoomEnabled: !clip.config.autoZoomEnabled })
            }
            className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
              clip.config.autoZoomEnabled
                ? "bg-[#14353d] border-[#2cd3c6]/50 text-white"
                : "bg-[#112227] border-[#1c363e] text-[#6d868c]"
            }`}
          >
            <span className="text-[11px] font-semibold">🔍 Auto Punch Zoom</span>
            <span
              className={`w-2 h-2 rounded-full ${
                clip.config.autoZoomEnabled ? "bg-[#2cd3c6]" : "bg-gray-600"
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateConfig({
                progressBarEnabled: !clip.config.progressBarEnabled,
              })
            }
            className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
              clip.config.progressBarEnabled
                ? "bg-[#14353d] border-[#2cd3c6]/50 text-white"
                : "bg-[#112227] border-[#1c363e] text-[#6d868c]"
            }`}
          >
            <span className="text-[11px] font-semibold">⏳ Progress Bar</span>
            <span
              className={`w-2 h-2 rounded-full ${
                clip.config.progressBarEnabled ? "bg-[#2cd3c6]" : "bg-gray-600"
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateConfig({ sfxEnabled: !clip.config.sfxEnabled })
            }
            className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
              clip.config.sfxEnabled
                ? "bg-[#14353d] border-[#2cd3c6]/50 text-white"
                : "bg-[#112227] border-[#1c363e] text-[#6d868c]"
            }`}
          >
            <span className="text-[11px] font-semibold">🔊 SFX Transisi</span>
            <span
              className={`w-2 h-2 rounded-full ${
                clip.config.sfxEnabled ? "bg-[#2cd3c6]" : "bg-gray-600"
              }`}
            />
          </button>
        </div>
      </section>

      {/* =====================================================================
          PILAR 3: SUBTITLE OTOMATIS & LIVE EDITOR TRANSKRIP
      ===================================================================== */}
      <section className="bg-[#0e2125]/90 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-400/30 flex items-center justify-center text-rose-300">
              <Type className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>3. Subtitle Otomatis & Editor Kata Kunci</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950/60 text-rose-300 border border-rose-400/30 font-semibold">
                  Pilar 3
                </span>
              </h3>
              <p className="text-[11px] text-[#8ca4aa]">
                Transkripsi otomatis dengan penanda pembicara (NARASUMBER / HOST) dan highlight kata kunci kotak merah.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Master Toggle Subtitle Otomatis */}
            <button
              type="button"
              role="switch"
              aria-checked={clip.config.subtitleEnabled}
              onClick={() =>
                onUpdateConfig({
                  subtitleEnabled: !clip.config.subtitleEnabled,
                })
              }
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer flex items-center gap-2 ${
                clip.config.subtitleEnabled
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                  : "bg-[#14282e] text-gray-400 border-white/10"
              }`}
            >
              <span
                className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                  clip.config.subtitleEnabled ? "bg-emerald-400" : "bg-gray-600"
                }`}
              >
                <span
                  className={`w-3 h-3 rounded-full bg-black transition-transform ${
                    clip.config.subtitleEnabled ? "translate-x-3" : "translate-x-0"
                  }`}
                />
              </span>
              <span>
                Subtitle Klip #{clip.rank}:{" "}
                {clip.config.subtitleEnabled ? "AKTIF (ON)" : "MATI (OFF)"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal("subtitle")}
              className="px-2.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Tambah Preset Subtitle</span>
            </button>
          </div>
        </div>

        {/* Dedicated Per-Clip Automatic Subtitle Status Banner */}
        <div
          className={`mb-3.5 p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
            clip.config.subtitleEnabled
              ? "bg-[#11292f]/90 border-emerald-500/35"
              : "bg-rose-950/25 border-rose-500/30"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide uppercase ${
                clip.config.subtitleEnabled
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                  : "bg-gray-800 text-gray-400 border border-gray-600"
              }`}
            >
              {clip.config.subtitleEnabled ? "CC AUTO: ON" : "CC AUTO: OFF"}
            </span>
            <div>
              <p className="text-xs font-bold text-white">
                Status Subtitle Otomatis — Klip #{clip.rank} ({clip.title})
              </p>
              <p className="text-[11px] text-[#8ca4aa]">
                {clip.config.subtitleEnabled
                  ? `Menampilkan ${clip.subtitles.length} baris transkrip AI sinkron suara dengan label pembicara otomatis di layar 9:16.`
                  : "Subtitle otomatis dinonaktifkan untuk klip ini. Video akan dirender bersih tanpa teks subtitle."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdateConfig({
                subtitleEnabled: !clip.config.subtitleEnabled,
              })
            }
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 ${
              clip.config.subtitleEnabled
                ? "bg-[#17353d] hover:bg-[#1e434d] text-[#9ab4ba] hover:text-white border border-[#254b54]"
                : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-md"
            }`}
          >
            {clip.config.subtitleEnabled
              ? "Matikan Subtitle Klip Ini"
              : "Aktifkan Subtitle Klip Ini"}
          </button>
        </div>

        {/* Preset Cards Grid for Subtitle Style */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3.5 transition-opacity ${
            clip.config.subtitleEnabled ? "opacity-100" : "opacity-50"
          }`}
        >
          {subtitleStyles.map((sub) => {
            const isSelected = clip.config.subtitleStyleId === sub.id;
            return (
              <div
                key={sub.id}
                onClick={() =>
                  onUpdateConfig({
                    subtitleStyleId: sub.id,
                    subtitleEnabled: true,
                  })
                }
                className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? "bg-rose-950/35 border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                    : "bg-[#12262b]/80 border-[#1d3940] hover:border-rose-400/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{sub.icon}</span>
                    <span className="text-xs font-bold text-white">
                      {sub.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {sub.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/30 font-semibold">
                        {sub.badge}
                      </span>
                    )}
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-rose-400 text-black flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-[#93adb3] leading-snug">
                  {sub.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Position & Font Size Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3 border-t border-b border-[#1b373e] mb-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-[#8ca4aa] mb-1">
              Posisi Subtitle di Layar 9:16:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "bottom", label: "Bawah (Optimal)" },
                  { id: "center", label: "Tengah (Hook)" },
                  { id: "top", label: "Atas" },
                ] as const
              ).map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => onUpdateConfig({ subtitlePosition: pos.id })}
                  className={`h-7 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                    clip.config.subtitlePosition === pos.id
                      ? "bg-[#20b2aa] text-white border-[#2cd3c6]"
                      : "bg-[#14282e] text-[#8ca4aa] border-[#1f3e46] hover:text-white"
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#8ca4aa] mb-1">
              Ukuran Huruf Subtitle:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "sm", label: "Kecil" },
                  { id: "md", label: "Sedang (Default)" },
                  { id: "lg", label: "Besar (Pop)" },
                ] as const
              ).map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => onUpdateConfig({ subtitleSize: sz.id })}
                  className={`h-7 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                    clip.config.subtitleSize === sz.id
                      ? "bg-[#20b2aa] text-white border-[#2cd3c6]"
                      : "bg-[#14282e] text-[#8ca4aa] border-[#1f3e46] hover:text-white"
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Interactive Subtitle Transcript Lines Editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#2cd3c6]" />
              <span>Editor Baris Subtitle & Highlight Merah (Klik untuk Lompat Waktu)</span>
            </span>
            <span className="text-[10px] text-[#8ca4aa]">
              Gunakan tag <code className="text-rose-400">&lt;hl&gt;kata&lt;/hl&gt;</code> untuk kotak merah
            </span>
          </div>

          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {clip.subtitles.map((line) => (
              <div
                key={line.id}
                onClick={() => onJumpToTime(line.startTime)}
                className="p-2.5 rounded-xl bg-[#12262b] border border-[#1d3b43] hover:border-[#2cd3c6]/50 transition flex flex-col gap-2 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#2cd3c6] bg-[#0b191c] px-2 py-0.5 rounded border border-[#1e3c43] flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>
                        0:{line.startTime < 10 ? `0${line.startTime}` : line.startTime} - 0:
                        {line.endTime < 10 ? `0${line.endTime}` : line.endTime}
                      </span>
                    </span>

                    {/* Speaker toggle button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSubtitleLine(line.id, {
                          speaker:
                            line.speaker === "NARASUMBER" ? "HOST" : "NARASUMBER",
                        });
                      }}
                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border cursor-pointer ${
                        line.speaker === "HOST"
                          ? "bg-cyan-950 text-cyan-400 border-cyan-700"
                          : "bg-red-950 text-red-400 border-red-700"
                      }`}
                      title="Klik untuk ganti pembicara (NARASUMBER / HOST)"
                    >
                      {line.speaker} ↻
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWrapHighlightWord(line.id, line.text);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition"
                  >
                    <Highlighter className="w-3 h-3" />
                    <span>
                      {line.text.includes("<hl>")
                        ? "Hapus Highlight"
                        : "+ Highlight Merah"}
                    </span>
                  </button>
                </div>

                <input
                  type="text"
                  value={line.text}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    onUpdateSubtitleLine(line.id, { text: e.target.value })
                  }
                  className="w-full h-8 bg-[#0b181b] border border-[#1a353c] focus:border-[#2cd3c6] rounded-lg px-2.5 text-xs text-white focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modal for Adding New Custom Preset to Any of the 3 Pillars */}
      {activeModal && (
        <div
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#0e2125] border border-[#2cd3c6]/50 rounded-2xl p-5 shadow-2xl text-slate-100"
          >
            <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2cd3c6]" />
              <span>
                Tambah Preset Baru —{" "}
                {activeModal === "editing"
                  ? "Gaya Edit Sinematik"
                  : activeModal === "motion"
                  ? "Motion Graphic"
                  : "Gaya Subtitle"}
              </span>
            </h4>
            <p className="text-xs text-[#8ca4aa] mb-4">
              Simpan konfigurasi favoritmu agar bisa langsung dipilih untuk video berikutnya.
            </p>

            <form onSubmit={handleCreatePreset} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs text-gray-300 mb-1 font-medium">
                  Nama Preset Baru:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Netflix Dark Documentary v2"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="w-full h-9 bg-[#14282e] border border-[#1f3e46] focus:border-[#2cd3c6] rounded-xl px-3 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1 font-medium">
                  Deskripsi Karakteristik Gaya:
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Framing tengah dengan zoom halus & subtitle merah"
                  value={presetDesc}
                  onChange={(e) => setPresetDesc(e.target.value)}
                  className="w-full bg-[#14282e] border border-[#1f3e46] focus:border-[#2cd3c6] rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#14282e] text-gray-300 text-xs font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#17858c] to-[#2cd3c6] text-white text-xs font-bold cursor-pointer shadow-md"
                >
                  Simpan & Gunakan Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
