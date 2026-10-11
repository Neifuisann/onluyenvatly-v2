/**
 * Class fixtures for integration tests (B-03). Since lessons belong to a
 * teacher and students reach them only through a class, most tests that
 * start attempts need a lesson owner, a class and its members. These keep
 * that one call away:
 *
 *   await shareLesson(tdb, lessonId, teacherId); // owner + class + every student
 *   await enrol(tdb, laterStudentId);           // into every class
 */
import { and, eq } from "drizzle-orm";
import {
  classes,
  classLessons,
  classMembers,
  lessons,
  users,
} from "@/db/schema";
import type { TestDb } from "./db";

/** The owner's test class, created on first use. */
export async function classFor(db: TestDb, ownerId: string): Promise<number> {
  const [found] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.ownerId, ownerId), eq(classes.name, "Lớp test")))
    .limit(1);
  if (found) return found.id;
  const [row] = await db
    .insert(classes)
    .values({ ownerId, name: "Lớp test" })
    .returning({ id: classes.id });
  if (!row) throw new Error("class insert failed");
  return row.id;
}

/**
 * Makes `ownerId` the lesson's owner, gives the lesson to their test class
 * and puts every student that exists now in that class.
 */
export async function shareLesson(
  db: TestDb,
  lessonId: number,
  ownerId: string,
): Promise<number> {
  await db.update(lessons).set({ ownerId }).where(eq(lessons.id, lessonId));
  const classId = await classFor(db, ownerId);
  await db
    .insert(classLessons)
    .values({ classId, lessonId })
    .onConflictDoNothing();
  const students = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "student"));
  if (students.length)
    await db
      .insert(classMembers)
      .values(students.map((s) => ({ classId, userId: s.id })))
      .onConflictDoNothing();
  return classId;
}

/** Puts a student in every class (for students created after the lessons). */
export async function enrol(db: TestDb, userId: string): Promise<void> {
  const all = await db.select({ id: classes.id }).from(classes);
  if (all.length)
    await db
      .insert(classMembers)
      .values(all.map((c) => ({ classId: c.id, userId })))
      .onConflictDoNothing();
}
