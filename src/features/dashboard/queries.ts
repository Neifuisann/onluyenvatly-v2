import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attempts, lessons, users } from "@/db/schema";

/**
 * Per-user dashboard reads (S4-06, kind R, never shared-cached). With the
 * session lookup the page makes 3 per-user queries; the rank and the
 * recommendations come from the shared leaderboard and catalog caches.
 */

export type RatingPoint = { before: number; after: number; delta: number };

export type DashboardStats = {
  /** null until the first rated test. */
  rating: number | null;
  openMistakes: number;
  /** Lessons with at least one submitted attempt. */
  doneLessonIds: number[];
  /** Up to the 7 latest rating changes, oldest first. */
  recent: RatingPoint[];
};

/**
 * Rating, open mistakes, finished lessons and the last rating changes in one
 * round trip. Each subquery is served by a `(user_id, …)` index: `ratings`
 * pkey, `mistakes_user_status_idx`, `attempts_user_submitted_idx`,
 * `rating_events_user_created_idx`.
 */
export async function getDashboardStats(
  userId: string,
): Promise<DashboardStats> {
  const [row] = await db
    .select({
      rating: sql<
        number | null
      >`(select rating from ratings where user_id = ${userId})`,
      openMistakes: sql<number>`(select count(*)::int from mistakes
        where user_id = ${userId} and status = 'open')`,
      done: sql<unknown>`array(select distinct lesson_id from attempts
        where user_id = ${userId} and status = 'submitted'
          and lesson_id is not null)`,
      recent: sql<unknown>`(select coalesce(json_agg(json_build_object(
          'before', e.before, 'after', e.after, 'delta', e.delta)
          order by e.created_at, e.id), '[]'::json)
        from (select before, after, delta, created_at, id from rating_events
          where user_id = ${userId}
          order by created_at desc, id desc limit 7) e)`,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    rating: row?.rating ?? null,
    openMistakes: row?.openMistakes ?? 0,
    doneLessonIds: parseArray(row?.done).map(Number),
    recent: parseJson<RatingPoint[]>(row?.recent, []),
  };
}

/**
 * The test I left most recently, for the "Đang làm dở" card. Answers are
 * read only to count the answered items (never sent to the page).
 */
export async function getContinueAttempt(userId: string) {
  const [row] = await db
    .select({
      id: attempts.id,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      answers: attempts.answers,
      deadlineAt: attempts.deadlineAt,
    })
    .from(attempts)
    .innerJoin(lessons, eq(lessons.id, attempts.lessonId))
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.status, "in_progress"),
        eq(attempts.mode, "test"),
      ),
    )
    .orderBy(
      desc(sql`coalesce(${attempts.lastSavedAt}, ${attempts.startedAt})`),
    )
    .limit(1);
  return row ?? null;
}

export type ContinueAttempt = NonNullable<
  Awaited<ReturnType<typeof getContinueAttempt>>
>;

// Raw `sql` columns skip Drizzle's mapping: drivers may return bigint[] as
// text (`{1,2}`) and json as a string.
function parseArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v !== "string" || v.length < 3) return [];
  return v.slice(1, -1).split(",");
}

function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  return (typeof v === "string" ? JSON.parse(v) : v) as T;
}
