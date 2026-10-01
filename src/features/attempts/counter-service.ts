import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

/**
 * S9-01: metadata is recorded in one autocommit statement after grading.
 * The shared lesson row is never held while rating/mistake work commits.
 * Marking the attempt and incrementing the counter are atomic and retry-safe.
 */
export async function recordAttemptCount(attemptId: string) {
  await db.execute(sql`
    with counted as (
      update attempts set counter_recorded = true
      where id = ${attemptId}::uuid and status = 'submitted'
        and lesson_id is not null and not counter_recorded
      returning lesson_id
    )
    update lessons l set attempt_count = l.attempt_count + 1
    from counted c where l.id = c.lesson_id
  `);
}

/** Repair a lost post-commit connection; the partial index bounds this read. */
export async function flushAttemptCounters() {
  const rows = await db.execute<{ recorded: number }>(sql`
    with pending as (
      select id from attempts where status = 'submitted'
        and lesson_id is not null and not counter_recorded
      order by lesson_id limit 200 for update skip locked
    ), counted as (
      update attempts a set counter_recorded = true from pending p
      where a.id = p.id returning a.lesson_id
    ), totals as (
      select lesson_id, count(*)::int n from counted group by lesson_id
    ), updated as (
      update lessons l set attempt_count = l.attempt_count + t.n
      from totals t where l.id = t.lesson_id returning l.id
    )
    select count(*)::int recorded from counted
  `);
  // postgres-js returns the row array; PGlite integration tests wrap it.
  return Array.isArray(rows)
    ? (rows[0]?.recorded ?? 0)
    : ((rows as unknown as { rows: { recorded: number }[] }).rows[0]
        ?.recorded ?? 0);
}
