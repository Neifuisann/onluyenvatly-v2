import "server-only";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db/client";
import { classMembers, ratingEvents, ratings, users } from "@/db/schema";
import { tags } from "@/lib/cache-tags";
import {
  type LeaderboardPeriod,
  MAX_ROWS,
  publicName,
  type RankedEntry,
  withRanks,
} from "./domain/leaderboard";

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

/**
 * A class's ranked leaderboard (05 §4, B-03), shared by every student of the
 * class: tag `leaderboard`, regenerated at most once a minute, so a burst of
 * submits never recomputes it (08 §2). The page checks the viewer is in the
 * class. Active students with a rating only; never the phone or DOB (06 §5).
 * User ids stay on the server: the page uses them to find "me".
 */
export async function getLeaderboard(f: {
  classId: number;
  period: LeaderboardPeriod;
}): Promise<RankedEntry[]> {
  "use cache";
  cacheTag(tags.leaderboard);
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  // Rolling 7 days like v1's "week" filter; served by `rating_events_created_idx`.
  const week = db
    .select({
      userId: ratingEvents.userId,
      delta: sql<number>`sum(${ratingEvents.delta})::int`.as("week_delta"),
    })
    .from(ratingEvents)
    .where(sql`${ratingEvents.createdAt} >= now() - interval '7 days'`)
    .groupBy(ratingEvents.userId)
    .as("week");
  const weekDelta = sql<number>`coalesce(${week.delta}, 0)`;
  const byWeek = f.period === "week";
  const rows = await db
    .select({
      userId: ratings.userId,
      fullName: users.fullName,
      initialsOnly: users.leaderboardInitials,
      className: users.className,
      rating: ratings.rating,
      weekDelta,
    })
    .from(classMembers)
    .innerJoin(ratings, eq(ratings.userId, classMembers.userId))
    .innerJoin(users, eq(users.id, ratings.userId))
    .leftJoin(week, eq(week.userId, ratings.userId))
    .where(
      and(
        eq(classMembers.classId, f.classId),
        eq(users.role, "student"),
        eq(users.status, "active"),
        // "Most improved" lists only students who did a rated test this week.
        byWeek ? isNotNull(week.userId) : undefined,
      ),
    )
    .orderBy(
      ...(byWeek ? [desc(weekDelta)] : []),
      desc(ratings.rating),
      // Ties share a rank (withRanks); this only fixes the order within one.
      sql`lower(immutable_unaccent(${users.fullName}))`,
      asc(ratings.userId),
    )
    .limit(MAX_ROWS);
  // Resolved before caching: a student who chose initials never has their
  // full name in the shared entry (S8-04).
  return withRanks(
    rows.map(({ fullName, initialsOnly, ...row }) => ({
      ...row,
      fullName: publicName(fullName, initialsOnly),
    })),
    f.period,
  );
}
