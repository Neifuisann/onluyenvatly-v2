import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { mistakes } from "@/db/schema";
import { RESOLVE_STREAK } from "./domain/mistakes";

export type MistakeUpdate = {
  userId: string;
  lessonId: number;
  lessonVersionId: number;
  attemptId: string;
  /** From `mistakeChanges`. */
  wrong: readonly string[];
  correct: readonly string[];
  now: Date;
};

/**
 * Upserts the mistakes bank inside the submit transaction (02 §4.1), with
 * the same rules as `nextMistake`: at most one multi-row upsert and one
 * UPDATE per submit, none when there is nothing to change.
 */
export async function recordMistakes(tx: Tx, u: MistakeUpdate) {
  const touched = {
    lessonVersionId: u.lessonVersionId,
    lastAttemptId: u.attemptId,
    updatedAt: u.now,
  };
  if (u.wrong.length > 0)
    await tx
      .insert(mistakes)
      .values(
        u.wrong.map((questionId) => ({
          userId: u.userId,
          lessonId: u.lessonId,
          questionId,
          wrongCount: 1,
          ...touched,
        })),
      )
      .onConflictDoUpdate({
        target: [mistakes.userId, mistakes.lessonId, mistakes.questionId],
        set: {
          // smallint: stop counting rather than overflow.
          wrongCount: sql`least(${mistakes.wrongCount} + 1, 32767)`,
          correctStreak: 0,
          status: "open",
          ...touched,
        },
      });
  // Only open mistakes move; resolved ones stay as they are.
  if (u.correct.length > 0)
    await tx
      .update(mistakes)
      .set({
        correctStreak: sql`${mistakes.correctStreak} + 1`,
        status: sql`case when ${mistakes.correctStreak} + 1 >= ${RESOLVE_STREAK}
          then 'resolved' else 'open' end::mistake_status`,
        ...touched,
      })
      .where(
        and(
          eq(mistakes.userId, u.userId),
          eq(mistakes.lessonId, u.lessonId),
          inArray(mistakes.questionId, [...u.correct]),
          eq(mistakes.status, "open"),
        ),
      );
}
