import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

/**
 * Postgres fixed-window rate limiter (04 `rate_limits`, 06 §4). One atomic
 * upsert per check, no extra service. Rows older than a day are pruned by the
 * daily cron.
 */
export const WINDOW_SECONDS = {
  "1m": 60,
  "10m": 600,
  "1h": 3600,
  "1d": 86_400,
} as const;

export type RateWindow = keyof typeof WINDOW_SECONDS;

export type RateLimitResult = {
  ok: boolean;
  count: number;
  /** Seconds until the current window ends. */
  retryAfterSec: number;
};

/** Start of the fixed window containing `now` (UTC-aligned). */
export function windowStart(now: Date, window: RateWindow): Date {
  const ms = WINDOW_SECONDS[window] * 1000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

/**
 * Counts one hit for `key` and says whether it's within `limit` for the
 * window. The window is part of the stored key, so one logical key can carry
 * several limits (e.g. 5/min and 20/hour).
 */
export async function rateLimit(
  key: string,
  limit: number,
  window: RateWindow,
  now = new Date(),
): Promise<RateLimitResult> {
  const start = windowStart(now, window);
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count)
    values (${`${key}@${window}`}, ${start.toISOString()}::timestamptz, 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start = excluded.window_start
                   then rate_limits.count + 1 else 1 end,
      window_start = excluded.window_start
    returning count`);
  // postgres.js returns an array, PGlite returns { rows }.
  const list = Array.isArray(rows) ? rows : (rows as { rows: unknown[] }).rows;
  const count = Number((list[0] as { count: number } | undefined)?.count ?? 0);
  const end = start.getTime() + WINDOW_SECONDS[window] * 1000;
  return {
    ok: count <= limit,
    count,
    retryAfterSec: Math.max(1, Math.ceil((end - now.getTime()) / 1000)),
  };
}

/** Runs several limits and fails if any is exceeded. All are counted. */
export async function rateLimitAll(
  checks: ReadonlyArray<
    readonly [key: string, limit: number, window: RateWindow]
  >,
  now = new Date(),
): Promise<RateLimitResult> {
  const results = await Promise.all(
    checks.map(([key, limit, window]) => rateLimit(key, limit, window, now)),
  );
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) return { ok: true, count: 0, retryAfterSec: 0 };
  return {
    ok: false,
    count: Math.max(...failed.map((r) => r.count)),
    retryAfterSec: Math.max(...failed.map((r) => r.retryAfterSec)),
  };
}
