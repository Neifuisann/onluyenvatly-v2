import "server-only";
import { and, asc, eq, inArray, isNull, type SQL, sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { db } from "@/db/client";
import {
  attempts,
  lessons,
  lessonVersions,
  mistakes,
  ratingEvents,
  ratings,
} from "@/db/schema";
import { regradeAttempt } from "@/features/grading/domain/regrade";
import {
  performance,
  replayWithPerformance,
} from "@/features/rating/domain/rating";
import { writeAudit } from "@/lib/audit";
import { err, ok, type Result } from "@/lib/result";
import type { Actor } from "./admin-service";
import { applyCorrections, type Correction } from "./domain/corrections";
import { serializeLesson } from "./domain/serializer";
import { summarizeLesson } from "./domain/summary";
import { correctionCopy as M } from "./messages";
import { LessonConfigSchema, QuestionsSchema } from "./schema";

export type CorrectionOutcome = {
  versionId: number;
  /** Questions whose content changed. */
  changed: number;
  /** Attempts whose items or marks were rewritten. */
  regraded: number;
  /** Some student's rating was replayed. */
  rated: boolean;
};

/** Rows per batched UPDATE (each submitted row binds one value per item). */
const BATCH = 100;

/**
 * Applies corrections to the CURRENT version in place and regrades the
 * attempts that use it (B-10), in one transaction:
 * 1. lock the lesson, then its current version. Refused while a draft
 *    exists (publishing it would silently undo the fix) or when archived;
 * 2. `applyCorrections` (pure), then the version's questions and its text
 *    (`serializeLesson`, removed questions left out), and the lesson's counts;
 * 3. lock the attempts on that version holding a changed question, in id
 *    order, and rewrite their items, marks and scores (`regradeAttempt`);
 *    older versions' attempts keep the content they were taken on;
 * 4. a removed question leaves the mistakes bank;
 * 5. students whose rated scores moved get their rating replayed
 *    (`replayWithPerformance`), each `ratings` row locked after the
 *    attempts, the submit transaction's order;
 * 6. audit `lesson.correct`.
 * Callers check `requireAdmin()` first.
 */
export async function correctLesson(
  actor: Actor,
  id: number,
  corrections: readonly Correction[],
): Promise<Result<CorrectionOutcome>> {
  return db.transaction(async (tx) => {
    const [lesson] = await tx
      .select({
        status: lessons.status,
        config: lessons.config,
        currentVersionId: lessons.currentVersionId,
        draftVersionId: lessons.draftVersionId,
      })
      .from(lessons)
      .where(and(eq(lessons.id, id), isNull(lessons.deletedAt)))
      .for("update")
      .limit(1);
    if (!lesson) return err("NOT_FOUND");
    if (lesson.status === "archived")
      return err("CONFLICT", { message: M.archived });
    const versionId = lesson.currentVersionId;
    if (!versionId) return err("CONFLICT", { message: M.noPublished });
    if (lesson.draftVersionId) return err("CONFLICT", { message: M.hasDraft });
    const config = LessonConfigSchema.safeParse(lesson.config);
    if (!config.success) return err("INTERNAL");

    const [version] = await tx
      .select({ questions: lessonVersions.questions })
      .from(lessonVersions)
      .where(eq(lessonVersions.id, versionId))
      .for("update")
      .limit(1);
    const stored = QuestionsSchema.safeParse(version?.questions);
    if (!stored.success) return err("INTERNAL");

    const result = applyCorrections(stored.data, corrections, config.data);
    if (!result.ok) return err("VALIDATION", { message: result.message });
    const { questions, changed, points } = result;
    if (changed.length === 0)
      return ok({ versionId, changed: 0, regraded: 0, rated: false });

    await tx
      .update(lessonVersions)
      .set({ questions, sourceText: serializeLesson(questions) })
      .where(eq(lessonVersions.id, versionId));
    await tx
      .update(lessons)
      .set({
        updatedAt: sql`now()`,
        ...summarizeLesson(questions, config.data),
      })
      .where(eq(lessons.id, id));

    const regraded = await regradeVersion(tx, versionId, {
      questions: new Map(questions.map((q) => [q.id, q])),
      changed: new Set(changed),
      points,
      tfScoring: config.data.tfScoring,
    });

    const removed = questions
      .filter((q, i) => q.removed && !stored.data[i]?.removed)
      .map((q) => q.id);
    if (removed.length)
      await tx
        .delete(mistakes)
        .where(
          and(
            eq(mistakes.lessonVersionId, versionId),
            inArray(mistakes.questionId, removed),
          ),
        );

    const rated = await replayRatings(tx, regraded.rescored);

    await writeAudit(tx, {
      actorId: actor.id,
      action: "lesson.correct",
      targetType: "lesson",
      targetId: id,
      data: {
        versionId,
        kinds: [...new Set(corrections.map((c) => c.kind))],
        questions: changed,
        regraded: regraded.count,
        rated,
      },
    });
    return ok({
      versionId,
      changed: changed.length,
      regraded: regraded.count,
      rated,
    });
  });
}

type Rescored = { attemptId: string; userId: string; performance: number };

async function regradeVersion(
  tx: Tx,
  versionId: number,
  c: {
    questions: Parameters<typeof regradeAttempt>[1];
    changed: ReadonlySet<string>;
    points: ReadonlyMap<string, number>;
    tfScoring: Parameters<typeof regradeAttempt>[4];
  },
): Promise<{ count: number; rescored: Rescored[] }> {
  const holds = [...c.changed].map(
    (q) => sql`${attempts.items} @> ${JSON.stringify([{ q }])}::jsonb`,
  );
  const rows = await tx
    .select({
      id: attempts.id,
      userId: attempts.userId,
      items: attempts.items,
      answers: attempts.answers,
      earned: attempts.earned,
      score: attempts.score,
      maxScore: attempts.maxScore,
    })
    .from(attempts)
    .where(
      and(
        eq(attempts.lessonVersionId, versionId),
        sql`(${sql.join(holds, sql` or `)})`,
      ),
    )
    .orderBy(asc(attempts.id))
    .for("update");

  const updates: SQL[] = [];
  const rescored: Rescored[] = [];
  for (const row of rows) {
    const next = regradeAttempt(
      row,
      c.questions,
      c.changed,
      c.points,
      c.tfScoring,
    );
    if (!next) continue;
    const earned = next.earned
      ? sql`array[${sql.join(
          next.earned.map((e) => sql`${e}`),
          sql`, `,
        )}]::numeric[]`
      : sql`null::numeric[]`;
    updates.push(
      sql`(${row.id}::uuid, ${JSON.stringify(next.items)}::jsonb, ${earned}, ${next.score}::numeric, ${next.maxScore}::numeric, ${next.score10}::numeric)`,
    );
    if (
      next.score !== null &&
      (next.score !== row.score || next.maxScore !== row.maxScore)
    )
      rescored.push({
        attemptId: row.id,
        userId: row.userId,
        performance: performance(next.score, next.maxScore),
      });
  }
  for (let i = 0; i < updates.length; i += BATCH)
    await tx.execute(sql`
      update ${attempts} as a
      set "items" = v."items", "earned" = v."earned", "score" = v."score",
          "max_score" = v."max_score", "score10" = v."score10"
      from (values ${sql.join(updates.slice(i, i + BATCH), sql`, `)})
        as v("id", "items", "earned", "score", "max_score", "score10")
      where a.id = v.id`);
  return { count: updates.length, rescored };
}

/** Replays the rating of every student with a rescored rated attempt. */
async function replayRatings(
  tx: Tx,
  rescored: readonly Rescored[],
): Promise<boolean> {
  if (rescored.length === 0) return false;
  const byAttempt = new Map(rescored.map((r) => [r.attemptId, r.performance]));
  const users = [...new Set(rescored.map((r) => r.userId))].sort();
  let rated = false;
  for (const userId of users) {
    await tx
      .select({ userId: ratings.userId })
      .from(ratings)
      .where(eq(ratings.userId, userId))
      .for("update");
    const events = await tx
      .select({
        id: ratingEvents.id,
        attemptId: ratingEvents.attemptId,
        before: ratingEvents.before,
        delta: ratingEvents.delta,
        after: ratingEvents.after,
        formula: ratingEvents.formula,
        performance: ratingEvents.performance,
        timeBonus: ratingEvents.timeBonus,
      })
      .from(ratingEvents)
      .where(eq(ratingEvents.userId, userId))
      .orderBy(asc(ratingEvents.createdAt), asc(ratingEvents.id));
    const performances = new Map<number, number>();
    for (const e of events) {
      const p = e.attemptId ? byAttempt.get(e.attemptId) : undefined;
      // Migrated history keeps its recorded delta (ADR-004).
      if (p !== undefined && e.formula === "v2") performances.set(e.id, p);
    }
    if (performances.size === 0) continue;
    const { state, changed } = replayWithPerformance(events, performances);
    if (changed.length === 0) continue;
    rated = true;
    await tx.execute(sql`
      update ${ratingEvents} as e
      set "before" = v."before", "delta" = v."delta", "after" = v."after",
          "performance" = v."performance"
      from (values ${sql.join(
        changed.map(
          (c) =>
            sql`(${c.id}::bigint, ${c.before}::int, ${c.delta}::int, ${c.after}::int, ${c.performance}::numeric)`,
        ),
        sql`, `,
      )}) as v("id", "before", "delta", "after", "performance")
      where e.id = v.id`);
    await tx
      .update(ratings)
      .set({
        rating: state.rating,
        peak: state.peak,
        ratedAttempts: state.rated,
        updatedAt: sql`now()`,
      })
      .where(eq(ratings.userId, userId));
  }
  return rated;
}
