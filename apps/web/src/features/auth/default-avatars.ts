export interface DefaultAvatarOption {
  id: string;
  name: string;
  url: string;
  tag: string;
  description: string;
}

export const DEFAULT_AVATARS: DefaultAvatarOption[] = [
  {
    id: "creator-violet",
    name: "Sonia Creator",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    tag: "Content Creator",
    description: "Cocok untuk kreator konten gaya hidup, reels, & vlogger",
  },
  {
    id: "editor-pro",
    name: "Dior Studio Pro",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    tag: "Video Editor",
    description: "Pilihan editor profesional untuk workflow rendering intensif",
  },
  {
    id: "streamer-cyan",
    name: "Cyber Streamer",
    url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    tag: "Streamer & Gamer",
    description: "Karakter futuristik bernuansa neon cyberpunk",
  },
  {
    id: "podcast-amber",
    name: "Theo Podcaster",
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    tag: "Talkshow & Podcast",
    description: "Gaya fokus audio, wawancara mendalam & cuplikan opini viral",
  },
  {
    id: "minimalist-rose",
    name: "Alana Minimalist",
    url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    tag: "Creative Director",
    description: "Tampilan modern, estetis, dan rapi untuk kurator video",
  },
  {
    id: "classic-michael",
    name: "Michael Klasik",
    url: "/images/michael_avatar.png",
    tag: "Bawaan Sistem",
    description: "Avatar maskot asli Dior Clipping dengan lingkaran kontras",
  },
];

