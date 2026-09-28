/**
 * Pure login rules (06 §1): how an identifier is read, which statuses may
 * log in, and where each role lands afterwards.
 */
import { normalizePhone } from "./phone";

export type Role = "student" | "admin";
export type UserStatus = "pending" | "active" | "rejected" | "disabled";

export type Identifier =
  | { kind: "phone"; value: string }
  | { kind: "username"; value: string };

const USERNAME = /^[a-z][a-z0-9._-]{2,31}$/;

/** Students log in by phone; admins may also use a username. */
export function parseIdentifier(raw: string): Identifier | null {
  const phone = normalizePhone(raw);
  if (phone) return { kind: "phone", value: phone };
  const username = raw.trim().toLowerCase();
  return USERNAME.test(username) ? { kind: "username", value: username } : null;
}

export function isValidUsername(value: string): boolean {
  return USERNAME.test(value);
}

/**
 * Checked only AFTER the password matched, so account status never leaks to
 * someone who doesn't know the password.
 */
export function statusError(
  status: UserStatus,
): "ACCOUNT_PENDING" | "ACCOUNT_REJECTED" | null {
  switch (status) {
    case "active":
      return null;
    case "pending":
      return "ACCOUNT_PENDING";
    case "rejected":
    case "disabled":
      return "ACCOUNT_REJECTED";
  }
}

export function homePath(role: Role): "/admin" | "/dashboard" {
  return role === "admin" ? "/admin" : "/dashboard";
}

/** `next` must already be validated by `safeNextPath`. */
export function landingPath(role: Role, next: string | null): string {
  if (!next) return homePath(role);
  if (role === "student" && (next === "/admin" || next.startsWith("/admin/")))
    return homePath(role);
  return next;
}
