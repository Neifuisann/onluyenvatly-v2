import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attempts, lessons, ratingEvents, ratings } from "@/db/schema";
import { replayWithout } from "@/features/rating/domain/rating";
import { writeAudit } from "@/lib/audit";
import { err, ok, type Result } from "@/lib/result";

export type Actor = { id: string };

export type DeletedAttempt = {
  userId: string;
  lessonId: number | null;
  status: "in_progress" | "submitted" | "expired";
  /** It had a rating event: the student's rating was replayed. */
  rated: boolean;
};

/**
 * Deletes one attempt (S6-04, 05 §2) in one transaction:
 * 1. lock the attempt, then the student's `ratings` row (the submit
 *    transaction's order, so the two never deadlock);
 * 2. read the student's rating events in order, delete the attempt (its own
 *    event cascades), and replay the others with `replayWithout`: events
 *    whose `before/delta/after` change are rewritten in one UPDATE, the
 *    `ratings` row gets the new rating, peak and count, or goes when no
 *    event is left;
 * 3. a submitted attempt no longer counts in `lessons.attempt_count`
 *    (never below 0);
 * 4. audit `attempt.delete` with ids only.
 * Mistakes stay as they are: the bank holds what the student got wrong, and
 * the next attempts correct it (`mistakes.last_attempt_id` becomes null).
 */
export async function deleteAttempt(
  actor: Actor,
  id: string,
  now = new Date(),
): Promise<Result<DeletedAttempt>> {
  return db.transaction(async (tx) => {
    const [attempt] = await tx
      .select({
        userId: attempts.userId,
        lessonId: attempts.lessonId,
        status: attempts.status,
        counterRecorded: attempts.counterRecorded,
      })
      .from(attempts)
      .where(eq(attempts.id, id))
      .for("update")
      .limit(1);
    if (!attempt) return err("NOT_FOUND");
    const { userId, lessonId, status } = attempt;

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
    const removed = events.find((e) => e.attemptId === id);

    await tx.delete(attempts).where(eq(attempts.id, id));

    if (removed) {
      const { state, changed } = replayWithout(events, removed.id);
      if (changed.length > 0)
        await tx.execute(sql`
          update ${ratingEvents} as e
          set "before" = v."before", "delta" = v."delta", "after" = v."after"
          from (values ${sql.join(
            changed.map(
              (c) =>
                sql`(${c.id}::bigint, ${c.before}::int, ${c.delta}::int, ${c.after}::int)`,
            ),
            sql`, `,
          )}) as v("id", "before", "delta", "after")
          where e.id = v.id`);
      if (state) {
        const values = {
          rating: state.rating,
          peak: state.peak,
          ratedAttempts: state.rated,
          updatedAt: now,
        };
        await tx
          .insert(ratings)
          .values({ userId, ...values })
          .onConflictDoUpdate({ target: ratings.userId, set: values });
      } else await tx.delete(ratings).where(eq(ratings.userId, userId));
    }

    if (status === "submitted" && lessonId !== null && attempt.counterRecorded)
      await tx
        .update(lessons)
        .set({ attemptCount: sql`greatest(${lessons.attemptCount} - 1, 0)` })
        .where(eq(lessons.id, lessonId));

    await writeAudit(tx, {
      actorId: actor.id,
      action: "attempt.delete",
      targetType: "attempt",
      targetId: id,
      data: { userId, lessonId, status, rated: Boolean(removed) },
    });
    return ok({ userId, lessonId, status, rated: Boolean(removed) });
  });
}
