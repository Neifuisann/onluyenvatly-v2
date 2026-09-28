/**
 * Session lifetime rules (06 §1): 30-day sliding expiry, renewed only when
 * fewer than 15 days remain, `last_seen_at` written at most once an hour.
 * This keeps DB writes on the hot path rare.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export const SESSION_TTL_MS = 30 * DAY_MS;
export const SESSION_RENEW_BELOW_MS = 15 * DAY_MS;
export const LAST_SEEN_INTERVAL_MS = 60 * 60 * 1000;

export function sessionExpiry(now: Date): Date {
  return new Date(now.getTime() + SESSION_TTL_MS);
}

export type SessionCheck =
  /** Delete the row and treat the request as logged out. */
  | { kind: "expired" }
  /** Valid. `expiresAt`/`lastSeenAt` are set when the row needs an update. */
  | { kind: "valid"; expiresAt?: Date; lastSeenAt?: Date };

export function checkSession(
  session: { expiresAt: Date; lastSeenAt: Date },
  now: Date,
): SessionCheck {
  const t = now.getTime();
  if (session.expiresAt.getTime() <= t) return { kind: "expired" };
  const renew = session.expiresAt.getTime() - t < SESSION_RENEW_BELOW_MS;
  const touch = t - session.lastSeenAt.getTime() >= LAST_SEEN_INTERVAL_MS;
  if (renew)
    return { kind: "valid", expiresAt: sessionExpiry(now), lastSeenAt: now };
  if (touch) return { kind: "valid", lastSeenAt: now };
  return { kind: "valid" };
}
