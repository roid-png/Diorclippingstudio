import { Film, Sparkles, Video, Play } from "lucide-react";

interface EmptyClipsStateProps {
  onLoadSample?: () => void;
}

export function EmptyClipsState({ onLoadSample }: EmptyClipsStateProps) {
  return (
    <div className="w-full bg-[#0e2125]/80 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[320px] shadow-xl text-slate-100 my-4 animate-fadeIn">
      {/* Visual Icon with Teal Glow */}
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#13434c] to-[#1e616d] border border-[#2cd3c6]/40 flex items-center justify-center text-[#2cd3c6] shadow-[0_0_25px_rgba(44,211,198,0.25)]">
          <Film className="w-8 h-8" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-[#20b2aa] text-white flex items-center justify-center shadow-md">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>

      <h3 className="text-base sm:text-lg font-bold text-white mb-2 tracking-wide">
        Belum Ada Klip yang Dipotong
      </h3>

      <p className="text-xs sm:text-sm text-[#7e9ca2] max-w-md leading-relaxed mb-6">
        Tempel link video YouTube berdurasi panjang di form atas, tentukan durasi
        dan jumlah klip, lalu biarkan AI mendeteksi momen berpotensi viral secara
        otomatis.
      </p>

      {onLoadSample && (
        <button
          type="button"
          onClick={onLoadSample}
          className="px-4 py-2 rounded-xl bg-[#142e34] hover:bg-[#1b3d45] border border-[#20b2aa]/40 text-[#2cd3c6] text-xs font-semibold flex items-center gap-2 transition hover:shadow-[0_0_15px_rgba(44,211,198,0.2)] cursor-pointer"
        >
          <Video className="w-4 h-4 text-[#2cd3c6]" />
          <span>Muat Contoh Link Video Podcast Viral</span>
          <Play className="w-3 h-3 fill-current ml-1" />
        </button>
      )}
    </div>
  );
}
