import "server-only";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import { db, type Executor } from "@/db/client";
import { lessons } from "@/db/schema";
import type { Role } from "@/features/auth/core/login-policy";

/**
 * Lesson ownership (B-03). A teacher sees and manages only the lessons they
 * own: lists filter with `ownedBy`, and every action on one lesson goes
 * through `ownsLesson` (or carries `ownedBy` in its own WHERE). An admin
 * runs the platform and reaches every lesson, as before B-03. Another
 * teacher's lesson reads as NOT_FOUND, never FORBIDDEN, so ids don't leak
 * whether a lesson exists.
 */

export type Owner = { id: string; role: Role };

/** The lessons `owner` may manage: their own; every lesson for an admin. */
export const ownedBy = (owner: Owner): SQL | undefined =>
  owner.role === "admin" ? undefined : eq(lessons.ownerId, owner.id);

/** The lesson exists, is not deleted and `owner` may manage it. */
export async function ownsLesson(
  owner: Owner,
  lessonId: number,
  ex: Executor = db,
): Promise<boolean> {
  const [row] = await ex
    .select({ id: lessons.id })
    .from(lessons)
    .where(
      and(eq(lessons.id, lessonId), ownedBy(owner), isNull(lessons.deletedAt)),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * The user teaches the lesson, in any state, deleted included: the attempts
 * students made on it are theirs to review (result page, guard timeline,
 * "Xóa bài làm", explanations). An admin reviews any attempt; personalized
 * practice (no lesson) is otherwise the student's alone.
 */
export async function teachesLesson(
  user: Owner,
  lessonId: number | null,
  ex: Executor = db,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role === "student" || lessonId === null) return false;
  const [row] = await ex
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), ownedBy(user)))
    .limit(1);
  return Boolean(row);
}
