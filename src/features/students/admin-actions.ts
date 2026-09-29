"use server";

import { refresh, updateTag } from "next/cache";
import { requireAdmin } from "@/features/auth/guards";
import { fieldErrorsOf } from "@/features/auth/schemas";
import { tags } from "@/lib/cache-tags";
import { err, type Result } from "@/lib/result";
import {
  approveStudents,
  createAdmin as createAdminService,
  deleteStudent as deleteStudentService,
  grantExtraAttempts as grantExtraAttemptsService,
  rejectStudents,
  resetStudentPassword,
  revokeStudentSessions,
  setStudentStatus,
} from "./admin-service";
import {
  BulkIdsSchema,
  CreateAdminSchema,
  DeleteStudentSchema,
  GrantAttemptsSchema,
  SetStatusSchema,
  StudentIdSchema,
} from "./domain/input";
import type { StudentStatus } from "./domain/list";

/**
 * Admin student actions (05 §2). Every one: `requireAdmin()` first, Zod, the
 * service (one transaction with its audit entry), then the cache tags of what
 * changed and a router refresh for the uncached admin pages. They only ever
 * target `role = 'student'` rows (`createAdmin` excepted).
 */

type Decision = Result<{ done: number; skipped: number }>;

/** `student.approve`: pending → active, in bulk. */
export async function approve(input: unknown): Promise<Decision> {
  const user = await requireAdmin();
  const parsed = BulkIdsSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await approveStudents(user, parsed.data.ids);
  if (result.ok) {
    // The nav badge; an approved student has no rating yet, so the
    // leaderboard is unchanged.
    updateTag(tags.pendingStudents);
    refresh();
  }
  return result;
}

/** `student.reject`: pending → rejected, in bulk. */
export async function reject(input: unknown): Promise<Decision> {
  const user = await requireAdmin();
  const parsed = BulkIdsSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await rejectStudents(user, parsed.data.ids);
  if (result.ok) {
    updateTag(tags.pendingStudents);
    refresh();
  }
  return result;
}

/**
 * A temporary password, returned once to the caller's dialog. It is never
 * stored in clear, logged or audited; the student's sessions are revoked.
 */
export async function resetPassword(
  input: unknown,
): Promise<Result<{ password: string }>> {
  const user = await requireAdmin();
  const id = StudentIdSchema.safeParse(input);
  if (!id.success) return err("VALIDATION");
  const result = await resetStudentPassword(user, id.data);
  if (result.ok) refresh();
  return result;
}

export async function revokeSessions(
  input: unknown,
): Promise<Result<{ revoked: number }>> {
  const user = await requireAdmin();
  const id = StudentIdSchema.safeParse(input);
  if (!id.success) return err("VALIDATION");
  const result = await revokeStudentSessions(user, id.data);
  if (result.ok) refresh();
  return result;
}

/** Disable (logs the student out) or re-enable. */
export async function setStatus(
  input: unknown,
): Promise<Result<{ status: StudentStatus }>> {
  const user = await requireAdmin();
  const parsed = SetStatusSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await setStudentStatus(
    user,
    parsed.data.id,
    parsed.data.status,
  );
  if (result.ok) {
    // The leaderboard lists active students only.
    updateTag(tags.leaderboard);
    refresh();
  }
  return result;
}

/**
 * Deletes the student with everything of theirs. The detail page they were
 * on no longer exists, so there is no `refresh()`: the caller navigates to
 * the (uncached) list.
 */
export async function deleteStudent(
  input: unknown,
): Promise<Result<{ attempts: number; lessons: number }>> {
  const user = await requireAdmin();
  const parsed = DeleteStudentSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await deleteStudentService(
    user,
    parsed.data.id,
    parsed.data.confirmName,
  );
  if (result.ok) {
    updateTag(tags.pendingStudents);
    updateTag(tags.leaderboard);
    // Catalog cards show `attempt_count`.
    if (result.data.lessons > 0) updateTag(tags.lessons);
  }
  return result;
}

/** Extra tries on one lesson (1–100), or 0 to take the grant back. */
export async function grantExtraAttempts(
  input: unknown,
): Promise<Result<{ extra: number }>> {
  const user = await requireAdmin();
  const parsed = GrantAttemptsSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await grantExtraAttemptsService(user, parsed.data);
  // Read per attempt start, never shared-cached: nothing to invalidate.
  if (result.ok) refresh();
  return result;
}

/**
 * A new admin account. The form lives on `/admin/settings` (S6-03), which
 * refreshes its own admin list.
 */
export async function createAdmin(
  input: unknown,
): Promise<Result<{ id: string }>> {
  const user = await requireAdmin();
  const parsed = CreateAdminSchema.safeParse(input);
  if (!parsed.success)
    return err("VALIDATION", { fieldErrors: fieldErrorsOf(parsed.error) });
  const result = await createAdminService(user, parsed.data);
  if (result.ok) refresh();
  return result;
}
