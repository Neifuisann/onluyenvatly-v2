import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import {
  classes,
  classLessons,
  classMembers,
  lessons,
  users,
} from "@/db/schema";
import { type Owner, ownedBy } from "@/features/lessons/ownership";
import { writeAudit } from "@/lib/audit";
import { err, ok, type Result } from "@/lib/result";
import {
  ADD_LIMIT,
  type ClassForm,
  lessonChanges,
  type MemberChange,
  parsePhoneList,
} from "./domain/classes";
import { classesCopy as M } from "./messages";

/**
 * Class mutations (B-03). Callers check `requireTeacher()` first. Every one
 * runs in a transaction that locks the class row (another teacher's class
 * reads as NOT_FOUND; an admin reaches every class) and writes its audit
 * entry; `data` holds ids and counts only, never a phone or a name.
 */

export type Actor = Owner;

/** The classes `actor` may manage: their own; every class for an admin. */
export const classOwnedBy = (actor: Actor) =>
  actor.role === "admin" ? undefined : eq(classes.ownerId, actor.id);

/** The class, locked; null when the actor may not manage it or it doesn't exist. */
async function lockClass(tx: Tx, actor: Actor, id: number) {
  const [row] = await tx
    .select({ id: classes.id, archivedAt: classes.archivedAt })
    .from(classes)
    .where(and(eq(classes.id, id), classOwnedBy(actor)))
    .for("update")
    .limit(1);
  return row ?? null;
}

export async function createClass(
  actor: Actor,
  form: ClassForm,
  now = new Date(),
): Promise<{ id: number }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(classes)
      .values({ ownerId: actor.id, ...form, createdAt: now, updatedAt: now })
      .returning({ id: classes.id });
    if (!row) throw new Error("class insert returned no row");
    await writeAudit(tx, {
      actorId: actor.id,
      action: "class.create",
      targetType: "class",
      targetId: row.id,
    });
    return { id: row.id };
  });
}

export async function updateClass(
  actor: Actor,
  id: number,
  form: ClassForm,
  now = new Date(),
): Promise<Result<{ id: number }>> {
  return db.transaction(async (tx) => {
    if (!(await lockClass(tx, actor, id))) return err("NOT_FOUND");
    await tx
      .update(classes)
      .set({ ...form, updatedAt: now })
      .where(eq(classes.id, id));
    await writeAudit(tx, {
      actorId: actor.id,
      action: "class.update",
      targetType: "class",
      targetId: id,
    });
    return ok({ id });
  });
}

/** Archived classes are hidden from their students; nothing is deleted. */
export async function setClassArchived(
  actor: Actor,
  id: number,
  archived: boolean,
  now = new Date(),
): Promise<Result<{ id: number }>> {
  return db.transaction(async (tx) => {
    const row = await lockClass(tx, actor, id);
    if (!row) return err("NOT_FOUND");
    if (Boolean(row.archivedAt) === archived) return ok({ id });
    await tx
      .update(classes)
      .set({ archivedAt: archived ? now : null, updatedAt: now })
      .where(eq(classes.id, id));
    await writeAudit(tx, {
      actorId: actor.id,
      action: archived ? "class.archive" : "class.restore",
      targetType: "class",
      targetId: id,
    });
    return ok({ id });
  });
}

/**
 * Deletes the class with its member list and lesson list (cascade). The
 * students' accounts, attempts and ratings are untouched.
 */
export async function deleteClass(
  actor: Actor,
  id: number,
): Promise<Result<{ id: number; members: number }>> {
  return db.transaction(async (tx) => {
    if (!(await lockClass(tx, actor, id))) return err("NOT_FOUND");
    const [count] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(classMembers)
      .where(eq(classMembers.classId, id));
    await tx.delete(classes).where(eq(classes.id, id));
    const members = count?.n ?? 0;
    await writeAudit(tx, {
      actorId: actor.id,
      action: "class.delete",
      targetType: "class",
      targetId: id,
      data: { members },
    });
    return ok({ id, members });
  });
}

/**
 * "Thêm học sinh": the teacher pastes phone numbers. Each one that belongs
 * to a student account (any status but rejected) joins the class; the rest
 * are reported back so the teacher can ask those students to register.
 * Teachers and admins can't be added.
 */
export async function addMembers(
  actor: Actor,
  id: number,
  text: string,
  now = new Date(),
): Promise<Result<MemberChange>> {
  const { phones, invalid } = parsePhoneList(text);
  if (phones.length === 0 && invalid.length === 0)
    return err("VALIDATION", { fieldErrors: { phones: M.errors.noPhones } });
  if (phones.length > ADD_LIMIT)
    return err("VALIDATION", {
      fieldErrors: { phones: M.errors.tooMany(ADD_LIMIT) },
    });
  return db.transaction(async (tx) => {
    const row = await lockClass(tx, actor, id);
    if (!row) return err("NOT_FOUND");
    if (row.archivedAt) return err("CONFLICT", { message: M.errors.archived });
    const found = phones.length
      ? await tx
          .select({ id: users.id, phone: users.phone })
          .from(users)
          .where(
            and(
              inArray(users.phone, phones),
              eq(users.role, "student"),
              sql`${users.status} <> 'rejected'`,
            ),
          )
      : [];
    const byPhone = new Set(found.map((u) => u.phone));
    const inserted = found.length
      ? await tx
          .insert(classMembers)
          .values(
            found.map((u) => ({
              classId: id,
              userId: u.id,
              addedBy: actor.id,
              createdAt: now,
            })),
          )
          .onConflictDoNothing()
          .returning({ userId: classMembers.userId })
      : [];
    const change: MemberChange = {
      added: inserted.length,
      already: found.length - inserted.length,
      notFound: phones.filter((p) => !byPhone.has(p)),
      invalid,
    };
    if (inserted.length)
      await writeAudit(tx, {
        actorId: actor.id,
        action: "class.add_members",
        targetType: "class",
        targetId: id,
        data: { added: inserted.length },
      });
    return ok(change);
  });
}

/** Takes one student out of the class; their attempts stay. */
export async function removeMember(
  actor: Actor,
  id: number,
  userId: string,
): Promise<Result<{ id: number }>> {
  return db.transaction(async (tx) => {
    if (!(await lockClass(tx, actor, id))) return err("NOT_FOUND");
    const removed = await tx
      .delete(classMembers)
      .where(and(eq(classMembers.classId, id), eq(classMembers.userId, userId)))
      .returning({ userId: classMembers.userId });
    if (removed.length === 0) return err("NOT_FOUND");
    await writeAudit(tx, {
      actorId: actor.id,
      action: "class.remove_member",
      targetType: "class",
      targetId: id,
      data: { userId },
    });
    return ok({ id });
  });
}

/**
 * "Giao bài": the class's lessons become exactly `lessonIds`. Only the
 * actor's own published lessons can be given (any for an admin); lessons
 * already in the class
 * stay even if they were unpublished since (students don't see those).
 */
export async function setClassLessons(
  actor: Actor,
  id: number,
  lessonIds: readonly number[],
  now = new Date(),
): Promise<Result<{ added: number; removed: number }>> {
  return db.transaction(async (tx) => {
    const row = await lockClass(tx, actor, id);
    if (!row) return err("NOT_FOUND");
    if (row.archivedAt) return err("CONFLICT", { message: M.errors.archived });
    const current = (
      await tx
        .select({ lessonId: classLessons.lessonId })
        .from(classLessons)
        .where(eq(classLessons.classId, id))
    ).map((r) => r.lessonId);
    const { add, remove } = lessonChanges(current, lessonIds);
    if (add.length) {
      const allowed = await tx
        .select({ id: lessons.id })
        .from(lessons)
        .where(
          and(
            inArray(lessons.id, add),
            ownedBy(actor),
            eq(lessons.status, "published"),
            isNull(lessons.deletedAt),
          ),
        );
      if (allowed.length !== add.length) return err("NOT_FOUND");
      await tx
        .insert(classLessons)
        .values(
          add.map((lessonId) => ({ classId: id, lessonId, createdAt: now })),
        )
        .onConflictDoNothing();
    }
    if (remove.length)
      await tx
        .delete(classLessons)
        .where(
          and(
            eq(classLessons.classId, id),
            inArray(classLessons.lessonId, remove),
          ),
        );
    if (add.length || remove.length)
      await writeAudit(tx, {
        actorId: actor.id,
        action: "class.lessons",
        targetType: "class",
        targetId: id,
        data: { added: add, removed: remove },
      });
    return ok({ added: add.length, removed: remove.length });
  });
}
