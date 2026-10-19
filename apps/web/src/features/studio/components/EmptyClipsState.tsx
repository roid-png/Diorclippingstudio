import { Scissors, Video, Sparkles } from "lucide-react";

export function EmptyClipsState() {
  return (
    <div className="w-full bg-[#0e2125]/80 backdrop-blur-md border border-[#1e3c43] rounded-2xl p-8 sm:p-14 text-center flex flex-col items-center justify-center min-h-[340px] shadow-2xl text-slate-100 my-4 animate-fadeIn">
      {/* Visual Icon with Teal Glow */}
      <div className="relative mb-5">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#0d2a30] via-[#13434c] to-[#1e616d] border border-[#2cd3c6]/40 flex items-center justify-center text-[#2cd3c6] shadow-[0_0_30px_rgba(44,211,198,0.3)]">
          <div className="relative flex items-center justify-center">
            <Video className="w-9 h-9" />
            <Scissors className="w-5 h-5 absolute -bottom-1 -right-1 text-teal-300 drop-shadow-md" />
          </div>
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-lg bg-[#20b2aa] text-white flex items-center justify-center shadow-md animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>

      <h3 className="text-lg sm:text-xl font-bold text-white mb-2 tracking-wide font-sans">
        Belum ada klip yang dibuat
      </h3>

      <p className="text-xs sm:text-sm text-[#7e9ca2] max-w-lg leading-relaxed font-sans">
        Tempel link YouTube di atas lalu klik <span className="text-[#2cd3c6] font-semibold">Auto-Cut & Generate 🚀</span> untuk memulai!
      </p>
    </div>
  );
}
