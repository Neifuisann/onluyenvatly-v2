"use server";

import { refresh, updateTag } from "next/cache";
import { requireAdmin } from "@/features/auth/guards";
import { tags } from "@/lib/cache-tags";
import { err, type Result } from "@/lib/result";
import {
  deleteLesson as deleteLessonService,
  duplicateLesson as duplicateLessonService,
  reorderLessons,
  setArchived,
} from "./admin-service";
import { LessonIdSchema, ReorderSchema } from "./domain/admin-list";

/**
 * Admin lesson actions (05 §2). Every one: `requireAdmin()` first, Zod, the
 * service (one transaction with its audit entry), then the cache tags of what
 * changed and a router refresh for the uncached admin list.
 */

/** Tags a status or content change of one lesson touches. */
function invalidateLesson(id: number) {
  updateTag(tags.lessons);
  updateTag(tags.lesson(id));
}

export async function reorder(
  input: unknown,
): Promise<Result<{ count: number }>> {
  const user = await requireAdmin();
  const parsed = ReorderSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await reorderLessons(user, parsed.data.ids);
  if (result.ok) {
    // The catalog's default sort is the teacher's order.
    updateTag(tags.lessons);
    refresh();
  }
  return result;
}

export async function duplicate(
  input: unknown,
): Promise<Result<{ id: number }>> {
  const user = await requireAdmin();
  const id = LessonIdSchema.safeParse(input);
  if (!id.success) return err("VALIDATION");
  const result = await duplicateLessonService(user, id.data);
  // A new draft is invisible to students: no shared tag changes.
  if (result.ok) refresh();
  return result;
}

export async function archive(input: unknown): Promise<Result<{ id: number }>> {
  return changeArchived(input, true);
}

export async function restore(input: unknown): Promise<Result<{ id: number }>> {
  return changeArchived(input, false);
}

async function changeArchived(
  input: unknown,
  archived: boolean,
): Promise<Result<{ id: number }>> {
  const user = await requireAdmin();
  const id = LessonIdSchema.safeParse(input);
  if (!id.success) return err("VALIDATION");
  const result = await setArchived(user, id.data, archived);
  if (result.ok) {
    invalidateLesson(id.data);
    refresh();
  }
  return result;
}

export async function deleteLesson(
  input: unknown,
): Promise<Result<{ id: number; soft: boolean }>> {
  const user = await requireAdmin();
  const id = LessonIdSchema.safeParse(input);
  if (!id.success) return err("VALIDATION");
  const result = await deleteLessonService(user, id.data);
  if (result.ok) {
    invalidateLesson(id.data);
    if (!result.data.soft) {
      updateTag(tags.lessonPublic(id.data));
      updateTag(tags.lessonAnswers(id.data));
    }
    refresh();
  }
  return result;
}
