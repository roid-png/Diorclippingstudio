import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  registerUserAccount,
  loginUserAccount,
} from "../services/account.service";

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
