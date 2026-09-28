import "server-only";
import { redirect } from "next/navigation";
import { homePath } from "./core/login-policy";
import { getCurrentUser } from "./queries";
import type { SessionUser } from "./session";

/**
 * Authorization helpers (06 §2). Every server action, route handler and
 * protected layout calls one of these first. `proxy.ts` is not a boundary.
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Student pages. Admins may view them too (05 §1). */
export async function requireStudent(): Promise<SessionUser> {
  return requireUser();
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect(homePath(user.role));
  return user;
}
