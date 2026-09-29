/**
 * Temporary password for an admin reset (06 §1): 10 characters from an
 * alphabet without look-alikes (no 0/O, 1/l/I), always with a letter and a
 * digit, and accepted by the password policy for that student.
 */
import { passwordIssue } from "../../auth/core/password";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
export const TEMP_PASSWORD_LENGTH = 10;

/** `randomInt(max)` → integer in `[0, max)`. Inject a CSPRNG in production. */
export type RandomInt = (max: number) => number;

export function generateTempPassword(
  randomInt: RandomInt,
  phone?: string | null,
): string {
  const alphabet = LETTERS + DIGITS;
  for (;;) {
    const password = Array.from(
      { length: TEMP_PASSWORD_LENGTH },
      () => alphabet[randomInt(alphabet.length)] ?? "x",
    ).join("");
    if (
      /[A-Za-z]/.test(password) &&
      /\d/.test(password) &&
      passwordIssue(password, phone) === null
    )
      return password;
  }
}
