/**
 * Password hashing and policy (06 §1). bcryptjs cost 10 keeps v1's
 * `$2a$/$2b$10$` hashes valid and is pure JS (no native build on Vercel).
 */
import bcrypt from "bcryptjs";

export const BCRYPT_COST = 10;
export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt ignores everything after 72 bytes. */
export const PASSWORD_MAX_BYTES = 72;

/**
 * A real cost-10 hash of a random string nobody knows. Comparing against it
 * when the user doesn't exist keeps login timing roughly constant.
 */
const DUMMY_HASH =
  "$2b$10$t2qtT2Z2y.bS.veaob4ICeT6iYIArU.lGgyzJNXt/XOjBuAXq1.tq";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/** Always does one bcrypt comparison, even when `hash` is null. */
export async function verifyPassword(
  password: string,
  hash: string | null | undefined,
): Promise<boolean> {
  const matches = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return hash != null && matches;
}

export type PasswordIssue =
  | "TOO_SHORT"
  | "TOO_LONG"
  | "ALL_DIGITS"
  | "CONTAINS_PHONE";

/** New passwords: ≥ 8 characters, not all digits, not the phone number. */
export function passwordIssue(
  password: string,
  phone?: string | null,
): PasswordIssue | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "TOO_SHORT";
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES)
    return "TOO_LONG";
  if (/^\d+$/.test(password)) return "ALL_DIGITS";
  if (phone && (password.includes(phone) || password.includes(phone.slice(1))))
    return "CONTAINS_PHONE";
  return null;
}
