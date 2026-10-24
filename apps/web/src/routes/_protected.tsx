import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
} from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { roleHasPermission } from "@starter/shared/permissions";
import { SignOutButton } from "@/components/sign-out-button";
import {
  getPersistentSession,
  type StoredSessionUser,
} from "@/features/auth/session-storage";
import type { Session } from "@/lib/session";
import {
  LayoutDashboard,
  Video,
  Palette,
  History,
  Code2,
  Settings,
  Bell,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_protected")({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      if (typeof window !== "undefined") {
        const mockUser = getPersistentSession();
        if (mockUser) {
          return {
            session: {
              session: {
                id: "mock-session-active",
                userId: mockUser.id,
                expiresAt: new Date(Date.now() + 86400000),
                createdAt: new Date(),
                updatedAt: new Date(),
                token: "mock-token",
                ipAddress: "127.0.0.1",
                userAgent: "Browser",
              },
              user: {
                id: mockUser.id,
                name: mockUser.name,
                email: mockUser.email,
                role: mockUser.role,
                emailVerified: true,
                image: mockUser.avatarUrl || null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            } as unknown as Session,
          };
        }
      }
      throw redirect({ to: "/sign-in" });
    }
    return { session: context.session };
  },
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const { user } = Route.useRouteContext().session;
  const canAdmin = roleHasPermission(user.role, { notes: ["read-any"] });
  const location = useLocation();

  const [headerSession, setHeaderSession] = useState<StoredSessionUser | null>(() =>
    getPersistentSession()
  );
  const [showNotificationPopup, setShowNotificationPopup] = useState<boolean>(false);
  const [hasActiveRenderJob, setHasActiveRenderJob] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(localStorage.getItem("dior_active_render_job"));
  });

  useEffect(() => {
    const handleSync = () => {
      setHeaderSession(getPersistentSession());
      setHasActiveRenderJob(Boolean(localStorage.getItem("dior_active_render_job")));
    };
    const interval = setInterval(() => {
      if (typeof window !== "undefined") {
        setHasActiveRenderJob(Boolean(localStorage.getItem("dior_active_render_job")));
      }
    }, 2000);

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleSync);
      return () => {
        window.removeEventListener("storage", handleSync);
        clearInterval(interval);
      };
    }
  }, []);

  const displayName = headerSession?.name || user.name;
  const displayAvatar =
    headerSession?.avatarUrl || user.image || "/images/michael_avatar.png";
  const displayBadge =
    headerSession?.badge ||
    (user.role === "admin" ? "Pro Video Editor" : "Content Creator");

  // Determine current active section for breadcrumb
  const pathname = location.pathname;
  let currentSection = "Auto Video Clipper";
  if (pathname.includes("presets")) currentSection = "Preset Management";
  else if (pathname.includes("profile")) currentSection = "Pengaturan Akun";
  else if (pathname.includes("admin")) currentSection = "API & Developer Panel";

  const navItems = [
    {
      to: "/app",
      label: "Dashboard",
      icon: LayoutDashboard,
      isActive: pathname === "/app" || pathname === "/",
    },
    {
      to: "/presets",
      label: "Presets",
      icon: Palette,
      isActive: pathname.includes("presets"),
    },
    {
      to: "/profile",
      label: "Settings",
      icon: Settings,
      isActive: pathname.includes("profile"),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#071518] via-[#0b1b1f] to-[#12282e] text-slate-100 flex">
      {/* Sidebar kiri navigasi lengkap (Dark Teal solid, ultra-smooth) */}
      <aside className="w-60 shrink-0 hidden md:flex flex-col bg-[#09171b] border-r border-[#18333a] sticky top-0 h-screen z-30 select-none">
        {/* Logo Dior Clipping */}
        <div className="p-4 border-b border-[#142e34] flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#13434c] to-[#20a3a7] p-1.5 flex items-center justify-center border border-[#2cd3c6]/40 shadow-[0_0_15px_rgba(44,211,198,0.3)]">
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
            <div className="font-bold text-base tracking-tight leading-tight">
              <span className="text-[#a78bfa]">Dior</span>{" "}
              <span className="text-white">Clipping</span>
            </div>
            <div className="text-[10px] text-[#2cd3c6] font-medium tracking-wide">
              Viral AI Studio
            </div>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    item.isActive
                      ? "bg-gradient-to-r from-[#14373e] to-[#18464f] text-[#2cd3c6] border border-[#20b2aa]/40 shadow-[0_0_15px_rgba(44,211,198,0.15)]"
                      : "text-[#7a959c] hover:text-white hover:bg-[#11272d]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        item.isActive ? "text-[#2cd3c6]" : "text-[#627e84]"
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.to === "/app" && hasActiveRenderJob && (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-[#2cd3c6] bg-[#0c2227] px-2 py-0.5 rounded-full border border-[#2cd3c6]/40 shadow-sm animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2cd3c6] animate-ping" />
                      <span>Proses ⚡</span>
                    </span>
                  )}
                </Link>
              );
            })}
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="p-3 border-t border-[#142e34] bg-[#071316]/60">
          <Link
            to="/profile"
            className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#12282e] transition group"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border border-[#2cd3c6]/40 group-hover:border-[#2cd3c6] bg-[#162f35] shrink-0">
              <img
                src={displayAvatar}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-bold text-gray-200 group-hover:text-white truncate">
                {displayName}
              </span>
              <span className="text-[10px] text-[#2cd3c6] truncate">
                Unlimited Quota ✅
              </span>
            </div>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar dengan breadcrumb "Dashboard / Auto Video Clipper", lonceng notifikasi, dan avatar profil pengguna */}
        <header className="h-14 border-b border-[#18333a] bg-[#09171b] sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <Link
              to="/app"
              className="text-[#6d8a91] hover:text-white transition flex items-center gap-1.5"
            >
              <span className="md:hidden font-bold text-[#a78bfa]">Dior</span>
              <span>Dashboard</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#426066]" />
            <span className="text-white font-semibold">{currentSection}</span>
          </div>

          {/* Right Top Bar Items */}
          <div className="flex items-center gap-3">
            {/* Lonceng Notifikasi */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotificationPopup((prev) => !prev)}
                className="p-2 rounded-xl bg-[#11272d] hover:bg-[#17333b] border border-[#1d3d44] text-[#8ea8af] hover:text-white transition cursor-pointer relative"
                title="Notifikasi Sistem"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2cd3c6] animate-pulse" />
              </button>

              {/* Notification Dropdown */}
              {showNotificationPopup && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#0e2125] border border-[#1e3c43] shadow-2xl p-3 z-50 animate-fadeIn text-xs">
                  <div className="flex items-center justify-between border-b border-[#1b373e] pb-2 mb-2 font-bold text-white">
                    <span>Notifikasi Sistem</span>
                    <span className="text-[10px] text-[#2cd3c6] font-mono">Real Engine</span>
                  </div>
                  <div className="space-y-2">
                    <div className="p-2 rounded-xl bg-[#142a30] text-[#93adb3] text-[11px] flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#2cd3c6] shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block">Sistem Siap Digunakan</strong>
                        Pipeline yt-dlp, Dual Gemini STT & Curation, dan FFmpeg render aktif.
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-[#142a30] text-[#93adb3] text-[11px] flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block">Kuota Tanpa Batas</strong>
                        Bypass kuota aktif (999.999 klip) untuk pemotongan bebas.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Avatar Profil Pengguna */}
            <Link
              to="/profile"
              title="Pengaturan Profil"
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-[#11272d] hover:bg-[#17333b] border border-[#1d3d44] hover:border-[#2cd3c6]/40 transition group"
            >
              <div className="w-6 h-6 rounded-full overflow-hidden border border-[#234b55] group-hover:border-[#2cd3c6] bg-[#162f35] shrink-0">
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs font-bold text-gray-200 group-hover:text-white hidden sm:inline">
                {displayName}
              </span>
            </Link>

            <SignOutButton />
          </div>
        </header>

        {/* Page Content */}
        <main
          id="main-content"
          className="mx-auto max-w-7xl w-full px-4 py-6 sm:px-6 lg:py-8 flex-1"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
