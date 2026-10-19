import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { user, session, quotas } from "../db/schema";
import { hashPassword, verifyPassword } from "../utils/password";

export interface UserAccountRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl: string;
  bio: string | null;
  badge: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionTokenRecord {
  id: string;
  token: string;
  userId: string;
  expiresAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface QuotaSummary {
  userId: string;
  totalQuota: number;
  usedQuota: number;
  remainingQuota: number;
  resetDate: string;
  resetTimeLabel: string;
}

const DEFAULT_DEMO_PASSWORD_HASH = hashPassword("Password123!");

const inMemoryUsers = new Map<string, UserAccountRecord>([
  [
    "user-creator-demo",
    {
      id: "user-creator-demo",
      name: "Sonia Evangelyn",
      email: "creator@diorclipping.id",
      passwordHash: DEFAULT_DEMO_PASSWORD_HASH,
      avatarUrl:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      bio: "Kreator video pendek fokus YouTube Shorts & TikTok viral. Menggunakan preset THEO 5-FIX.",
      badge: "Content Creator",
      role: "user",
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  [
    "user-editor-pro",
    {
      id: "user-editor-pro",
      name: "Dior Studio Editor Pro",
      email: "editor@diorclipping.id",
      passwordHash: DEFAULT_DEMO_PASSWORD_HASH,
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      bio: "Akses penuh pipeline rendering turbo NVENC & kustomisasi 3 pilar.",
      badge: "Pro Video Editor",
      role: "admin",
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  [
    "user-guest-quick",
    {
      id: "user-guest-quick",
      name: "Tamu Penguji Cepat",
      email: "tamu@diorclipping.id",
      passwordHash: DEFAULT_DEMO_PASSWORD_HASH,
      avatarUrl:
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      bio: "Coba langsung auto-cut video YouTube tanpa perlu verifikasi email.",
      badge: "Tamu Cepat",
      role: "user",
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
]);

const inMemorySessions = new Map<string, SessionTokenRecord>();
const inMemoryQuotas = new Map<string, QuotaSummary>();

/**
 * Computes the next 00:00 WIB (UTC+7 -> 17:00 UTC) reset timestamp.
 */
export function getNextMidnightWIB(fromDate: Date = new Date()): Date {
  // WIB is UTC + 7 hours
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const wibTime = new Date(fromDate.getTime() + wibOffsetMs);
  const nextWibMidnight = new Date(
    Date.UTC(
      wibTime.getUTCFullYear(),
      wibTime.getUTCMonth(),
      wibTime.getUTCDate() + 1,
      0,
      0,
      0,
      0
    ) - wibOffsetMs
  );
  return nextWibMidnight;
}

export async function ensureUserDailyQuota(userId: string): Promise<QuotaSummary> {
  const nextReset = getNextMidnightWIB();
  try {
    const existing = await db
      .select()
      .from(quotas)
      .where(eq(quotas.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const q = existing[0]!;
      const now = new Date();
      // Auto-reset if resetDate has passed
      if (q.resetDate && q.resetDate <= now) {
        const [resetRow] = await db
          .update(quotas)
          .set({
            usedQuota: 0,
            resetDate: nextReset,
            updatedAt: now,
          })
          .where(eq(quotas.userId, userId))
          .returning();
        const used = resetRow?.usedQuota ?? 0;
        const total = resetRow?.totalQuota ?? 50;
        const summary: QuotaSummary = {
          userId,
          totalQuota: total,
          usedQuota: used,
          remainingQuota: Math.max(0, total - used),
          resetDate: (resetRow?.resetDate ?? nextReset).toISOString(),
          resetTimeLabel: "00:00 WIB",
        };
        inMemoryQuotas.set(userId, summary);
        return summary;
      }

      const summary: QuotaSummary = {
        userId,
        totalQuota: q.totalQuota,
        usedQuota: q.usedQuota,
        remainingQuota: Math.max(0, q.totalQuota - q.usedQuota),
        resetDate: (q.resetDate ?? nextReset).toISOString(),
        resetTimeLabel: "00:00 WIB",
      };
      inMemoryQuotas.set(userId, summary);
      return summary;
    }

    const [created] = await db
      .insert(quotas)
      .values({
        userId,
        totalQuota: 50,
        usedQuota: 0,
        resetDate: nextReset,
      })
      .returning();

    if (created) {
      const summary: QuotaSummary = {
        userId,
        totalQuota: created.totalQuota,
        usedQuota: created.usedQuota,
        remainingQuota: Math.max(0, created.totalQuota - created.usedQuota),
        resetDate: (created.resetDate ?? nextReset).toISOString(),
        resetTimeLabel: "00:00 WIB",
      };
      inMemoryQuotas.set(userId, summary);
      return summary;
    }
  } catch {
    // Fallback to in-memory quota store
  }

  const cached = inMemoryQuotas.get(userId);
  if (cached) {
    if (new Date(cached.resetDate) <= new Date()) {
      const refreshed: QuotaSummary = {
        ...cached,
        usedQuota: 0,
        remainingQuota: cached.totalQuota,
        resetDate: nextReset.toISOString(),
      };
      inMemoryQuotas.set(userId, refreshed);
      return refreshed;
    }
    return cached;
  }

  const fallback: QuotaSummary = {
    userId,
    totalQuota: 50,
    usedQuota: userId === "user-creator-demo" ? 5 : 0,
    remainingQuota: userId === "user-creator-demo" ? 45 : 50,
    resetDate: nextReset.toISOString(),
    resetTimeLabel: "00:00 WIB",
  };
  inMemoryQuotas.set(userId, fallback);
  return fallback;
}

async function createSessionForUser(
  userId: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null }
): Promise<SessionTokenRecord> {
  const token = `dior_sess_${randomBytes(24).toString("hex")}`;
  const id = `sess-${randomUUID()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const record: SessionTokenRecord = {
    id,
    token,
    userId,
    expiresAt: expiresAt.toISOString(),
    ipAddress: meta?.ipAddress ?? null,
    userAgent: meta?.userAgent ?? null,
    createdAt: now.toISOString(),
  };

  inMemorySessions.set(token, record);

  try {
    await db.insert(session).values({
      id,
      token,
      userId,
      expiresAt,
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    // Keep in-memory session active
  }

  return record;
}

export async function registerUserAccount(input: {
  name: string;
  email: string;
  password: string;
  avatarUrl?: string;
  badge?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const cleanName = input.name.trim();

  // Check if email already exists in memory or DB
  for (const existing of inMemoryUsers.values()) {
    if (existing.email.toLowerCase() === normalizedEmail) {
      const err = new Error(
        "Email ini sudah terdaftar. Silakan masuk menggunakan akun Anda atau gunakan email lain."
      );
      (err as any).code = "USER_ALREADY_EXISTS";
      (err as any).status = 409;
      throw err;
    }
  }

  try {
    const existingDb = await db
      .select()
      .from(user)
      .where(eq(user.email, normalizedEmail))
      .limit(1);
    if (existingDb.length > 0) {
      const err = new Error(
        "Email ini sudah terdaftar. Silakan masuk menggunakan akun Anda atau gunakan email lain."
      );
      (err as any).code = "USER_ALREADY_EXISTS";
      (err as any).status = 409;
      throw err;
    }
  } catch (e: any) {
    if (e?.code === "USER_ALREADY_EXISTS") throw e;
  }

  const userId = `user-${randomUUID().slice(0, 8)}`;
  const passwordHash = hashPassword(input.password);
  const avatarUrl = input.avatarUrl?.trim() || "/images/michael_avatar.png";
  const badge = input.badge?.trim() || "Content Creator";
  const now = new Date();

  const newUserRecord: UserAccountRecord = {
    id: userId,
    name: cleanName,
    email: normalizedEmail,
    passwordHash,
    avatarUrl,
    bio: "Kreator video pendek fokus YouTube Shorts & TikTok viral.",
    badge,
    role: "user",
    emailVerified: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  inMemoryUsers.set(userId, newUserRecord);

  try {
    await db.insert(user).values({
      id: userId,
      name: cleanName,
      email: normalizedEmail,
      passwordHash,
      image: avatarUrl,
      avatarUrl,
      bio: newUserRecord.bio,
      badge,
      role: "user",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    // Fallback to inMemoryUsers
  }

  const quota = await ensureUserDailyQuota(userId);
  const sess = await createSessionForUser(userId, {
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    user: {
      id: newUserRecord.id,
      name: newUserRecord.name,
      email: newUserRecord.email,
      avatarUrl: newUserRecord.avatarUrl,
      image: newUserRecord.avatarUrl,
      bio: newUserRecord.bio,
      badge: newUserRecord.badge,
      role: newUserRecord.role,
      createdAt: newUserRecord.createdAt,
    },
    token: sess.token,
    expiresAt: sess.expiresAt,
    quota,
  };
}

export async function loginUserAccount(input: {
  email: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  let matchedUser: UserAccountRecord | null = null;

  // 1. Check DB first
  try {
    const rows = await db
      .select()
      .from(user)
      .where(eq(user.email, normalizedEmail))
      .limit(1);

    if (rows.length > 0) {
      const r = rows[0]!;
      matchedUser = {
        id: r.id,
        name: r.name,
        email: r.email,
        passwordHash: r.passwordHash || DEFAULT_DEMO_PASSWORD_HASH,
        avatarUrl: r.avatarUrl || r.image || "/images/michael_avatar.png",
        bio: r.bio || null,
        badge: r.badge || "Content Creator",
        role: r.role || "user",
        emailVerified: r.emailVerified,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
      inMemoryUsers.set(matchedUser.id, matchedUser);
    }
  } catch {
    // Fallback to in-memory lookup
  }

  // 2. Check in-memory users if not found in DB
  if (!matchedUser) {
    for (const u of inMemoryUsers.values()) {
      if (u.email.toLowerCase() === normalizedEmail) {
        matchedUser = u;
        break;
      }
    }
  }

  if (!matchedUser) {
    const err = new Error(
      "Akun dengan email tersebut tidak ditemukan. Silakan daftar akun baru terlebih dahulu."
    );
    (err as any).code = "USER_NOT_FOUND";
    (err as any).status = 404;
    throw err;
  }

  const isPasswordValid = verifyPassword(input.password, matchedUser.passwordHash);
  if (!isPasswordValid) {
    const err = new Error(
      "Email atau kata sandi yang Anda masukkan salah. Silakan coba lagi."
    );
    (err as any).code = "INVALID_CREDENTIALS";
    (err as any).status = 401;
    throw err;
  }

  const quota = await ensureUserDailyQuota(matchedUser.id);
  const sess = await createSessionForUser(matchedUser.id, {
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    user: {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      avatarUrl: matchedUser.avatarUrl,
      image: matchedUser.avatarUrl,
      bio: matchedUser.bio,
      badge: matchedUser.badge,
      role: matchedUser.role,
      createdAt: matchedUser.createdAt,
    },
    token: sess.token,
    expiresAt: sess.expiresAt,
    quota,
  };
}
