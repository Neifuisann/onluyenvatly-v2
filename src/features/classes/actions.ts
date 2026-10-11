"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/features/auth/guards";
import { fieldErrorsOf } from "@/features/auth/schemas";
import { tags } from "@/lib/cache-tags";
import { err, type Result } from "@/lib/result";
import {
  AddMembersSchema,
  ArchiveClassSchema,
  ClassFormSchema,
  ClassIdSchema,
  type MemberChange,
  RemoveMemberSchema,
  SetLessonsSchema,
  UpdateClassSchema,
} from "./domain/classes";
import {
  addMembers as addMembersService,
  createClass as createClassService,
  deleteClass as deleteClassService,
  removeMember as removeMemberService,
  setClassArchived,
  setClassLessons,
  updateClass as updateClassService,
} from "./service";

/**
 * Teacher class actions (B-03, 05 §2). Every one: `requireTeacher()` first,
 * Zod, the service (one transaction scoped to the teacher's own class, with
 * its audit entry), then the tags of what changed and a refresh of the
 * uncached teacher pages. Memberships are never shared-cached, so adding or
 * removing a student changes no tag.
 */

/** "Tạo lớp": opens the new class to add students and lessons. */
export async function createClass(input: unknown): Promise<Result<never>> {
  const user = await requireTeacher();
  const parsed = ClassFormSchema.safeParse(input);
  if (!parsed.success)
    return err("VALIDATION", { fieldErrors: fieldErrorsOf(parsed.error) });
  const { id } = await createClassService(user, parsed.data);
  redirect(`/admin/classes/${id}`);
}

export async function updateClass(
  input: unknown,
): Promise<Result<{ id: number }>> {
  const user = await requireTeacher();
  const parsed = UpdateClassSchema.safeParse(input);
  if (!parsed.success) {
    // Field messages for the form, keyed like the create form's.
    const form = ClassFormSchema.safeParse(
      (input as { form?: unknown } | null)?.form,
    );
    return err("VALIDATION", {
      fieldErrors: form.success ? {} : fieldErrorsOf(form.error),
    });
  }
  const result = await updateClassService(
    user,
    parsed.data.id,
    parsed.data.form,
  );
  if (result.ok) refresh();
  return result;
}

export async function archiveClass(
  input: unknown,
): Promise<Result<{ id: number }>> {
  const user = await requireTeacher();
  const parsed = ArchiveClassSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await setClassArchived(
    user,
    parsed.data.id,
    parsed.data.archived,
  );
  if (result.ok) refresh();
  return result;
}

/** "Xóa lớp": back to the class list. */
export async function deleteClass(input: unknown): Promise<Result<never>> {
  const user = await requireTeacher();
  const id = ClassIdSchema.safeParse(input);
  if (!id.success) return err("VALIDATION");
  const result = await deleteClassService(user, id.data);
  if (!result.ok) return result;
  updateTag(tags.classLessons(id.data));
  redirect("/admin/classes");
}

export async function addMembers(
  input: unknown,
): Promise<Result<MemberChange>> {
  const user = await requireTeacher();
  const parsed = AddMembersSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await addMembersService(
    user,
    parsed.data.id,
    parsed.data.phones,
  );
  if (result.ok && result.data.added) refresh();
  return result;
}

export async function removeMember(
  input: unknown,
): Promise<Result<{ id: number }>> {
  const user = await requireTeacher();
  const parsed = RemoveMemberSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await removeMemberService(
    user,
    parsed.data.id,
    parsed.data.userId,
  );
  if (result.ok) refresh();
  return result;
}

/** "Giao bài": the class's lesson list, shared by its students. */
export async function setLessons(
  input: unknown,
): Promise<Result<{ added: number; removed: number }>> {
  const user = await requireTeacher();
  const parsed = SetLessonsSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await setClassLessons(
    user,
    parsed.data.id,
    parsed.data.lessonIds,
  );
  if (result.ok && (result.data.added || result.data.removed)) {
    updateTag(tags.classLessons(parsed.data.id));
    refresh();
  }
  return result;
}
