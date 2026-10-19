import type { Request, RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { Permissions } from "@starter/shared/permissions";
import { auth } from "../lib/auth";
import { HttpError } from "../lib/http-error";
import { setRequestUser } from "../lib/request-context";
import {
  verifySessionToken,
  getUserByIdOrDefault,
  ensureUserDailyQuota,
} from "../services/account.service";

/**
 * Extracts session token from Authorization Bearer header, x-session-token header,
 * dior_session_token cookie, or token query parameter.
 */
export function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const headerToken = req.headers["x-session-token"];
  if (typeof headerToken === "string" && headerToken.trim()) {
    return headerToken.trim();
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)dior_session_token=([^;]+)/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  if (typeof req.query?.token === "string" && req.query.token.trim()) {
    return req.query.token.trim();
  }

  return null;
}

// Authenticates against the database on every request (no cookie cache), so a
// signed-out or revoked session stops working immediately. Answers JSON 401.
// Also supports custom session token from /api/account/login or /api/account/register.
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      query: { disableCookieCache: true },
    });
    if (session) {
      req.auth = session;
      setRequestUser(session.user.id);
      next();
      return;
    }
  } catch {
    // Fallback to custom session token check below
  }

  const token = extractSessionToken(req);
  if (token) {
    const verified = await verifySessionToken(token);
    if (verified) {
      req.auth = {
        session: {
          id: verified.session.id,
          token: verified.session.token,
          userId: verified.session.userId,
          expiresAt: new Date(verified.session.expiresAt),
          createdAt: new Date(verified.session.createdAt),
          updatedAt: new Date(verified.session.createdAt),
          ipAddress: verified.session.ipAddress ?? null,
          userAgent: verified.session.userAgent ?? null,
        },
        user: {
          id: verified.user.id,
          name: verified.user.name,
          email: verified.user.email,
          emailVerified: verified.user.emailVerified,
          image: verified.user.avatarUrl,
          role: verified.user.role,
          banned: false,
          banReason: null,
          banExpires: null,
          createdAt: new Date(verified.user.createdAt),
          updatedAt: new Date(verified.user.updatedAt),
        },
      } as any;
      setRequestUser(verified.user.id);
      next();
      return;
    }
  }

  throw new HttpError(
    401,
    "UNAUTHORIZED",
    "Sesi masuk tidak valid atau telah berakhir. Silakan masuk kembali."
  );
};

// Optional auth middleware that resolves user from token, Better Auth session, or x-user-id / demo user fallback.
export const resolveSessionOrDemoUser: RequestHandler = async (req, _res, next) => {
  const token = extractSessionToken(req);
  if (token) {
    const verified = await verifySessionToken(token);
    if (verified) {
      setRequestUser(verified.user.id);
      (req as any).currentUser = verified.user;
      (req as any).currentQuota = verified.quota;
      next();
      return;
    }
  }

  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (session) {
      const userRec = await getUserByIdOrDefault(session.user.id);
      const quota = await ensureUserDailyQuota(userRec.id);
      setRequestUser(userRec.id);
      (req as any).currentUser = userRec;
      (req as any).currentQuota = quota;
      next();
      return;
    }
  } catch {
    // Fallback below
  }

  const fallbackUserId =
    (typeof req.headers["x-user-id"] === "string" && req.headers["x-user-id"]) ||
    (typeof req.query?.userId === "string" && req.query.userId) ||
    "user-creator-demo";

  const userRec = await getUserByIdOrDefault(fallbackUserId);
  const quota = await ensureUserDailyQuota(userRec.id);
  setRequestUser(userRec.id);
  (req as any).currentUser = userRec;
  (req as any).currentQuota = quota;
  next();
};

// Role check for endpoints that reach past the caller's own rows. Reads the
// stored role, so a revoked role takes effect on the next request. Mount after
// requireAuth. Hiding UI in the web app is never the access check.
export function requirePermission(permissions: Permissions): RequestHandler {
  return async (req, _res, next) => {
    const { success } = await auth.api.userHasPermission({
      body: { userId: getAuth(req).user.id, permissions },
    });
    if (!success)
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Your account cannot perform this action.",
      );
    next();
  };
}

// The verified session inside a handler mounted after requireAuth.
export function getAuth(req: Request) {
  if (!req.auth)
    throw new Error("getAuth() used on a route without requireAuth");
  return req.auth;
}
