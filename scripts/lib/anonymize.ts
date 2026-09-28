/**
 * Anonymization for v1 fixture exports (S0-05). Pure: no DB, no I/O.
 * Fixtures are committed, so they must never contain names, phones, DOB,
 * password hashes, IPs, device ids or avatar URLs.
 */

/** Column names that hold personal data or secrets. Dropped entirely. */
export const PII_KEYS = new Set([
  "full_name",
  "fullName",
  "student_name",
  "studentName",
  "name",
  "phone",
  "phone_number",
  "phoneNumber",
  "date_of_birth",
  "dateOfBirth",
  "password",
  "password_hash",
  "passwordHash",
  "ip",
  "ip_address",
  "ipAddress",
  "user_agent",
  "userAgent",
  "approved_device_id",
  "approved_device_fingerprint",
  "device_id",
  "deviceId",
  "current_session_id",
  "avatar_url",
  "avatarUrl",
  "students",
]);

/** Keys that reference a student; values are replaced with a stable pseudonym. */
export const STUDENT_REF_KEYS = new Set(["student_id", "studentId"]);

export function createPseudonymizer(prefix = "student") {
  const map = new Map<string, string>();
  return (id: unknown): string | null => {
    if (id === null || id === undefined) return null;
    const key = String(id);
    let alias = map.get(key);
    if (!alias) {
      alias = `${prefix}_${String(map.size + 1).padStart(3, "0")}`;
      map.set(key, alias);
    }
    return alias;
  };
}

export type Pseudonymizer = ReturnType<typeof createPseudonymizer>;

/** Deep-copies `value`, dropping PII keys and pseudonymizing student refs. */
export function anonymize(value: unknown, pseudo: Pseudonymizer): unknown {
  if (Array.isArray(value)) return value.map((v) => anonymize(v, pseudo));
  if (value instanceof Date) return value.toISOString();
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (PII_KEYS.has(k)) continue;
    out[k] = STUDENT_REF_KEYS.has(k) ? pseudo(v) : anonymize(v, pseudo);
  }
  return out;
}

const PHONE_RE = /(?:\+?84|0)(?:[\s.-]?\d){9}/;

/** Returns paths of string values that still look like a VN phone number. */
export function findPhoneLikeStrings(value: unknown, path = "$"): string[] {
  if (typeof value === "string") return PHONE_RE.test(value) ? [path] : [];
  if (Array.isArray(value))
    return value.flatMap((v, i) => findPhoneLikeStrings(v, `${path}[${i}]`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) =>
      findPhoneLikeStrings(v, `${path}.${k}`),
    );
  return [];
}
