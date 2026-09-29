import "server-only";
import { sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db/client";
import { tags } from "@/lib/cache-tags";
import {
  CHART_DAYS,
  type DayCount,
  fillDays,
  HARDEST_LIMIT,
  HARDEST_MIN_ANSWERS,
  type HardQuestion,
  type HardQuestionRow,
  rankHardest,
  sumLastDays,
  vnWindow,
  WEEK_DAYS,
} from "./domain/overview";

export type AdminOverview = {
  /** Distinct students with a submitted attempt in the last 7 Vietnam days. */
  activeStudents: number;
  attemptsToday: number;
  attemptsWeek: number;
  /** The last 30 Vietnam days, oldest first, zero-filled. */
  perDay: DayCount[];
  hardest: HardQuestion[];
};

/**
 * `/admin` (S6-06): shared-cached for 5 minutes under `adminOverview`
 * (deleting an attempt invalidates it; a submit does not). The pending count
 * comes from the nav badge's own cache.
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  "use cache";
  cacheTag(tags.adminOverview);
  cacheLife({ stale: 60, revalidate: 300, expire: 600 });
  return loadAdminOverview(new Date());
}

// postgres.js returns an array, PGlite returns { rows }.
function rowsOf(result: unknown): Record<string, unknown>[] {
  return (
    Array.isArray(result) ? result : (result as { rows: unknown[] }).rows
  ) as Record<string, unknown>[];
}

const json = <T>(v: unknown, fallback: T): T =>
  v == null
    ? fallback
    : typeof v === "string"
      ? (JSON.parse(v) as T)
      : (v as T);

/**
 * Every dashboard aggregate in ONE statement. Students' submitted attempts
 * only (an admin's own tries are not activity). Both windows are range
 * scans of `attempts_submitted_idx` (migration 0007). Hardest questions:
 * this week's lesson attempts, one row per item via
 * `jsonb_array_elements(items) WITH ORDINALITY` joined to `earned[ord]` and
 * the item's points `p` (0-point items skipped), per (lesson, question id)
 * with at least 5 answers; only the 5 kept rows look up their position in
 * the version.
 */
export async function loadAdminOverview(now: Date): Promise<AdminOverview> {
  const chart = vnWindow(now, CHART_DAYS);
  const week = vnWindow(now, WEEK_DAYS);
  const since30 = chart.since.toISOString();
  const since7 = week.since.toISOString();
  const result = await db.execute(sql`
    with recent as (
      select a.user_id, a.submitted_at
      from attempts a
      join users u on u.id = a.user_id
      where a.status = 'submitted'
        and a.submitted_at >= ${since30}::timestamptz
        and u.role = 'student'
    ), week as (
      select a.lesson_id, a.lesson_version_id, a.items, a.earned
      from attempts a
      join users u on u.id = a.user_id
      where a.status = 'submitted'
        and a.submitted_at >= ${since7}::timestamptz
        and u.role = 'student'
        and a.lesson_id is not null
        and a.earned is not null
    ), marks as (
      select w.lesson_id,
        coalesce((i.item->>'v')::bigint, w.lesson_version_id) as version_id,
        i.item->>'q' as qid,
        (i.item->>'p')::numeric as p,
        coalesce(w.earned[i.ord], 0) as earned
      from week w
      cross join lateral jsonb_array_elements(w.items) with ordinality as i(item, ord)
    ), hard as (
      select lesson_id, qid, max(version_id) as version_id,
        count(*)::int as answers,
        (count(*) filter (where earned >= p))::int as full_marks
      from marks
      where p > 0
      group by lesson_id, qid
      having count(*) >= ${HARDEST_MIN_ANSWERS}
      order by (count(*) filter (where earned >= p))::float8 / count(*),
        count(*) desc, lesson_id, qid
      limit ${HARDEST_LIMIT}
    )
    select
      (select count(distinct user_id)::int from recent
        where submitted_at >= ${since7}::timestamptz) as active,
      (select coalesce(jsonb_object_agg(day, n), '{}'::jsonb) from (
        select to_char(submitted_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as day,
          count(*)::int as n
        from recent group by 1) d) as per_day,
      (select coalesce(jsonb_agg(jsonb_build_object(
          'lessonId', h.lesson_id,
          'lessonTitle', l.title,
          'questionId', h.qid,
          'versionId', h.version_id,
          'answers', h.answers,
          'fullMarks', h.full_marks,
          'position', (
            select o.ord from lesson_versions v
            cross join lateral jsonb_array_elements(v.questions) with ordinality as o(q, ord)
            where v.id = h.version_id and o.q->>'id' = h.qid
            limit 1)
        )), '[]'::jsonb)
        from hard h join lessons l on l.id = h.lesson_id) as hardest
  `);
  const [row] = rowsOf(result);
  const perDay = fillDays(
    chart.keys,
    json<Record<string, number>>(row?.per_day, {}),
  );
  const hardest = json<Record<string, unknown>[]>(row?.hardest, []).map(
    (h): HardQuestionRow => ({
      lessonId: Number(h.lessonId),
      lessonTitle: String(h.lessonTitle ?? ""),
      questionId: String(h.questionId ?? ""),
      versionId: Number(h.versionId),
      position: h.position == null ? null : Number(h.position),
      answers: Number(h.answers),
      fullMarks: Number(h.fullMarks),
    }),
  );
  return {
    activeStudents: Number(row?.active ?? 0),
    attemptsToday: sumLastDays(perDay, 1),
    attemptsWeek: sumLastDays(perDay, WEEK_DAYS),
    perDay,
    hardest: rankHardest(hardest),
  };
}
