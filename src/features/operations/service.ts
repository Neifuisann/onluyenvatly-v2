import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, isNotNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attempts, lessonVersions, rateLimits, sessions } from "@/db/schema";
import { cleanupImports } from "@/features/ai/import-service";
import { flushAttemptCounters } from "@/features/attempts/counter-service";
import { submitAttempt } from "@/features/attempts/service";
import { retentionCutoffs } from "./domain/retention";

/** S9-05: bounded, retry-safe daily work; no new student hot-path queries. */
export async function runDailyMaintenance(now = new Date()) {
  const cutoff = retentionCutoffs(now);
  const due = and(
    eq(attempts.status, "in_progress"),
    lt(attempts.deadlineAt, cutoff.expiry),
  );
  const stale = await db
    .select({ id: attempts.id, userId: attempts.userId })
    .from(attempts)
    .where(due)
    .orderBy(asc(attempts.deadlineAt))
    .limit(200);
  let submitted = 0;
  let failed = 0;
  for (const attempt of stale) {
    const result = await submitAttempt(
      attempt.userId,
      attempt.id,
      {
        answers: [],
        flagged: [],
        clientSubmitId: randomUUID(),
      },
      now,
    );
    if (result.ok) submitted++;
    else failed++;
  }
  const counters = await flushAttemptCounters();
  const expiredSessions = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ id: sessions.id });
  const oldLimits = await db
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, cutoff.rateLimits))
    .returning({ key: rateLimits.key });
  // Every reference protects a version; current/draft and migrated historical
  // content survive. Orphan explanation text is content-addressed separately.
  const oldVersions = await db
    .delete(lessonVersions)
    .where(sql`
    ${lessonVersions.createdAt} < ${cutoff.rateLimits.toISOString()}::timestamptz
    and ${lessonVersions.id} not in (
      select current_version_id from lessons where current_version_id is not null
      union select draft_version_id from lessons where draft_version_id is not null
      union select lesson_version_id from attempts where lesson_version_id is not null
      union select lesson_version_id from mistakes
      union select (i->>'v')::bigint from attempts a, jsonb_array_elements(a.items) i where i->>'v' is not null
    )
  `)
    .returning({ id: lessonVersions.id });
  const privateRows = await db
    .update(attempts)
    .set({ ip: null, guardEvents: [] })
    .where(
      and(
        lt(attempts.startedAt, cutoff.privateData),
        or(
          isNotNull(attempts.ip),
          sql`jsonb_array_length(${attempts.guardEvents}) > 0`,
        ),
      ),
    )
    .returning({ id: attempts.id });
  const imports = await cleanupImports({ now });
  const [pending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(attempts)
    .where(due);
  await db.execute(sql`select 1`);
  return {
    submitted,
    counters,
    failed,
    pending: pending?.count ?? 0,
    sessions: expiredSessions.length,
    rateLimits: oldLimits.length,
    versions: oldVersions.length,
    privateRows: privateRows.length,
    imports,
  };
}
