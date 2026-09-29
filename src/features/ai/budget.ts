import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { rateLimits } from "@/db/schema";
import { getSettings } from "@/features/settings/queries";
import { vnDateKey } from "@/lib/dates";
import { env } from "@/lib/env.server";
import { budgetKey, effectiveBudget } from "./domain/policy";
import type { AiFailure } from "./gemini";

// postgres.js returns an array, PGlite returns { rows }.
const rowsOf = (result: unknown) =>
  (Array.isArray(result)
    ? result
    : (result as { rows: unknown[] }).rows) as Record<string, unknown>[];

const dayStart = (vnDay: string) => new Date(`${vnDay}T00:00:00+07:00`);

/**
 * The gate in front of every Gemini call (09 §2): the kill switch
 * (`settings.ai_enabled`), then one generation counted against today's
 * global budget. The counter is a `rate_limits` row per Vietnam day that is
 * only incremented while below the budget, so a refused call costs nothing.
 * A generation that fails afterwards stays counted (Google counts it too).
 */
export async function reserveAiCall(
  now = new Date(),
): Promise<{ ok: true } | AiFailure> {
  const settings = await getSettings();
  if (!settings.aiEnabled)
    return { ok: false, code: "AI_UNAVAILABLE", reason: "disabled" };
  const budget = effectiveBudget(settings.aiDailyBudget, env.AI_DAILY_BUDGET);
  if (budget <= 0) return { ok: false, code: "AI_QUOTA", reason: "budget" };
  const day = vnDateKey(now);
  const rows = rowsOf(
    await db.execute(sql`
      insert into rate_limits (key, window_start, count)
      values (${budgetKey(day)}, ${dayStart(day).toISOString()}::timestamptz, 1)
      on conflict (key) do update set count = rate_limits.count + 1
        where rate_limits.count < ${budget}
      returning count`),
  );
  return rows.length > 0
    ? { ok: true }
    : { ok: false, code: "AI_QUOTA", reason: "budget" };
}

export type AiUsageToday = { used: number; budget: number; enabled: boolean };

/** Generations counted today, for the admin dashboard (one key lookup). */
export async function getAiUsageToday(now = new Date()): Promise<AiUsageToday> {
  const settings = await getSettings();
  const [row] = await db
    .select({ count: rateLimits.count })
    .from(rateLimits)
    .where(eq(rateLimits.key, budgetKey(vnDateKey(now))))
    .limit(1);
  return {
    used: row?.count ?? 0,
    budget: effectiveBudget(settings.aiDailyBudget, env.AI_DAILY_BUDGET),
    enabled: settings.aiEnabled,
  };
}
