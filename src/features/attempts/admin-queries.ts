import "server-only";
import { and, asc, desc, eq, gte, lt, type SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attempts, lessons, users } from "@/db/schema";
import type { ResultCsvRow } from "./domain/csv";
import {
  EXPORT_LIMIT,
  nameTerms,
  RESULTS_PAGE_SIZE,
  type ResultsFilters,
  submittedRange,
} from "./domain/results";

/**
 * `/admin/results` and its CSV (S6-04). Per request and uncached: only the
 * teacher reads them and a deleted attempt must disappear at once. Newest
 * first through `attempts_submitted_idx` (migration 0007, `submitted_at DESC
 * NULLS LAST WHERE status = 'submitted'`); the ORDER BY matches it exactly.
 * Students' attempts only (an admin's own tries are not results).
 */

const newestFirst = [
  sql`${attempts.submittedAt} desc nulls last`,
  desc(attempts.id),
];

function resultsWhere(f: ResultsFilters): SQL | undefined {
  const { since, before } = submittedRange(f);
  return and(
    eq(attempts.status, "submitted"),
    eq(users.role, "student"),
    f.lessonId ? eq(attempts.lessonId, f.lessonId) : undefined,
    since ? gte(attempts.submittedAt, since) : undefined,
    before ? lt(attempts.submittedAt, before) : undefined,
    // Same expression as `users_full_name_trgm_idx`.
    ...nameTerms(f.q).map(
      (w) =>
        sql`lower(immutable_unaccent(${users.fullName})) like '%' || lower(immutable_unaccent(${w})) || '%'`,
    ),
  );
}

export type ResultRow = {
  id: string;
  userId: string;
  fullName: string;
  className: string | null;
  grade: number | null;
  lessonId: number | null;
  /** null for personalized practice. */
  lessonTitle: string | null;
  score10: number | null;
  timeTakenSec: number | null;
  submittedAt: Date | null;
  guardCount: number;
};

/**
 * "Xem thêm" is cumulative: page n returns the first n × 50 attempts. One
 * extra row says whether there are more (no `count(*)` over the table).
 */
export async function getResults(
  f: ResultsFilters,
): Promise<{ rows: ResultRow[]; hasMore: boolean }> {
  const limit = f.page * RESULTS_PAGE_SIZE;
  const rows = await db
    .select({
      id: attempts.id,
      userId: attempts.userId,
      fullName: users.fullName,
      className: users.className,
      grade: users.grade,
      lessonId: attempts.lessonId,
      lessonTitle: lessons.title,
      score10: attempts.score10,
      timeTakenSec: attempts.timeTakenSec,
      submittedAt: attempts.submittedAt,
      guardCount: sql<number>`jsonb_array_length(${attempts.guardEvents})::int`,
    })
    .from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .leftJoin(lessons, eq(lessons.id, attempts.lessonId))
    .where(resultsWhere(f))
    .orderBy(...newestFirst)
    .limit(limit + 1);
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
}

/**
 * Every attempt matching the filters, newest first, up to 10,000 (the CSV).
 * Never the phone or the date of birth (06 §5).
 */
export async function getResultsForExport(
  f: ResultsFilters,
): Promise<{ rows: ResultCsvRow[]; truncated: boolean }> {
  const rows = await db
    .select({
      fullName: users.fullName,
      className: users.className,
      grade: users.grade,
      lessonTitle: lessons.title,
      score10: attempts.score10,
      score: attempts.score,
      maxScore: attempts.maxScore,
      timeTakenSec: attempts.timeTakenSec,
      submittedAt: attempts.submittedAt,
      guardCount: sql<number>`jsonb_array_length(${attempts.guardEvents})::int`,
    })
    .from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .leftJoin(lessons, eq(lessons.id, attempts.lessonId))
    .where(resultsWhere(f))
    .orderBy(...newestFirst)
    .limit(EXPORT_LIMIT + 1);
  return {
    rows: rows.slice(0, EXPORT_LIMIT),
    truncated: rows.length > EXPORT_LIMIT,
  };
}

export type ResultLessonOption = {
  id: number;
  title: string;
  deleted: boolean;
};

/** The lesson filter: every lesson (~170) in the teacher's order. */
export async function getResultLessons(): Promise<ResultLessonOption[]> {
  return db
    .select({
      id: lessons.id,
      title: lessons.title,
      deleted: sql<boolean>`${lessons.deletedAt} is not null`,
    })
    .from(lessons)
    .orderBy(asc(lessons.sortOrder), asc(lessons.id));
}
