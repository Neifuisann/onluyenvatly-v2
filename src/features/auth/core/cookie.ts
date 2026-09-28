/**
 * Session cookie contract, shared by the auth code and `proxy.ts`.
 * `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=30d` (06 §1).
 */
import { SESSION_TTL_MS } from "./session-policy";

export const SESSION_COOKIE = "ovl_session";

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}
