import { Sparkles, Eye, ShieldCheck, UserCheck, AlertCircle } from "lucide-react";

interface ProfileLivePreviewCardProps {
  name: string;
  avatarUrl: string;
  badge: string;
  email: string;
  isDirty: boolean;
}

export function ProfileLivePreviewCard({
  name,
  avatarUrl,
  badge,
  email,
  isDirty,
}: ProfileLivePreviewCardProps) {
  const displayName = name.trim() || "Nama Pengguna";

  return (
    <div className="rounded-2xl border border-[#1a363d] bg-gradient-to-br from-[#0c1c20] via-[#09171b] to-[#071316] p-5 sm:p-6 shadow-xl relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-[#2cd3c6]/10 blur-2xl pointer-events-none" />

      {/* Header with Live Status */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#142f36]">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#2cd3c6]" />
          <h3 className="text-sm font-bold text-white tracking-wide">
            Pratinjau Langsung Profil
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {isDirty ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>Belum Disimpan</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Tersinkronisasi</span>
            </span>
          )}
        </div>
      </div>

      {/* Card Visual Preview */}
      <div className="p-4 rounded-xl bg-[#09181c] border border-[#193a42] flex flex-col items-center text-center relative group">
        {/* Avatar preview */}
        <div className="relative mb-3">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#2cd3c6] shadow-[0_0_15px_rgba(44,211,198,0.3)] bg-[#12282e]">
            <img
              src={avatarUrl || "/images/michael_avatar.png"}
              alt={displayName}
              className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/images/michael_avatar.png";
              }}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#0a171a] border border-[#2cd3c6] text-[#2cd3c6]">
            <Sparkles className="w-3 h-3" />
          </div>
        </div>

        {/* Name and role */}
        <h4 className="text-base font-bold text-white tracking-wide truncate max-w-full">
          {displayName}
        </h4>
        <span className="text-xs text-[#8ca4aa] truncate max-w-full mb-2">
          {email}
        </span>

        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40">
          {badge}
        </span>
      </div>

      {/* Simulation: Navbar Header Pill Preview */}
      <div className="mt-4 pt-3 border-t border-[#142f36]/70">
        <span className="text-[11px] font-semibold text-[#8ca4aa] block mb-2">
          Tampilan di Header Navigasi Atas:
        </span>
        <div className="p-2.5 rounded-xl bg-[#071316] border border-[#142f36] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden border border-[#2cd3c6] bg-[#12282e] shrink-0">
              <img
                src={avatarUrl || "/images/michael_avatar.png"}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-gray-100 truncate max-w-[120px]">
                {displayName}
              </span>
              <span className="text-[9px] text-slate-400 leading-none">
                {badge}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-[#2cd3c6] font-mono font-bold bg-[#0d272e] px-2 py-0.5 rounded border border-[#2cd3c6]/30">
            50 Klip/Hari
          </span>
        </div>
      </div>
    </div>
  );
}

