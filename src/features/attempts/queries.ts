import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attempts } from "@/db/schema";

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

export type MyLessonAttempt = Awaited<
  ReturnType<typeof getMyLessonAttempts>
>[number];
