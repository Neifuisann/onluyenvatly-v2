"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/features/auth/guards";
import { tags } from "@/lib/cache-tags";
import { err, type Result } from "@/lib/result";
import {
  type DeletedAttempt,
  deleteAttempt as deleteAttemptService,
} from "./admin-service";
import { AttemptIdSchema } from "./schemas";

/**
 * `deleteAttempt(id)` (05 §2, S6-04): `requireAdmin()` first, the id, then
 * one transaction (delete, rating replay, attempt count, audit). Invalidates
 * the leaderboard when a rating changed, and the lesson's statistics and the
 * admin dashboard (S6-06) when a submitted attempt went. No `refresh()`:
 * the result page it was on no longer exists, the client goes to the
 * (uncached) results list.
 */
export async function deleteAttempt(
  input: unknown,
): Promise<Result<DeletedAttempt>> {
  const user = await requireAdmin();
  const id = AttemptIdSchema.safeParse(input);
  if (!id.success) return err("VALIDATION");
  const result = await deleteAttemptService(user, id.data);
  if (result.ok) {
    const { rated, status, lessonId } = result.data;
    if (rated) updateTag(tags.leaderboard);
    if (status === "submitted") {
      if (lessonId !== null) updateTag(tags.lessonStats(lessonId));
      updateTag(tags.adminOverview);
    }
  }
  return result;
}
