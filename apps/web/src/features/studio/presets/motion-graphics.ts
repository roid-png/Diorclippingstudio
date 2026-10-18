import type { MotionGraphicPreset } from "./types";

export const defaultMotionGraphics: MotionGraphicPreset[] = [
  {
    id: "theo-infographics",
    name: "Infografis & Stat Counter (Theo)",
    description: "Kartu analitik atas: bar persentase risiko, counter angka 0+, dan grafik tren",
    icon: "📊",
    badge: "From Reference",
    type: "infographic-bars",
    features: ["Top Card Risk Bar", "Live Number Counter", "Trend Line Chart"],
  },
  {
    id: "progress-dynamic-zoom",
    name: "Progress Bar & Punch Zoom",
    description: "Progress bar waktu di bawah video dengan efek punch-in zoom tiap pergantian kata",
    icon: "🔍",
    badge: "High Engagement",
    type: "progress-zoom",
    features: ["Bottom Progress Bar", "Punch-In Zoom", "Subtle Shake"],
  },
  {
    id: "lower-third-highlight",
    name: "Lower Third & Topic Tag",
    description: "Badge label pembicara di sudut kiri bawah dengan aksen garis merah & judul topik",
    icon: "🏷️",
    type: "stat-counter",
    features: ["Red Line Topic Tag", "Channel Logo Badge", "Podcast Info"],
  },
  {
    id: "none",
    name: "Tanpa Motion Graphic",
    description: "Tampilan bersih murni video dan subtitle tanpa elemen grafis tambahan",
    icon: "🚫",
    type: "none",
    features: ["Clean Video Only"],
  },
];
