import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ratingEvents } from "@/db/schema";

/**
 * The rating change one attempt produced, or null (not rated). Per-user,
 * never shared-cached; `attempt_id` is unique, so this is one index lookup.
 */
export async function getAttemptRatingEvent(attemptId: string) {
  const [row] = await db
    .select({
      before: ratingEvents.before,
      delta: ratingEvents.delta,
      after: ratingEvents.after,
    })
    .from(ratingEvents)
    .where(eq(ratingEvents.attemptId, attemptId))
    .limit(1);
  return row ?? null;
}

export type AttemptRatingEvent = NonNullable<
  Awaited<ReturnType<typeof getAttemptRatingEvent>>
>;
