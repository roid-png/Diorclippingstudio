import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { Sparkles, Film, ShieldCheck } from "lucide-react";
import { siteConfig } from "@/config/site";

// Pathless layout: /sign-in and /sign-up. Signed-in visitors go to the app.
export const Route = createFileRoute("/_auth")({
  beforeLoad: ({ context }) => {
    if (context.session) throw redirect({ to: siteConfig.homePath });
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#051114] via-[#08181d] to-[#0d2228] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <header className="border-b border-[#12252a]/70 bg-[#071418]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 relative shrink-0">
              <img
                src="/images/dior_icon.png"
                alt="Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                  Dior Clipping
                </span>
                <span className="rounded bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.2 text-[10px] font-bold text-cyan-300">
                  AI Studio
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Auto-cut Viral & Edit 3 Pilar
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Sesi Terenkripsi & Kuota 50/Hari
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-10 sm:px-6"
      >
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#12252a]/50 py-4 text-center text-xs text-slate-300">
        <p>
          © {new Date().getFullYear()} {siteConfig.name} • Auto-Cut Video YouTube dengan
          Akurasi Viral Scoring & Preset Edit ala Netflix
        </p>
      </footer>
    </div>
  );
}
