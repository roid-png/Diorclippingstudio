export const MOCK_SESSION_STORAGE_KEY = "dior_clipping_mock_session_v1";

export interface StoredSessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  dailyQuota: number;
  usedQuota: number;
  avatarUrl?: string;
  badge?: string;
  signedInAt: string;
}

export const DEFAULT_DEMO_USER: StoredSessionUser = {
  id: "user-creator-demo",
  name: "Sonia Evangelyn",
  email: "creator@diorclipping.id",
  role: "user",
  dailyQuota: 50,
  usedQuota: 12,
  avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  badge: "Content Creator",
  signedInAt: new Date().toISOString(),
};

/**
 * Retrieves the persistent session from local storage if available.
 */
export function getPersistentSession(): StoredSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MOCK_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Stores persistent session for seamless exploration and mock demo testing.
 */
export function savePersistentSession(
  user: Partial<StoredSessionUser>
): StoredSessionUser {
  const merged: StoredSessionUser = {
    ...DEFAULT_DEMO_USER,
    ...user,
    signedInAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(MOCK_SESSION_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // ignore storage failure
    }
  }
  return merged;
}

/**
 * Clears the persistent session on logout.
 */
export function clearPersistentSession(): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(MOCK_SESSION_STORAGE_KEY);
    } catch {
      // ignore storage failure
    }
  }
}

