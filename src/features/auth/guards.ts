import "server-only";
import { redirect } from "next/navigation";
import { CHANGE_PASSWORD_PATH, homePath } from "./core/login-policy";
import { getCurrentUser } from "./queries";
import type { SessionUser } from "./session";

/**
 * Authorization helpers (06 §2). Every server action, route handler and
 * protected layout calls one of these first. `proxy.ts` is not a boundary.
 */

/**
 * The signed-in user, without the must-change-password redirect. Only the
 * change-password page and its action use this; every other page and action
 * goes through `requireUser()`.
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * While an admin reset the password (`must_change_password`), nothing but
 * the change-password page, logout and the change itself is reachable (06 §1).
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (user.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
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
