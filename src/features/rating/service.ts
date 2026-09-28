import "server-only";
import { eq } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { ratingEvents, ratings } from "@/db/schema";
import {
  applyRating,
  INITIAL_RATING,
  performance,
  type RatingStep,
  timeBonusV2,
} from "./domain/rating";

export type RatedAttempt = {
  userId: string;
  attemptId: string;
  lessonId: number;
  score: number;
  maxScore: number;
  timeTakenSec: number;
  timeLimitSec: number | null;
  now: Date;
};

/**
 * Applies one graded attempt to the student's rating inside the submit
 * transaction (ADR-004). The `ratings` row is locked, so two tests submitted
 * at once by the same student both count, in order.
 */
export async function rateAttempt(
  tx: Tx,
  a: RatedAttempt,
): Promise<RatingStep> {
  const current = await lockRating(tx, a.userId);
  const perf = performance(a.score, a.maxScore);
  const bonus = timeBonusV2(a.timeTakenSec, a.timeLimitSec);
  const step = applyRating(current, perf, bonus);

  await tx
    .update(ratings)
    .set({
      rating: step.state.rating,
      peak: step.state.peak,
      ratedAttempts: step.state.rated,
      updatedAt: a.now,
    })
    .where(eq(ratings.userId, a.userId));
  await tx.insert(ratingEvents).values({
    userId: a.userId,
    attemptId: a.attemptId,
    lessonId: a.lessonId,
    before: step.before,
    delta: step.delta,
    after: step.after,
    performance: perf,
    timeBonus: bonus,
    formula: "v2",
    createdAt: a.now,
  });
  return step;
}

/** The student's rating row, created at 1500 on their first rated test. */
async function lockRating(tx: Tx, userId: string) {
  const read = () =>
    tx
      .select({
        rating: ratings.rating,
        peak: ratings.peak,
        rated: ratings.ratedAttempts,
      })
      .from(ratings)
      .where(eq(ratings.userId, userId))
      .for("update")
      .limit(1);
  const [row] = await read();
  if (row) return row;
  // Column defaults are the starting rating. A parallel first submit may
  // insert it first; then lock theirs.
  await tx.insert(ratings).values({ userId }).onConflictDoNothing();
  const [created] = await read();
  return created ?? INITIAL_RATING;
}
