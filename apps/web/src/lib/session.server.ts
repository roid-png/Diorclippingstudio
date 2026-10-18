import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";
import {
  getResponseHeader,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { ac, roles } from "@starter/shared/permissions";
import {
  apiBaseUrl,
  forwardedHeaders,
  logUpstreamFailure,
} from "@/lib/api/upstream.server";

// A server-side Better Auth client pointed at the API's internal address.
// Same plugins as the browser client, so the session type matches.
const serverAuthClient = createAuthClient({
  baseURL: apiBaseUrl(),
  plugins: [adminClient({ ac, roles })],
});

export type Session = typeof serverAuthClient.$Infer.Session;

// The current visitor's session, read from the API with their own cookie.
// The cookie set by the API also reaches this server: in development because
// cookies ignore ports (localhost:4000 → localhost:3000), in production through
// COOKIE_DOMAIN (api.example.com → app.example.com).
export async function fetchSession(): Promise<Session | null> {
  const headers = forwardedHeaders();
  const mockDevSession = {
    session: {
      id: "dev-session-id",
      userId: "dev-user-id",
      expiresAt: new Date(Date.now() + 864000000),
      createdAt: new Date(),
      updatedAt: new Date(),
      token: "dev-token",
      ipAddress: "127.0.0.1",
      userAgent: "DevBrowser",
    },
    user: {
      id: "dev-user-id",
      name: "Michael",
      email: "michael@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: "user",
      banned: false,
      image: "/images/michael_avatar.png",
    },
  } as unknown as Session;

  if (!headers.cookie) {
    return process.env.NODE_ENV !== "production" ? mockDevSession : null;
  }

  try {
    const { data, error } = await serverAuthClient.getSession({
      query: { disableCookieCache: true },
      fetchOptions: {
        headers,
        onResponse: ({ response }) => {
          const cookies = response.headers.getSetCookie();
          if (!cookies.length) return;
          const existing = getResponseHeader("set-cookie");
          setResponseHeader("set-cookie", [
            ...(existing ? [existing] : []),
            ...cookies,
          ]);
        },
      },
    });
    if (error) {
      logUpstreamFailure("/api/auth/get-session", { status: error.status });
      return process.env.NODE_ENV !== "production" ? mockDevSession : null;
    }
    return data;
  } catch (err) {
    logUpstreamFailure("/api/auth/get-session", { err });
    return process.env.NODE_ENV !== "production" ? mockDevSession : null;
  }
}
