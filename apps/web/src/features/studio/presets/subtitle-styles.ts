import type { SubtitleStylePreset } from "./types";

export const defaultSubtitleStyles: SubtitleStylePreset[] = [
  {
    id: "theo-red-pill",
    name: "Red Pill Highlight (Theo Style)",
    description: "Font sans-serif bold, badge speaker NARASUMBER/HOST, kata kunci kotak merah menyala",
    icon: "🔴",
    badge: "Matching Reference",
    fontFamily: "Inter, Helvetica Neue, sans-serif",
    speakerBadge: true,
    highlightStyle: "red-pill",
  },
  {
    id: "netflix-minimal",
    name: "Netflix Clean White",
    description: "Teks putih bersih dengan bayangan hitam tegas, proporsional, dan minimalis",
    icon: "🍿",
    fontFamily: "Netflix Sans, Arial, sans-serif",
    speakerBadge: false,
    highlightStyle: "white-shadow",
  },
  {
    id: "viral-yellow-pop",
    name: "Viral Yellow Pop (TikTok)",
    description: "Font tebal huruf kapital dengan outline hitam tebal dan highlight kuning neon",
    icon: "⚡",
    fontFamily: "Montserrat, Impact, sans-serif",
    speakerBadge: false,
    highlightStyle: "yellow-glow",
  },
  {
    id: "karaoke-bounce",
    name: "Karaoke Word-by-Word",
    description: "Teks memantul kata-per-kata secara langsung saat pembicara mengucapkannya",
    icon: "🎤",
    fontFamily: "Inter, sans-serif",
    speakerBadge: false,
    highlightStyle: "karaoke",
  },
];
