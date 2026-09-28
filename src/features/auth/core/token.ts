/**
 * Session tokens (06 §1, ADR-003). The cookie holds 32 random bytes as
 * base64url. The DB stores only sha256(token ‖ pepper), so a DB leak doesn't
 * leak usable sessions.
 */
import { createHash } from "node:crypto";

const TOKEN_BYTES = 32;
/** 32 bytes in unpadded base64url. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Buffer.from(bytes).toString("base64url");
}

export function hashSessionToken(token: string, pepper: string): string {
  return createHash("sha256").update(token).update(pepper).digest("hex");
}

/** Cheap check so garbage cookies never reach the database. */
export function isWellFormedToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}
