/**
 * Vietnamese mobile numbers are stored as `0xxxxxxxxx` (10 digits, 04 §2).
 * Accepts the ways students actually type them: spaces, dots, dashes,
 * brackets, a +84/84 country code, or a missing leading 0.
 */
const MOBILE = /^0[35789]\d{8}$/;

export function normalizePhone(raw: string): string | null {
  let digits = raw.trim().replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith("84") && digits.length === 11)
    digits = `0${digits.slice(2)}`;
  else if (digits.length === 9) digits = `0${digits}`;
  return MOBILE.test(digits) ? digits : null;
}

/** For logs only (06 §4): `0912345678` → `09xx…678`. */
export function maskPhone(phone: string): string {
  if (phone.length < 6) return "xx…";
  return `${phone.slice(0, 2)}xx…${phone.slice(-3)}`;
}
