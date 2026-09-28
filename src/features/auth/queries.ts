import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE } from "./core/cookie";
import { type SessionUser, validateSessionToken } from "./session";

/**
 * The logged-in user, or null. Per request, deduped with React `cache()`, so
 * a page, its layout and its actions share one DB lookup. Never shared-cached.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? validateSessionToken(token) : null;
});
