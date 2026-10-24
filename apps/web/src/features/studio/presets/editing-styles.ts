import type { EditingStylePreset } from "./types";

export const defaultEditingStyles: EditingStylePreset[] = [
  {
    id: "renx-viral-clipper",
    name: "Renx Viral Clipper (1-Word Pop + Glow Hook)",
    description: "Gaya viral TikTok/Reels ala @renxclip tanpa banner atas, font glowing hook di awal, dan subtitle 1 kata per 1 kata.",
    icon: "🔥",
    badge: "Viral Clipper",
    layout: "talking-head",
    aspectRatio: "9:16",
  },
  {
    id: "theo-podcast",
    name: "Theo Podcast (Ambient Blur)",
    description: "Framing tengah 9:16 dengan ambient blur atas-bawah & lower third podcast",
    icon: "🎙️",
    badge: "Official Reference",
    layout: "center-ambient",
    aspectRatio: "9:16",
    sourceReference: "THEO 5-FIX.mp4",
  },
  {
    id: "netflix-documentary",
    name: "Netflix Cinematic",
    description: "Letterbox sinematik 9:16 dengan gradasi film moody dan color grade premium",
    icon: "🍿",
    badge: "Popular",
    layout: "full-crop",
    aspectRatio: "9:16",
  },
  {
    id: "split-screen-dialog",
    name: "Split Screen Talkshow",
    description: "Membagi layar atas (Narasumber) dan bawah (Host) secara simultan",
    icon: "👥",
    layout: "split-screen",
    aspectRatio: "9:16",
  },
  {
    id: "viral-fullcrop",
    name: "TikTok Dynamic Crop",
    description: "Crop dinamis wajah pembicara (Face-Tracking) memenuhi layar 9:16",
    icon: "⚡",
    layout: "talking-head",
    aspectRatio: "9:16",
  },
];

