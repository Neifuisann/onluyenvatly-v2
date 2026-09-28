import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  isNull,
  like,
  type SQL,
  sql,
} from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db/client";
import {
  attemptOverrides,
  attempts,
  lessons,
  ratings,
  sessions,
  users,
} from "@/db/schema";
import { tags } from "@/lib/cache-tags";
import {
  BULK_LIMIT,
  PAGE_SIZE,
  parseSearch,
  type StudentListFilters,
  type StudentStatus,
} from "./domain/list";

/**
 * Student admin reads (S6-01). Per request and uncached: only the teacher
 * uses them and they must show a decision as soon as it is made. The one
 * exception is the pending count behind the nav badge.
 */

const isStudent = eq(users.role, "student");

/** Students waiting for approval: the nav badge, on every admin page. */
export async function getPendingCount(): Promise<number> {
  "use cache";
  cacheTag(tags.pendingStudents);
  cacheLife("hours");
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(and(isStudent, eq(users.status, "pending")));
  return row?.n ?? 0;
}

export type PendingStudentRow = {
  id: string;
  fullName: string;
  phone: string | null;
  dateOfBirth: string | null;
  grade: number | null;
  className: string | null;
  createdAt: Date;
};

/** Oldest first (filtered by `users_pending_idx`); one extra row tells "more". */
export async function getPendingStudents(): Promise<{
  rows: PendingStudentRow[];
  hasMore: boolean;
}> {
  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      phone: users.phone,
      dateOfBirth: users.dateOfBirth,
      grade: users.grade,
      className: users.className,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(isStudent, eq(users.status, "pending")))
    .orderBy(asc(users.createdAt), asc(users.id))
    .limit(BULK_LIMIT + 1);
  return { rows: rows.slice(0, BULK_LIMIT), hasMore: rows.length > BULK_LIMIT };
}

export type StudentListRow = {
  id: string;
  fullName: string;
  phone: string | null;
  grade: number | null;
  className: string | null;
  status: StudentStatus;
  lastLoginAt: Date | null;
  rating: number | null;
};

function listWhere(f: StudentListFilters): SQL | undefined {
  const search = parseSearch(f.q);
  return and(
    isStudent,
    f.status ? eq(users.status, f.status) : undefined,
    f.grade ? eq(users.grade, f.grade) : undefined,
    search?.kind === "phone"
      ? like(users.phone, `${search.prefix}%`)
      : undefined,
    // Same expression as `users_full_name_trgm_idx`, so the index serves it.
    ...(search?.kind === "name"
      ? search.terms.map(
          (w) =>
            sql`lower(immutable_unaccent(${users.fullName})) like '%' || lower(immutable_unaccent(${w})) || '%'`,
        )
      : []),
  );
}

/**
 * The "Tất cả" tab. "Xem thêm" is cumulative: page n returns the first
 * n × 50 students, in accent-free name order.
 */
export async function getStudents(
  f: StudentListFilters,
): Promise<{ rows: StudentListRow[]; total: number }> {
  const where = listWhere(f);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        grade: users.grade,
        className: users.className,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        rating: ratings.rating,
      })
      .from(users)
      .leftJoin(ratings, eq(ratings.userId, users.id))
      .where(where)
      .orderBy(sql`lower(immutable_unaccent(${users.fullName}))`, asc(users.id))
      .limit(f.page * PAGE_SIZE),
    db.select({ n: count() }).from(users).where(where),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export type StudentDetail = {
  id: string;
  fullName: string;
  phone: string | null;
  dateOfBirth: string | null;
  grade: number | null;
  className: string | null;
  status: StudentStatus;
  mustChangePassword: boolean;
  createdAt: Date;
  approvedAt: Date | null;
  lastLoginAt: Date | null;
  rating: { rating: number; peak: number; ratedAttempts: number } | null;
  /** Submitted attempts in all (the list below shows the latest 50). */
  attemptTotal: number;
};

/** A student's profile; null for a missing id or an admin's. */
export async function getStudentDetail(
  id: string,
): Promise<StudentDetail | null> {
  const [row] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      phone: users.phone,
      dateOfBirth: users.dateOfBirth,
      grade: users.grade,
      className: users.className,
      status: users.status,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
      approvedAt: users.approvedAt,
      lastLoginAt: users.lastLoginAt,
      rating: ratings.rating,
      peak: ratings.peak,
      ratedAttempts: ratings.ratedAttempts,
      attemptTotal: sql<number>`(select count(*)::int from ${attempts} where ${attempts.userId} = ${users.id} and ${attempts.status} = 'submitted')`,
    })
    .from(users)
    .leftJoin(ratings, eq(ratings.userId, users.id))
    .where(and(eq(users.id, id), isStudent))
    .limit(1);
  if (!row) return null;
  const { rating, peak, ratedAttempts, ...profile } = row;
  return {
    ...profile,
    rating:
      rating === null
        ? null
        : { rating, peak: peak ?? rating, ratedAttempts: ratedAttempts ?? 0 },
  };
}

export type StudentAttemptRow = {
  id: string;
  /** null for personalized practice. */
  lessonTitle: string | null;
  mode: "test" | "practice" | "review";
  score10: number | null;
  submittedAt: Date | null;
};

export const STUDENT_ATTEMPTS_LIMIT = 50;

/** Latest submitted attempts (`attempts_user_submitted_idx`). */
export async function getStudentAttempts(
  userId: string,
): Promise<StudentAttemptRow[]> {
  return db
    .select({
      id: attempts.id,
      lessonTitle: lessons.title,
      mode: attempts.mode,
      score10: attempts.score10,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .leftJoin(lessons, eq(lessons.id, attempts.lessonId))
    .where(and(eq(attempts.userId, userId), eq(attempts.status, "submitted")))
    .orderBy(desc(attempts.submittedAt))
    .limit(STUDENT_ATTEMPTS_LIMIT);
}

export type StudentSessionRow = {
  createdAt: Date;
  lastSeenAt: Date;
  ip: string | null;
  userAgent: string | null;
};

/** Sessions that haven't expired (the session id itself never leaves the DB). */
export async function getStudentSessions(
  userId: string,
  now = new Date(),
): Promise<StudentSessionRow[]> {
  return db
    .select({
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      ip: sessions.ip,
      userAgent: sessions.userAgent,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.lastSeenAt))
    .limit(20);
}

export type StudentOverrideRow = {
  lessonId: number;
  lessonTitle: string;
  extraAttempts: number;
};

export async function getStudentOverrides(
  userId: string,
): Promise<StudentOverrideRow[]> {
  return db
    .select({
      lessonId: attemptOverrides.lessonId,
      lessonTitle: lessons.title,
      extraAttempts: attemptOverrides.extraAttempts,
    })
    .from(attemptOverrides)
    .innerJoin(lessons, eq(lessons.id, attemptOverrides.lessonId))
    .where(eq(attemptOverrides.userId, userId))
    .orderBy(asc(lessons.title));
}

export type GrantableLesson = {
  id: number;
  title: string;
  /** The student has submitted an attempt on it. */
  attempted: boolean;
};

/** Every lesson not deleted (~170), those the student took listed first. */
export async function getGrantableLessons(
  userId: string,
): Promise<GrantableLesson[]> {
  return db
    .select({
      id: lessons.id,
      title: lessons.title,
      attempted: sql<boolean>`exists (select 1 from attempts a where a.user_id = ${userId} and a.lesson_id = lessons.id and a.status = 'submitted')`,
    })
    .from(lessons)
    .where(isNull(lessons.deletedAt))
    .orderBy(asc(lessons.sortOrder), asc(lessons.id));
}
