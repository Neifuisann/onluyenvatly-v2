import "server-only";
import { and, asc, desc, eq, gte, lt, type SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attempts, lessons, users } from "@/db/schema";
import { type Owner, ownedBy } from "@/features/lessons/ownership";
import type { ResultCsvRow } from "./domain/csv";
import type { LessonStudent } from "./domain/lesson-results";
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
 * Students' attempts only (an admin's own tries are not results), on the
 * teacher's own lessons (B-03); personalized practice belongs to the student.
 */

const newestFirst = [
  sql`${attempts.submittedAt} desc nulls last`,
  desc(attempts.id),
];

function resultsWhere(owner: Owner, f: ResultsFilters): SQL | undefined {
  const { since, before } = submittedRange(f);
  return and(
    ownedBy(owner),
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
  owner: Owner,
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
    .innerJoin(lessons, eq(lessons.id, attempts.lessonId))
    .where(resultsWhere(owner, f))
    .orderBy(...newestFirst)
    .limit(limit + 1);
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
}

/**
 * Every attempt matching the filters, newest first, up to 10,000 (the CSV).
 * Never the phone or the date of birth (06 §5).
 */
export async function getResultsForExport(
  owner: Owner,
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
    .innerJoin(lessons, eq(lessons.id, attempts.lessonId))
    .where(resultsWhere(owner, f))
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

/** The lesson filter: every lesson of the teacher, in their order. */
export async function getResultLessons(
  owner: Owner,
): Promise<ResultLessonOption[]> {
  return db
    .select({
      id: lessons.id,
      title: lessons.title,
      deleted: sql<boolean>`${lessons.deletedAt} is not null`,
    })
    .from(lessons)
    .where(ownedBy(owner))
    .orderBy(asc(lessons.sortOrder), asc(lessons.id));
}

/** A class is far below this; it bounds the grouped read. */
export const LESSON_STUDENTS_LIMIT = 1000;

/**
 * `/admin/lessons/[id]/results`: one row per student who submitted the
 * lesson, with their try count, latest and best score. One grouped read
 * through `attempts_lesson_submitted_idx`; students only, as the results list.
 */
export async function getLessonStudents(
  lessonId: number,
): Promise<LessonStudent[]> {
  const latest = sql`${attempts.submittedAt} desc nulls last, ${attempts.id} desc`;
  return db
    .select({
      userId: attempts.userId,
      fullName: users.fullName,
      className: users.className,
      grade: users.grade,
      attempts: sql<number>`count(*)::int`,
      latestScore10: sql<
        number | null
      >`((array_agg(${attempts.score10} order by ${latest}))[1])::float8`,
      bestScore10: sql<number | null>`max(${attempts.score10})::float8`,
      latestTimeTakenSec: sql<
        number | null
      >`(array_agg(${attempts.timeTakenSec} order by ${latest}))[1]`,
      latestSubmittedAt: sql<Date | null>`max(${attempts.submittedAt})`.mapWith(
        attempts.submittedAt,
      ),
    })
    .from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .where(
      and(
        eq(attempts.lessonId, lessonId),
        eq(attempts.status, "submitted"),
        eq(users.role, "student"),
      ),
    )
    .groupBy(attempts.userId, users.fullName, users.className, users.grade)
    .limit(LESSON_STUDENTS_LIMIT);
}

export type LessonStudentAttempt = {
  id: string;
  status: "in_progress" | "submitted" | "expired";
  score: number | null;
  maxScore: number;
  score10: number | null;
  timeTakenSec: number | null;
  startedAt: Date;
  submittedAt: Date | null;
  guardCount: number;
};

/**
 * `/admin/lessons/[id]/results/[userId]`: the student and every try of the
 * lesson, oldest first (try 1, 2, …). Null when the student doesn't exist.
 */
export async function getLessonStudentAttempts(
  lessonId: number,
  userId: string,
): Promise<{
  student: {
    id: string;
    fullName: string;
    className: string | null;
    grade: number | null;
  };
  attempts: LessonStudentAttempt[];
} | null> {
  const [student] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      className: users.className,
      grade: users.grade,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!student) return null;
  const rows = await db
    .select({
      id: attempts.id,
      status: attempts.status,
      score: attempts.score,
      maxScore: attempts.maxScore,
      score10: attempts.score10,
      timeTakenSec: attempts.timeTakenSec,
      startedAt: attempts.startedAt,
      submittedAt: attempts.submittedAt,
      guardCount: sql<number>`jsonb_array_length(${attempts.guardEvents})::int`,
    })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.lessonId, lessonId)))
    .orderBy(asc(attempts.startedAt), asc(attempts.id));
  return { student, attempts: rows };
}
