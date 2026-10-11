import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  like,
  type SQL,
  sql,
} from "drizzle-orm";
import { db } from "@/db/client";
import {
  attemptOverrides,
  attempts,
  classes,
  classMembers,
  lessons,
  ratings,
  sessions,
  users,
} from "@/db/schema";
import type { Role } from "@/features/auth/core/login-policy";
import { ownedBy } from "@/features/lessons/ownership";
import {
  BULK_LIMIT,
  PAGE_SIZE,
  parseSearch,
  type StudentListFilters,
  type StudentStatus,
} from "./domain/list";

/**
 * Student admin reads (S6-01). Per request and uncached: only staff use them
 * and they must show a decision as soon as it is made. B-03: a teacher sees
 * the students of their own classes and, of each, only what happened on
 * their own lessons; an admin sees every student account (platform
 * management: passwords, sessions, deletion).
 */

const isStudent = eq(users.role, "student");

export type Viewer = { id: string; role: Role };

/** A student the viewer may see: any for an admin, their classes' for a teacher. */
export function visibleTo(viewer: Viewer): SQL | undefined {
  if (viewer.role === "admin") return undefined;
  return sql`exists (select 1 from ${classMembers} inner join ${classes} on ${classes.id} = ${classMembers.classId} where ${classMembers.userId} = ${users.id} and ${classes.ownerId} = ${viewer.id})`;
}

/**
 * Attempts the viewer may see: a teacher, those on their own lessons
 * (personalized practice stays the student's); an admin, every attempt.
 */
const attemptsVisibleTo = (viewer: Viewer): SQL | undefined =>
  viewer.role === "admin"
    ? undefined
    : sql`exists (select 1 from ${lessons} where ${lessons.id} = ${attempts.lessonId} and ${ownedBy(viewer)})`;

/**
 * Students who asked to delete their account (S8-04, 06 §5), oldest request
 * first. Served by the partial `users_deletion_requested_idx`.
 */
export async function getDeletionRequests(): Promise<
  Array<{
    id: string;
    fullName: string;
    className: string | null;
    requestedAt: Date;
  }>
> {
  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      className: users.className,
      requestedAt: users.deletionRequestedAt,
    })
    .from(users)
    .where(and(isStudent, isNotNull(users.deletionRequestedAt)))
    .orderBy(asc(users.deletionRequestedAt))
    .limit(BULK_LIMIT);
  return rows.flatMap((r) =>
    r.requestedAt ? [{ ...r, requestedAt: r.requestedAt }] : [],
  );
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

function listWhere(viewer: Viewer, f: StudentListFilters): SQL | undefined {
  const search = parseSearch(f.q);
  return and(
    isStudent,
    visibleTo(viewer),
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
 * The student list. "Xem thêm" is cumulative: page n returns the first
 * n × 50 students, in accent-free name order.
 */
export async function getStudents(
  viewer: Viewer,
  f: StudentListFilters,
): Promise<{ rows: StudentListRow[]; total: number }> {
  const where = listWhere(viewer, f);
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
  /** The student asked to delete the account (S8-04); "Xóa" completes it. */
  deletionRequestedAt: Date | null;
  rating: { rating: number; peak: number; ratedAttempts: number } | null;
  /** Submitted attempts in all (the list below shows the latest 50). */
  attemptTotal: number;
};

/**
 * A student's profile; null for a missing id, a staff account, or (for a
 * teacher) a student in none of their classes. `attemptTotal` counts the
 * attempts the viewer may see.
 */
export async function getStudentDetail(
  viewer: Viewer,
  id: string,
): Promise<StudentDetail | null> {
  const mine = attemptsVisibleTo(viewer);
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
      deletionRequestedAt: users.deletionRequestedAt,
      rating: ratings.rating,
      peak: ratings.peak,
      ratedAttempts: ratings.ratedAttempts,
      attemptTotal: sql<number>`(select count(*)::int from ${attempts} where ${attempts.userId} = ${users.id} and ${attempts.status} = 'submitted'${mine ? sql` and ${mine}` : sql``})`,
    })
    .from(users)
    .leftJoin(ratings, eq(ratings.userId, users.id))
    .where(and(eq(users.id, id), isStudent, visibleTo(viewer)))
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

/**
 * Latest submitted attempts (`attempts_user_submitted_idx`) the viewer may
 * see. Call after `getStudentDetail`.
 */
export async function getStudentAttempts(
  viewer: Viewer,
  userId: string,
): Promise<StudentAttemptRow[]> {
  const mine = attemptsVisibleTo(viewer);
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
    .where(
      and(eq(attempts.userId, userId), eq(attempts.status, "submitted"), mine),
    )
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

/** Extra tries on the viewer's own lessons. */
export async function getStudentOverrides(
  viewer: Viewer,
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
    .where(and(eq(attemptOverrides.userId, userId), ownedBy(viewer)))
    .orderBy(asc(lessons.title));
}

export type GrantableLesson = {
  id: number;
  title: string;
  /** The student has submitted an attempt on it. */
  attempted: boolean;
};

/** The viewer's lessons not deleted, those the student took listed first. */
export async function getGrantableLessons(
  viewer: Viewer,
  userId: string,
): Promise<GrantableLesson[]> {
  return db
    .select({
      id: lessons.id,
      title: lessons.title,
      attempted: sql<boolean>`exists (select 1 from attempts a where a.user_id = ${userId} and a.lesson_id = lessons.id and a.status = 'submitted')`,
    })
    .from(lessons)
    .where(and(ownedBy(viewer), isNull(lessons.deletedAt)))
    .orderBy(asc(lessons.sortOrder), asc(lessons.id));
}
