import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  registerUserAccount,
  loginUserAccount,
  verifySessionToken,
  logoutSessionToken,
  getUserByIdOrDefault,
  ensureUserDailyQuota,
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
