export interface MockUserAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string;
  dailyQuota: number;
  badge: string;
  badgeColor: string;
  description: string;
}

export const MOCK_USERS: MockUserAccount[] = [
  {
    id: "user-creator-demo",
    name: "Sonia Evangelyn",
    email: "creator@diorclipping.id",
    role: "user",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    dailyQuota: 50,
    badge: "Content Creator",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    description: "Klip harian untuk Shorts/Reels & TikTok dengan preset THEO 5-FIX.",
  },
  {
    id: "user-editor-pro",
    name: "Dior Studio Editor Pro",
    email: "editor@diorclipping.id",
    role: "admin",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    dailyQuota: 50,
    badge: "Pro Video Editor",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    description: "Akses penuh pipeline rendering turbo NVENC & kustomisasi 3 pilar.",
  },
  {
    id: "user-guest-quick",
    name: "Tamu Penguji Cepat",
    email: "tamu@diorclipping.id",
    role: "user",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    dailyQuota: 50,
    badge: "Tamu Cepat",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    description: "Coba langsung auto-cut video YouTube tanpa perlu verifikasi email.",
  },
];

export const DEFAULT_MOCK_PASSWORD = "Password123!";

