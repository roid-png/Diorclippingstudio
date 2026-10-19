import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  registerUserAccount,
  loginUserAccount,
  verifySessionToken,
  logoutSessionToken,
  getUserByIdOrDefault,
  ensureUserDailyQuota,
  getUserQuotaWithHistory,
  consumeUserClipQuotaAtomic,
} from "../services/account.service";
import { extractSessionToken } from "../middleware/auth";

export const accountRouter = Router();

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama lengkap minimal harus 2 karakter.")
    .max(60, "Nama lengkap maksimal 60 karakter."),
  email: z
    .string()
    .trim()
    .email("Format alamat email tidak valid."),
  password: z
    .string()
    .min(8, "Kata sandi minimal harus 8 karakter."),
  avatarUrl: z.string().optional(),
  badge: z.string().optional(),
});

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Format alamat email tidak valid."),
  password: z
    .string()
    .min(1, "Kata sandi tidak boleh kosong."),
});

const consumeQuotaSchema = z.object({
  clipCount: z
    .number()
    .int("Jumlah klip harus berupa bilangan bulat.")
    .min(1, "Minimal pemotongan adalah 1 klip.")
    .max(10, "Maksimal pemotongan adalah 10 klip per proses."),
  projectId: z.string().optional().nullable(),
  projectTitle: z.string().optional(),
  clipDurationSec: z.number().int().optional(),
  sourceType: z.string().optional(),
});

/**
 * POST /api/account/register
 * Registers a new user account, hashes the password, creates a session token,
 * and initializes the daily 50-clip quota.
 */
accountRouter.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: firstIssue?.message || "Data pendaftaran tidak valid.",
    });
    return;
  }

  try {
    const result = await registerUserAccount({
      ...parsed.data,
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });

    res.cookie("dior_session_token", result.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      message: "Pendaftaran berhasil! Kuota harian 50 klip telah diaktifkan.",
      data: result,
    });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 400;
    res.status(status).json({
      success: false,
      error: err?.code || "REGISTER_FAILED",
      message: err?.message || "Gagal mendaftarkan akun baru.",
    });
  }
});

/**
 * POST /api/account/login
 * Authenticates a user with email & password and returns a session token + quota state.
 */
accountRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: firstIssue?.message || "Email dan kata sandi wajib diisi dengan benar.",
    });
    return;
  }

  try {
    const result = await loginUserAccount({
      ...parsed.data,
      ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });

    res.cookie("dior_session_token", result.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Berhasil masuk ke Studio Dior Clipping.",
      data: result,
    });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 401;
    res.status(status).json({
      success: false,
      error: err?.code || "LOGIN_FAILED",
      message: err?.message || "Email atau kata sandi tidak valid.",
    });
  }
});

/**
 * GET /api/account/session (and /api/account/me)
 * Returns the active session, user profile, and daily 50-clip quota status.
 */
const handleGetSession = async (req: Request, res: Response) => {
  const token = extractSessionToken(req);
  if (token) {
    const verified = await verifySessionToken(token);
    if (verified) {
      res.status(200).json({
        success: true,
        authenticated: true,
        data: verified,
      });
      return;
    }
  }

  const fallbackUserId =
    (typeof req.headers["x-user-id"] === "string" && req.headers["x-user-id"]) ||
    (typeof req.query?.userId === "string" && req.query.userId) ||
    null;

  if (fallbackUserId) {
    const userRec = await getUserByIdOrDefault(fallbackUserId);
    const quota = await ensureUserDailyQuota(userRec.id);
    res.status(200).json({
      success: true,
      authenticated: true,
      data: {
        session: {
          id: `sess-${userRec.id}`,
          token: "demo-session-active",
          userId: userRec.id,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date().toISOString(),
        },
        user: {
          id: userRec.id,
          name: userRec.name,
          email: userRec.email,
          avatarUrl: userRec.avatarUrl,
          image: userRec.avatarUrl,
          bio: userRec.bio,
          badge: userRec.badge,
          role: userRec.role,
          emailVerified: userRec.emailVerified,
          createdAt: userRec.createdAt,
          updatedAt: userRec.updatedAt,
        },
        quota,
      },
    });
    return;
  }

  res.status(401).json({
    success: false,
    authenticated: false,
    error: "UNAUTHORIZED",
    message: "Sesi tidak ditemukan atau sudah berakhir. Silakan masuk kembali.",
  });
};

accountRouter.get("/session", handleGetSession);
accountRouter.get("/me", handleGetSession);

/**
 * POST /api/account/logout
 * Revokes the current session token and clears the session cookie.
 */
accountRouter.post("/logout", async (req: Request, res: Response) => {
  const token =
    extractSessionToken(req) ||
    (typeof req.body?.token === "string" ? req.body.token : null);

  await logoutSessionToken(token);

  res.clearCookie("dior_session_token", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  res.status(200).json({
    success: true,
    message: "Sesi berhasil diakhiri. Anda telah keluar dari akun.",
  });
});

/**
 * GET /api/account/quota (and /api/quotas, /api/quotas/me)
 * Returns the remaining daily clip quota, usage percentage, reset time (00:00 WIB), and recent usage history.
 */
const handleGetQuota = async (req: Request, res: Response) => {
  let targetUserId: string | null = null;

  const token = extractSessionToken(req);
  if (token) {
    const verified = await verifySessionToken(token);
    if (verified) {
      targetUserId = verified.user.id;
    }
  }

  if (!targetUserId) {
    targetUserId =
      (typeof req.headers["x-user-id"] === "string" && req.headers["x-user-id"]) ||
      (typeof req.query?.userId === "string" && req.query.userId) ||
      "user-creator-demo";
  }

  const quotaDetails = await getUserQuotaWithHistory(targetUserId);

  res.status(200).json({
    success: true,
    message: `Sisa kuota klip hari ini: ${quotaDetails.remainingQuota}/${quotaDetails.totalQuota} klip.`,
    data: quotaDetails,
  });
};

accountRouter.get("/quota", handleGetQuota);
accountRouter.get("/quotas", handleGetQuota);

/**
 * POST /api/account/quota/consume (and /api/quotas/consume)
 * Atomically deducts daily clip quota when clips are generated.
 */
const handleConsumeQuota = async (req: Request, res: Response) => {
  const parsed = consumeQuotaSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: firstIssue?.message || "Jumlah klip tidak valid.",
    });
    return;
  }

  let targetUserId: string | null = null;
  const token = extractSessionToken(req);
  if (token) {
    const verified = await verifySessionToken(token);
    if (verified) {
      targetUserId = verified.user.id;
    }
  }

  if (!targetUserId) {
    targetUserId =
      (typeof req.headers["x-user-id"] === "string" && req.headers["x-user-id"]) ||
      (typeof req.body?.userId === "string" && req.body.userId) ||
      "user-creator-demo";
  }

  try {
    const updated = await consumeUserClipQuotaAtomic({
      userId: targetUserId,
      clipCount: parsed.data.clipCount,
      projectId: parsed.data.projectId,
      sourceTitle: parsed.data.projectTitle,
      actionType: parsed.data.sourceType || "clip_generation",
    });

    res.status(200).json({
      success: true,
      message: `Berhasil mengurangi ${parsed.data.clipCount} klip. Sisa kuota hari ini: ${updated.quota.remainingQuota}/${updated.quota.totalQuota} klip.`,
      data: {
        ...updated.quota,
        usage: updated.usage,
      },
    });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 400;
    res.status(status).json({
      success: false,
      error: err?.code || "QUOTA_CONSUME_FAILED",
      message: err?.message || "Gagal mengurangi kuota klip.",
    });
  }
};

accountRouter.post("/quota/consume", handleConsumeQuota);
accountRouter.post("/consume", handleConsumeQuota);

/**
 * POST /api/account/quota/validate (and /api/quotas/validate)
 * Validates whether the user has enough daily clip quota before starting a cut job.
 * Rejects with 403 QUOTA_EXHAUSTED when remainingQuota === 0, or 400 INSUFFICIENT_QUOTA when clipCount > remainingQuota.
 */
const handleValidateQuota = async (req: Request, res: Response) => {
  const clipCount = Number(req.body?.clipCount ?? req.body?.maxClips ?? req.query?.clipCount ?? 5);

  let targetUserId: string | null = null;
  const token = extractSessionToken(req);
  if (token) {
    const verified = await verifySessionToken(token);
    if (verified) {
      targetUserId = verified.user.id;
    }
  }

  if (!targetUserId) {
    targetUserId =
      (typeof req.headers["x-user-id"] === "string" && req.headers["x-user-id"]) ||
      (typeof req.body?.userId === "string" && req.body.userId) ||
      "user-creator-demo";
  }

  try {
    const { validateUserClipQuotaAvailable } = await import("../services/account.service");
    const check = await validateUserClipQuotaAvailable(targetUserId, clipCount);
    res.status(200).json({
      success: true,
      allowed: true,
      message: `Kuota klip mencukupi (${check.quota.remainingQuota}/${check.quota.totalQuota} klip tersisa).`,
      data: check,
    });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 400;
    res.status(status).json({
      success: false,
      allowed: false,
      error: err?.code || "INSUFFICIENT_QUOTA",
      message: err?.message || "Kuota klip harian tidak mencukupi.",
      quota: err?.quota || null,
    });
  }
};

accountRouter.post("/quota/validate", handleValidateQuota);
accountRouter.post("/validate", handleValidateQuota);
