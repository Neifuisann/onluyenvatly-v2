import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { mistakes } from "@/db/schema";
import type { QuestionType } from "@/features/lessons/schema";
import { RESOLVE_STREAK } from "./domain/mistakes";

/** One question of a submitted attempt, where the bank keeps it. */
export type MistakeTarget = {
  lessonId: number;
  lessonVersionId: number;
  questionId: string;
  questionType: QuestionType;
};

export type MistakeUpdate = {
  userId: string;
  attemptId: string;
  /** From `mistakeChanges`: answered short of full marks / correctly. */
  wrong: readonly MistakeTarget[];
  correct: readonly MistakeTarget[];
  now: Date;
};

/**
 * Upserts the mistakes bank inside the submit transaction (02 §4.1), with
 * the same rules as `nextMistake`: at most one multi-row upsert and one
 * UPDATE per submit, none when there is nothing to change. A review attempt
 * (S7-06) spans lessons, so every row carries its own lesson and version.
 */
export async function recordMistakes(tx: Tx, u: MistakeUpdate) {
  if (u.wrong.length > 0)
    await tx
      .insert(mistakes)
      .values(
        u.wrong.map((t) => ({
          userId: u.userId,
          lessonId: t.lessonId,
          questionId: t.questionId,
          questionType: t.questionType,
          lessonVersionId: t.lessonVersionId,
          wrongCount: 1,
          lastAttemptId: u.attemptId,
          updatedAt: u.now,
        })),
      )
      .onConflictDoUpdate({
        target: [mistakes.userId, mistakes.lessonId, mistakes.questionId],
        set: {
          // smallint: stop counting rather than overflow.
          wrongCount: sql`least(${mistakes.wrongCount} + 1, 32767)`,
          correctStreak: 0,
          status: "open",
          lessonVersionId: sql`excluded.lesson_version_id`,
          questionType: sql`excluded.question_type`,
          lastAttemptId: u.attemptId,
          updatedAt: u.now,
        },
      });
  if (u.correct.length === 0) return;
  // Only open mistakes move; resolved ones stay as they are.
  const rows = sql.join(
    u.correct.map(
      (t) =>
        sql`(${t.lessonId}::bigint, ${t.questionId}::text, ${t.lessonVersionId}::bigint)`,
    ),
    sql`, `,
  );
  await tx.execute(sql`
    update mistakes as m set
      correct_streak = m.correct_streak + 1,
      status = (case when m.correct_streak + 1 >= ${RESOLVE_STREAK}
        then 'resolved' else 'open' end)::mistake_status,
      lesson_version_id = c.version_id,
      last_attempt_id = ${u.attemptId}::uuid,
      updated_at = ${u.now.toISOString()}::timestamptz
    from (values ${rows}) as c(lesson_id, question_id, version_id)
    where m.user_id = ${u.userId}::uuid
      and m.status = 'open'
      and m.lesson_id = c.lesson_id
      and m.question_id = c.question_id`);
}
