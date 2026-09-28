import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attemptOverrides,
  attempts,
  lessons,
  sessions,
  users,
} from "@/db/schema";
import { hashPassword } from "@/features/auth/core/password";
import { writeAudit, writeAuditMany } from "@/lib/audit";
import { fieldMessages } from "@/lib/messages";
import { err, ok, type Result } from "@/lib/result";
import type { CreateAdminInput } from "./domain/input";
import { namesMatch } from "./domain/input";
import type { StudentStatus } from "./domain/list";
import { generateTempPassword, type RandomInt } from "./domain/temp-password";
import { canSetStatus } from "./domain/transitions";
import { studentsCopy } from "./messages";

/**
 * Student and admin-account mutations (S6-01/02, 05 §2
 * `features/students/admin-actions.ts`). Each one writes its audit entry in
 * the same transaction. Callers check `requireAdmin()` first; on top of that
 * every function only touches `role = 'student'` rows (except `createAdmin`),
 * so an admin can never act on their own account. Audit `data` holds ids and
 * counts only: never a name, a phone or a password.
 */

export type Actor = { id: string };

const isStudent = eq(users.role, "student");

/** Belt and braces: an admin is never a `role = student` row anyway. */
const ownAccount = () => err("FORBIDDEN", { message: studentsCopy.ownAccount });

/** Pending → active. Others (already decided) are skipped and counted. */
export async function approveStudents(
  actor: Actor,
  ids: readonly string[],
  now = new Date(),
): Promise<Result<{ done: number; skipped: number }>> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(users)
      .set({
        status: "active",
        approvedAt: now,
        approvedBy: actor.id,
        updatedAt: now,
      })
      .where(
        and(
          inArray(users.id, [...ids]),
          isStudent,
          eq(users.status, "pending"),
        ),
      )
      .returning({ id: users.id });
    await writeAuditMany(
      tx,
      rows.map((r) => ({
        actorId: actor.id,
        action: "student.approve",
        targetType: "user",
        targetId: r.id,
      })),
    );
    return ok({ done: rows.length, skipped: ids.length - rows.length });
  });
}

/** Pending → rejected. Others are skipped and counted. */
export async function rejectStudents(
  actor: Actor,
  ids: readonly string[],
  now = new Date(),
): Promise<Result<{ done: number; skipped: number }>> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(users)
      .set({ status: "rejected", updatedAt: now })
      .where(
        and(
          inArray(users.id, [...ids]),
          isStudent,
          eq(users.status, "pending"),
        ),
      )
      .returning({ id: users.id });
    await writeAuditMany(
      tx,
      rows.map((r) => ({
        actorId: actor.id,
        action: "student.reject",
        targetType: "user",
        targetId: r.id,
      })),
    );
    return ok({ done: rows.length, skipped: ids.length - rows.length });
  });
}

/**
 * New temporary password (returned once, never stored or logged in clear),
 * `must_change_password` set, every session of the student revoked.
 */
export async function resetStudentPassword(
  actor: Actor,
  id: string,
  random: RandomInt = randomInt,
  now = new Date(),
): Promise<Result<{ password: string }>> {
  if (id === actor.id) return ownAccount();
  const [student] = await db
    .select({ phone: users.phone })
    .from(users)
    .where(and(eq(users.id, id), isStudent))
    .limit(1);
  if (!student) return err("NOT_FOUND");
  const password = generateTempPassword(random, student.phone);
  // bcrypt is slow: hash before the transaction opens.
  const passwordHash = await hashPassword(password);
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: true, updatedAt: now })
      .where(and(eq(users.id, id), isStudent))
      .returning({ id: users.id });
    if (updated.length === 0) return err("NOT_FOUND");
    const revoked = await tx
      .delete(sessions)
      .where(eq(sessions.userId, id))
      .returning({ id: sessions.id });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "student.reset_password",
      targetType: "user",
      targetId: id,
      data: { revokedSessions: revoked.length },
    });
    return ok({ password });
  });
}

/** Logs the student out everywhere. */
export async function revokeStudentSessions(
  actor: Actor,
  id: string,
): Promise<Result<{ revoked: number }>> {
  if (id === actor.id) return ownAccount();
  return db.transaction(async (tx) => {
    const [student] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), isStudent))
      .limit(1);
    if (!student) return err("NOT_FOUND");
    const revoked = await tx
      .delete(sessions)
      .where(eq(sessions.userId, id))
      .returning({ id: sessions.id });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "student.revoke_sessions",
      targetType: "user",
      targetId: id,
      data: { count: revoked.length },
    });
    return ok({ revoked: revoked.length });
  });
}

/** Disable (also logs the student out) or re-enable an account. */
export async function setStudentStatus(
  actor: Actor,
  id: string,
  status: "active" | "disabled",
  now = new Date(),
): Promise<Result<{ status: StudentStatus }>> {
  if (id === actor.id) return ownAccount();
  return db.transaction(async (tx) => {
    const [student] = await tx
      .select({ status: users.status, approvedAt: users.approvedAt })
      .from(users)
      .where(and(eq(users.id, id), isStudent))
      .for("update")
      .limit(1);
    if (!student) return err("NOT_FOUND");
    if (!canSetStatus(student.status, status))
      return err("CONFLICT", { message: studentsCopy.statusUnchanged });
    await tx
      .update(users)
      .set({
        status,
        updatedAt: now,
        // A rejected student enabled later is approved from now on.
        ...(status === "active" &&
          !student.approvedAt && { approvedAt: now, approvedBy: actor.id }),
      })
      .where(eq(users.id, id));
    let revoked = 0;
    if (status === "disabled")
      revoked = (
        await tx
          .delete(sessions)
          .where(eq(sessions.userId, id))
          .returning({ id: sessions.id })
      ).length;
    await writeAudit(tx, {
      actorId: actor.id,
      action: status === "disabled" ? "student.disable" : "student.enable",
      targetType: "user",
      targetId: id,
      data: { from: student.status, revokedSessions: revoked },
    });
    return ok({ status });
  });
}

/**
 * Deletes the student and everything of theirs (attempts, ratings, rating
 * events, mistakes, sessions, overrides cascade). The lessons they had
 * submitted attempts on get their `attempt_count` recomputed in the same
 * transaction. `confirmName` must match the student's name.
 */
export async function deleteStudent(
  actor: Actor,
  id: string,
  confirmName: string,
): Promise<Result<{ attempts: number; lessons: number }>> {
  if (id === actor.id) return ownAccount();
  return db.transaction(async (tx) => {
    const [student] = await tx
      .select({ fullName: users.fullName })
      .from(users)
      .where(and(eq(users.id, id), isStudent))
      .for("update")
      .limit(1);
    if (!student) return err("NOT_FOUND");
    if (!namesMatch(confirmName, student.fullName))
      return err("VALIDATION", {
        fieldErrors: { confirmName: studentsCopy.confirmNameMismatch },
      });

    const [total] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(attempts)
      .where(eq(attempts.userId, id));
    const affected = await tx
      .selectDistinct({ lessonId: attempts.lessonId })
      .from(attempts)
      .where(and(eq(attempts.userId, id), eq(attempts.status, "submitted")));
    const lessonIds = affected.flatMap((r) =>
      r.lessonId === null ? [] : [r.lessonId],
    );

    await tx.delete(users).where(eq(users.id, id));

    if (lessonIds.length > 0)
      await tx
        .update(lessons)
        .set({
          attemptCount: sql`(select count(*)::int from attempts a where a.lesson_id = lessons.id and a.status = 'submitted')`,
        })
        .where(inArray(lessons.id, lessonIds));

    const counts = { attempts: total?.n ?? 0, lessons: lessonIds.length };
    await writeAudit(tx, {
      actorId: actor.id,
      action: "student.delete",
      targetType: "user",
      targetId: id,
      data: counts,
    });
    return ok(counts);
  });
}

/**
 * Sets the extra tries a student has on one lesson (`extra` 1–100), or
 * removes the grant with 0. A grant replaces the previous one.
 */
export async function grantExtraAttempts(
  actor: Actor,
  input: { userId: string; lessonId: number; extra: number },
  now = new Date(),
): Promise<Result<{ extra: number }>> {
  const { userId, lessonId, extra } = input;
  if (userId === actor.id) return ownAccount();
  return db.transaction(async (tx) => {
    const [student] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), isStudent))
      .limit(1);
    if (!student) return err("NOT_FOUND");
    const [lesson] = await tx
      .select({ id: lessons.id })
      .from(lessons)
      .where(and(eq(lessons.id, lessonId), sql`${lessons.deletedAt} is null`))
      .limit(1);
    if (!lesson) return err("NOT_FOUND");

    if (extra === 0)
      await tx
        .delete(attemptOverrides)
        .where(
          and(
            eq(attemptOverrides.userId, userId),
            eq(attemptOverrides.lessonId, lessonId),
          ),
        );
    else
      await tx
        .insert(attemptOverrides)
        .values({
          userId,
          lessonId,
          extraAttempts: extra,
          grantedBy: actor.id,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [attemptOverrides.userId, attemptOverrides.lessonId],
          set: { extraAttempts: extra, grantedBy: actor.id, createdAt: now },
        });
    await writeAudit(tx, {
      actorId: actor.id,
      action:
        extra === 0 ? "student.revoke_attempts" : "student.grant_attempts",
      targetType: "user",
      targetId: userId,
      data: { lessonId, extra },
    });
    return ok({ extra });
  });
}

/** A new admin account (S6-03 puts the form on `/admin/settings`). */
export async function createAdmin(
  actor: Actor,
  input: CreateAdminInput,
  now = new Date(),
): Promise<Result<{ id: string }>> {
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        role: "admin",
        status: "active",
        fullName: input.fullName,
        username: input.username,
        passwordHash,
        approvedAt: now,
        approvedBy: actor.id,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: users.username })
      .returning({ id: users.id });
    if (!created)
      return err("CONFLICT", {
        fieldErrors: { username: fieldMessages.usernameTaken },
      });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "admin.create",
      targetType: "user",
      targetId: created.id,
    });
    return ok({ id: created.id });
  });
}
