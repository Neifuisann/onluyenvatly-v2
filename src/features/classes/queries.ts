import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import {
  classes,
  classLessons,
  classMembers,
  lessons,
  users,
} from "@/db/schema";
import type { Role } from "@/features/auth/core/login-policy";
import type { Owner } from "@/features/lessons/ownership";

/** The classes `owner` may manage: their own; every class for an admin. */
const managedBy = (owner: Owner) =>
  owner.role === "admin" ? undefined : eq(classes.ownerId, owner.id);

/**
 * Class reads (B-03). Per request and uncached: memberships are per-user
 * data (never in the shared cache, 14 §4), and a teacher must see a change
 * at once. The class lesson catalog itself is shared per class
 * (`lessons/queries.ts` `getCatalog`).
 */

/** Only `active` members are in a class; `pending` ones wait for the teacher. */
const isActive = eq(classMembers.status, "active");
const memberCount = sql<number>`(select count(*)::int from ${classMembers} where ${classMembers.classId} = ${classes.id} and ${classMembers.status} = 'active')`;
const requestCount = sql<number>`(select count(*)::int from ${classMembers} where ${classMembers.classId} = ${classes.id} and ${classMembers.status} = 'pending')`;
const lessonCount = sql<number>`(select count(*)::int from ${classLessons} where ${classLessons.classId} = ${classes.id})`;
/** What students of the class see: published lessons only. */
const publishedLessonCount = sql<number>`(select count(*)::int from ${classLessons} join ${lessons} on ${lessons.id} = ${classLessons.lessonId} where ${classLessons.classId} = ${classes.id} and ${lessons.status} = 'published')`;

export type TeacherClassRow = {
  id: number;
  name: string;
  /** The class's teacher (an admin's list holds every teacher's classes). */
  ownerId: string;
  ownerName: string;
  subject: string;
  grade: number | null;
  description: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  members: number;
  /** Students who asked through the invite link and wait for approval. */
  requests: number;
  lessons: number;
};

/**
 * The teacher's classes, newest first (`classes_owner_created_idx`); every
 * class for an admin.
 */
export async function getTeacherClasses(
  owner: Owner,
): Promise<TeacherClassRow[]> {
  return db
    .select({
      id: classes.id,
      name: classes.name,
      ownerId: classes.ownerId,
      ownerName: users.fullName,
      subject: classes.subject,
      grade: classes.grade,
      description: classes.description,
      archivedAt: classes.archivedAt,
      createdAt: classes.createdAt,
      members: memberCount,
      requests: requestCount,
      lessons: lessonCount,
    })
    .from(classes)
    .innerJoin(users, eq(users.id, classes.ownerId))
    .where(managedBy(owner))
    .orderBy(desc(classes.createdAt), desc(classes.id))
    .limit(500);
}

/** Distinct students across the teacher's classes (the dashboard tile). */
export async function countTeacherStudents(owner: Owner): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${classMembers.userId})::int` })
    .from(classMembers)
    .innerJoin(classes, eq(classes.id, classMembers.classId))
    .where(and(managedBy(owner), isActive));
  return row?.n ?? 0;
}

/** One of the teacher's classes (any for an admin); null for another teacher's. */
export async function getTeacherClass(owner: Owner, id: number) {
  const [row] = await db
    .select({
      id: classes.id,
      name: classes.name,
      ownerId: classes.ownerId,
      subject: classes.subject,
      grade: classes.grade,
      description: classes.description,
      joinCode: classes.joinCode,
      archivedAt: classes.archivedAt,
    })
    .from(classes)
    .where(and(eq(classes.id, id), managedBy(owner)))
    .limit(1);
  return row ?? null;
}

export type TeacherClass = NonNullable<
  Awaited<ReturnType<typeof getTeacherClass>>
>;

export type ClassMemberRow = {
  userId: string;
  fullName: string;
  phone: string | null;
  grade: number | null;
  className: string | null;
  status: "pending" | "active" | "rejected" | "disabled";
  /** True for a request from the invite link the teacher hasn't answered. */
  requested: boolean;
  addedAt: Date;
};

/**
 * A class's students and requests in accent-free name order. Call after the
 * owner check.
 */
export async function getClassMembers(
  classId: number,
): Promise<ClassMemberRow[]> {
  return db
    .select({
      userId: users.id,
      fullName: users.fullName,
      phone: users.phone,
      grade: users.grade,
      className: users.className,
      status: users.status,
      requested: sql<boolean>`${classMembers.status} = 'pending'`,
      addedAt: classMembers.createdAt,
    })
    .from(classMembers)
    .innerJoin(users, eq(users.id, classMembers.userId))
    .where(eq(classMembers.classId, classId))
    .orderBy(sql`lower(immutable_unaccent(${users.fullName}))`, asc(users.id));
}

/** The ids of the lessons given to a class. Call after the owner check. */
export async function getClassLessonIds(classId: number): Promise<number[]> {
  const rows = await db
    .select({ lessonId: classLessons.lessonId })
    .from(classLessons)
    .where(eq(classLessons.classId, classId));
  return rows.map((r) => r.lessonId);
}

export type StudentClassRow = {
  id: number;
  name: string;
  subject: string;
  grade: number | null;
  description: string | null;
  teacherName: string;
  lessons: number;
};

const studentClassColumns = {
  id: classes.id,
  name: classes.name,
  subject: classes.subject,
  grade: classes.grade,
  description: classes.description,
  teacherName: users.fullName,
  lessons: publishedLessonCount,
};

/**
 * The classes a student is in and can open (not archived), by name
 * (`class_members_user_idx`). Deduplicated per request.
 */
export const getStudentClasses = cache(
  async (userId: string): Promise<StudentClassRow[]> =>
    db
      .select(studentClassColumns)
      .from(classMembers)
      .innerJoin(classes, eq(classes.id, classMembers.classId))
      .innerJoin(users, eq(users.id, classes.ownerId))
      .where(
        and(
          eq(classMembers.userId, userId),
          isActive,
          isNull(classes.archivedAt),
        ),
      )
      .orderBy(
        sql`lower(immutable_unaccent(${classes.name}))`,
        asc(classes.id),
      ),
);

/** One class of the student's; null when they aren't in it or it's archived. */
export const getStudentClass = cache(
  async (userId: string, classId: number): Promise<StudentClassRow | null> => {
    const [row] = await db
      .select(studentClassColumns)
      .from(classMembers)
      .innerJoin(classes, eq(classes.id, classMembers.classId))
      .innerJoin(users, eq(users.id, classes.ownerId))
      .where(
        and(
          eq(classMembers.userId, userId),
          eq(classMembers.classId, classId),
          isActive,
          isNull(classes.archivedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  },
);

/**
 * May this user open (and start) this lesson? (B-03, 06 §2.) A student: the
 * lesson is given to a class they are in that isn't archived. A teacher:
 * they own it. An admin: any lesson. Publication status is checked by the
 * caller. One
 * indexed read, deduplicated per request (arguments are primitives so
 * React's `cache` matches them).
 */
export const canOpenLesson = cache(
  async (userId: string, role: Role, lessonId: number): Promise<boolean> => {
    if (role !== "student") {
      const [row] = await db
        .select({ one: sql<number>`1` })
        .from(lessons)
        .where(
          and(
            eq(lessons.id, lessonId),
            role === "admin" ? undefined : eq(lessons.ownerId, userId),
          ),
        )
        .limit(1);
      return Boolean(row);
    }
    const [row] = await db
      .select({ one: sql<number>`1` })
      .from(classLessons)
      .innerJoin(
        classMembers,
        and(
          eq(classMembers.classId, classLessons.classId),
          eq(classMembers.userId, userId),
          isActive,
        ),
      )
      .innerJoin(classes, eq(classes.id, classLessons.classId))
      .where(
        and(eq(classLessons.lessonId, lessonId), isNull(classes.archivedAt)),
      )
      .limit(1);
    return Boolean(row);
  },
);

/**
 * The teacher's open classes for "Chia sẻ" on a lesson, newest first
 * (`classes_owner_created_idx`). An admin gets every open class, each
 * other teacher's labelled with that teacher's name.
 */
export async function getShareClasses(
  owner: Owner,
): Promise<{ id: number; name: string }[]> {
  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      ownerId: classes.ownerId,
      ownerName: users.fullName,
    })
    .from(classes)
    .innerJoin(users, eq(users.id, classes.ownerId))
    .where(and(managedBy(owner), isNull(classes.archivedAt)))
    .orderBy(desc(classes.createdAt), desc(classes.id))
    .limit(500);
  return rows.map((r) => ({
    id: r.id,
    name: r.ownerId === owner.id ? r.name : `${r.name} · ${r.ownerName}`,
  }));
}

export type JoinTarget = {
  id: number;
  name: string;
  subject: string;
  grade: number | null;
  teacherName: string;
  /** The signed-in student's membership: in, asked and waiting, or none. */
  membership: "active" | "pending" | null;
  /** The class has the lesson the link points at (false without one). */
  hasLesson: boolean;
};

/**
 * What `/join/<code>` shows: the open class behind the code
 * (`classes_join_code_uq`), with the visitor's membership (or request) and whether the
 * linked lesson is in it, in one read. Null for an unknown or archived class.
 */
export async function getJoinTarget(
  code: string,
  userId: string,
  lessonId?: number,
): Promise<JoinTarget | null> {
  const [row] = await db
    .select({
      id: classes.id,
      name: classes.name,
      subject: classes.subject,
      grade: classes.grade,
      teacherName: users.fullName,
      membership: sql<
        "active" | "pending" | null
      >`(select ${classMembers.status} from ${classMembers} where ${classMembers.classId} = ${classes.id} and ${classMembers.userId} = ${userId})`,
      hasLesson: lessonId
        ? sql<boolean>`exists (select 1 from ${classLessons} where ${classLessons.classId} = ${classes.id} and ${classLessons.lessonId} = ${lessonId})`
        : sql<boolean>`false`,
    })
    .from(classes)
    .innerJoin(users, eq(users.id, classes.ownerId))
    .where(and(eq(classes.joinCode, code), isNull(classes.archivedAt)))
    .limit(1);
  return row ?? null;
}
