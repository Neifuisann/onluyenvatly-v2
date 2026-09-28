import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attempts, lessons, ratingEvents, users } from "@/db/schema";
import {
  ACCURACY_WINDOW,
  type AccuracyRow,
  HISTORY_PAGE_SIZE,
} from "./domain/profile";

/**
 * Per-user profile reads (S4-07, kind R, never shared-cached). All of them
 * start from a `(user_id, …)` index.
 */

/** Days with a submitted test kept for the streak (it can't be longer). */
const STREAK_DAYS = 400;

export type ProfileSummary = {
  className: string | null;
  rating: number | null;
  peak: number | null;
  tests: number;
  /** Average score /10 of submitted tests, null before the first. */
  average: number | null;
  /** `YYYY-MM-DD` (Vietnam time) with a submitted test, newest first. */
  activeDays: string[];
};

export async function getProfileSummary(
  userId: string,
): Promise<ProfileSummary> {
  const submitted = sql`user_id = ${userId} and status = 'submitted' and mode = 'test'`;
  const [row] = await db
    .select({
      className: users.className,
      rating: sql<
        number | null
      >`(select rating from ratings where user_id = ${userId})`,
      peak: sql<
        number | null
      >`(select peak from ratings where user_id = ${userId})`,
      tests: sql<number>`(select count(*)::int from attempts where ${submitted})`,
      average: sql<
        string | number | null
      >`(select round(avg(score10), 2) from attempts where ${submitted})`,
      activeDays: sql<unknown>`array(
        select distinct to_char(submitted_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as d
        from attempts where ${submitted}
        order by d desc limit ${STREAK_DAYS})`,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    className: row?.className ?? null,
    rating: row?.rating ?? null,
    peak: row?.peak ?? null,
    tests: row?.tests ?? 0,
    average: row?.average == null ? null : Number(row.average),
    activeDays: textArray(row?.activeDays),
  };
}

/** Rating after each change, oldest first (the latest 500). */
export async function getRatingHistory(userId: string) {
  const rows = await db
    .select({ at: ratingEvents.createdAt, rating: ratingEvents.after })
    .from(ratingEvents)
    .where(eq(ratingEvents.userId, userId))
    .orderBy(desc(ratingEvents.createdAt), desc(ratingEvents.id))
    .limit(500);
  return rows.reverse();
}

/**
 * Points earned vs available per (question type, chapter) over my latest
 * submitted tests. Items don't store their type, so it is looked up in the
 * lesson version inside the database: only the type string leaves it, never
 * a stem, option or answer (ADR-004).
 */
export async function getAccuracy(userId: string): Promise<AccuracyRow[]> {
  const result = await db.execute(sql`
    with recent as (
      select a.lesson_version_id, a.items, a.earned, l.chapter
      from attempts a
      join lessons l on l.id = a.lesson_id
      where a.user_id = ${userId} and a.status = 'submitted'
        and a.mode = 'test' and a.earned is not null
      order by a.submitted_at desc
      limit ${ACCURACY_WINDOW}
    ), marks as (
      select coalesce((i.item->>'v')::bigint, r.lesson_version_id) as version_id,
        i.item->>'q' as question_id,
        (i.item->>'p')::numeric as points,
        coalesce(r.earned[i.ord], 0) as earned,
        r.chapter
      from recent r
      cross join lateral jsonb_array_elements(r.items) with ordinality as i(item, ord)
    ), types as (
      select v.id, jsonb_object_agg(q->>'id', q->>'type') as by_id
      from lesson_versions v
      cross join lateral jsonb_array_elements(v.questions) as q
      where v.id in (select distinct version_id from marks)
      group by v.id
    )
    select t.by_id->>m.question_id as type, m.chapter,
      count(*)::int as questions,
      sum(m.earned)::float8 as earned,
      sum(m.points)::float8 as points
    from marks m
    left join types t on t.id = m.version_id
    group by 1, 2
  `);
  // postgres.js returns an array, PGlite returns { rows }.
  const rows = (
    Array.isArray(result) ? result : (result as { rows: unknown[] }).rows
  ) as Record<string, unknown>[];
  return rows.map((r) => ({
    type: (r.type as string | null) ?? null,
    chapter: (r.chapter as string | null) ?? null,
    questions: Number(r.questions),
    earned: Number(r.earned),
    points: Number(r.points),
  }));
}

/**
 * My submitted tests, newest first, with the rating change each made. One
 * row more than asked tells whether "Xem thêm" is needed.
 */
export async function getMyHistory(userId: string, page: number) {
  const limit = page * HISTORY_PAGE_SIZE;
  const rows = await db
    .select({
      id: attempts.id,
      lessonTitle: lessons.title,
      submittedAt: attempts.submittedAt,
      score10: attempts.score10,
      timeTakenSec: attempts.timeTakenSec,
      delta: ratingEvents.delta,
    })
    .from(attempts)
    .innerJoin(lessons, eq(lessons.id, attempts.lessonId))
    .leftJoin(ratingEvents, eq(ratingEvents.attemptId, attempts.id))
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.status, "submitted"),
        eq(attempts.mode, "test"),
      ),
    )
    .orderBy(desc(attempts.submittedAt), desc(attempts.id))
    .limit(limit + 1);
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

export type HistoryItem = Awaited<
  ReturnType<typeof getMyHistory>
>["items"][number];

// Raw `sql` columns skip Drizzle's mapping: a driver may return text[] as
// `{a,b}`.
function textArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v !== "string" || v.length < 3) return [];
  return v.slice(1, -1).split(",");
}
