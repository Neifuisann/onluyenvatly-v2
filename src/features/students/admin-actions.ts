"use server";

import { refresh, updateTag } from "next/cache";
import { requireAdmin } from "@/features/auth/guards";
import { tags } from "@/lib/cache-tags";
import { err, type Result } from "@/lib/result";
import { approveStudents, rejectStudents } from "./admin-service";
import { BulkIdsSchema } from "./domain/input";

/**
 * Admin student actions (05 §2). Every one: `requireAdmin()` first, Zod, the
 * service (one transaction with its audit entry), then the cache tags of what
 * changed and a router refresh for the uncached admin pages. They only ever
 * target `role = 'student'` rows.
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
