import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { LoaderCircle, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { clearPersistentSession } from "@/features/auth/session-storage";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();
  const navigate = useNavigate();

  async function handleSignOut() {
    setPending(true);
    setError(false);

    try {
      // 1. Clear local persistent mock session
      clearPersistentSession();

      // 2. Call Better Auth sign out
      try {
        await authClient.signOut();
      } catch {
        // Continue even if backend request fails (offline / mock mode)
      }

      // 3. Re-run route guards and redirect to sign-in
      await router.invalidate();
      await navigate({ to: "/sign-in", replace: true });
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-rose-400 font-medium">
          Gagal keluar. Coba lagi.
        </span>
      )}
      <Button
        onClick={handleSignOut}
        disabled={pending}
        variant="ghost"
        size="sm"
        className="rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 hover:bg-rose-900/40 hover:text-white hover:border-rose-500/60 text-xs font-semibold transition cursor-pointer"
        aria-label="Keluar dari Studio"
      >
        {pending ? (
          <LoaderCircle className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
        )}
        {pending ? "Keluar…" : "Keluar"}
      </Button>
    </div>
  );
}
