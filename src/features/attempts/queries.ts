import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import { attemptOverrides, attempts } from "@/db/schema";

/**
 * Per-user reads (05 §4, kind R): never shared-cached. A student has at most
 * a few hundred attempts, so `(user_id, …)` indexes keep these cheap.
 */

/** My attempts on one lesson, newest first, for the overview panel. */
export async function getMyLessonAttempts(userId: string, lessonId: number) {
  return db
    .select({
      id: attempts.id,
      status: attempts.status,
      score10: attempts.score10,
      startedAt: attempts.startedAt,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.lessonId, lessonId)))
    .orderBy(desc(attempts.startedAt))
    .limit(50);
}

/** Extra tries the teacher granted me on a lesson (0 if none). */
export async function getMyExtraAttempts(userId: string, lessonId: number) {
  const [row] = await db
    .select({ extra: attemptOverrides.extraAttempts })
    .from(attemptOverrides)
    .where(
      and(
        eq(attemptOverrides.userId, userId),
        eq(attemptOverrides.lessonId, lessonId),
      ),
    )
    .limit(1);
  return row?.extra ?? 0;
}

/**
 * One attempt for its runner or result page. Callers check ownership
 * (`userId`) before showing anything. Deduped per request.
 */
export const getAttempt = cache(async (id: string) => {
  const [row] = await db
    .select({
      id: attempts.id,
      userId: attempts.userId,
      lessonId: attempts.lessonId,
      lessonVersionId: attempts.lessonVersionId,
      mode: attempts.mode,
      status: attempts.status,
      items: attempts.items,
      answers: attempts.answers,
      flagged: attempts.flagged,
      checked: attempts.checked,
      guardEvents: attempts.guardEvents,
      earned: attempts.earned,
      score: attempts.score,
      maxScore: attempts.maxScore,
      score10: attempts.score10,
      startedAt: attempts.startedAt,
      deadlineAt: attempts.deadlineAt,
      submittedAt: attempts.submittedAt,
      timeTakenSec: attempts.timeTakenSec,
    })
    .from(attempts)
    .where(eq(attempts.id, id))
    .limit(1);
  return row ?? null;
});

/**
 * A migrated v1 result (`/result/:id` bookmarks, S8-05) by its unique
 * `legacy_result_id`. The caller checks the owner before redirecting.
 */
export async function getAttemptByLegacyResultId(legacyResultId: string) {
  const [row] = await db
    .select({ id: attempts.id, userId: attempts.userId })
    .from(attempts)
    .where(eq(attempts.legacyResultId, legacyResultId))
    .limit(1);
  return row ?? null;
}

export type AttemptView = NonNullable<Awaited<ReturnType<typeof getAttempt>>>;

export type MyLessonAttempt = Awaited<
  ReturnType<typeof getMyLessonAttempts>
>[number];
