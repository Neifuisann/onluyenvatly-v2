import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { writeAuditMany } from "@/lib/audit";
import { ok, type Result } from "@/lib/result";

/**
 * Student mutations (S6-01, 05 §2 `features/students/admin-actions.ts`).
 * Each one writes its audit entry in the same transaction. Callers check
 * `requireAdmin()` first; on top of that every function only touches
 * `role = 'student'` rows, so an admin can never act on their own account.
 * Audit `data` holds ids and counts only: never a name or a phone.
 */

export type Actor = { id: string };

const isStudent = eq(users.role, "student");

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
