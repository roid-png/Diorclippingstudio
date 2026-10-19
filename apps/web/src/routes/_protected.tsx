import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { roleHasPermission } from "@starter/shared/permissions";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { getPersistentSession } from "@/features/auth/session-storage";
import type { Session } from "@/lib/session";

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

const navLink =
  "rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-medium text-[#7d9399] transition-colors hover:text-white hover:bg-[#14282e] data-[status=active]:bg-[#152a2e] data-[status=active]:text-white data-[status=active]:border data-[status=active]:border-[#21434c]";

function ProtectedLayout() {
  const { user } = Route.useRouteContext().session;
  const canAdmin = roleHasPermission(user.role, { notes: ["read-any"] });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#071518] via-[#0b1b1f] to-[#12282e] text-slate-100 flex flex-col">
      <header className="border-b border-[#12252a] bg-[#091619] sticky top-0 z-40 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-6">
            <Link to="/app" className="flex items-center gap-2.5">
              <div className="w-7 h-7 relative shrink-0">
                <img
                  src="/images/dior_icon.png"
                  alt="Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
              <span className="font-bold text-base sm:text-lg tracking-tight">
                <span className="text-[#a78bfa]">Dior</span>{" "}
                <span className="text-[#e2e8f0]">Clipping</span>
              </span>
            </Link>

            <nav aria-label="Main" className="flex items-center gap-1.5">
              <Link to="/app" className={navLink}>
                Studio Potong Video
              </Link>
              <Link to="/viral-clips" className={navLink}>
                Deteksi Momen Viral
              </Link>
              <Link to="/auto-edit" className={navLink}>
                Edit Otomatis
              </Link>
              <Link to="/render" className={navLink}>
                Render & Unduh
              </Link>
              <Link to="/project-history" className={navLink}>
                Riwayat Proyek
              </Link>
              {canAdmin && (
                <Link to="/admin" className={navLink}>
                  Admin
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs font-bold text-cyan-300">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>50 Kuota Harian</span>
            </div>

            <div className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-[#0f2125] border border-[#1b373e]">
              <div className="w-6 h-6 rounded-full overflow-hidden border border-[#234b55] relative shrink-0 bg-[#162f35]">
                <img
                  src={user.image || "/images/michael_avatar.png"}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-gray-200 leading-tight">
                  {user.name}
                </span>
                <span className="text-[10px] text-slate-400 leading-none">
                  {user.role === "admin" ? "Pro Editor" : "Content Creator"}
                </span>
              </div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto max-w-7xl w-full px-4 py-6 sm:px-6 lg:py-8 flex-1"
      >
        <Outlet />
      </main>
    </div>
  );
}
