/**
 * Dynamic API Origin Resolution:
 * 1. Di browser (termasuk GitHub Codespaces *.app.github.dev):
 *    Gunakan window.location.origin agar SEMUA request /api otomatis lewat reverse-proxy Vite
 *    di port 3000 -> diteruskan ke backend server (port 5000) tanpa masalah CORS / Mixed Content / Port.
 * 2. Di server / SSR:
 *    Gunakan process.env.VITE_API_URL atau fallback ke http://127.0.0.1:5000.
 */
function resolveApiUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.VITE_API_URL || process.env.API_URL || "http://127.0.0.1:5000";
}

export const API_URL = resolveApiUrl();
