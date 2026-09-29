"use server";

import { refresh, updateTag } from "next/cache";
import { requireUser } from "@/features/auth/guards";
import { fieldErrorsOf } from "@/features/auth/schemas";
import { tags } from "@/lib/cache-tags";
import { err, type Result } from "@/lib/result";
import {
  AvatarPathSchema,
  AvatarUploadSchema,
  DeletionRequestSchema,
  PrivacySchema,
  type ProfileKey,
  ProfileSchema,
  SessionHandleSchema,
} from "./domain/account";
import {
  cancelDeletion,
  createAvatarUpload,
  removeAvatar,
  requestDeletion,
  revokeMySession as revokeMySessionService,
  setAvatar,
  setPrivacy,
  updateProfile,
} from "./service";

/**
 * The student's own settings (05 §2 `features/settings/actions.ts`, S8-04;
 * a separate file so the admin-only settings actions stay admin-only).
 * Each action: `requireUser()` first, then Zod, then one service call that
 * only touches the caller's own row. The name, class and privacy choice are
 * on the shared leaderboard, so those changes invalidate its tag.
 */

export async function updateMyProfile(
  input: unknown,
): Promise<Result<{ changed: ProfileKey[] }>> {
  const user = await requireUser();
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success)
    return err("VALIDATION", { fieldErrors: fieldErrorsOf(parsed.error) });
  const result = await updateProfile(user, parsed.data);
  if (result.ok && result.data.changed.length > 0) {
    // Name, class and grade appear on the leaderboard (and the shell).
    updateTag(tags.leaderboard);
    refresh();
  }
  return result;
}

export async function setMyPrivacy(
  input: unknown,
): Promise<Result<{ changed: boolean }>> {
  const user = await requireUser();
  const parsed = PrivacySchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await setPrivacy(user, parsed.data);
  if (result.ok && result.data.changed) {
    updateTag(tags.leaderboard);
    refresh();
  }
  return result;
}

/** Logs out one of my other devices (by the handle `getMySessions` gave). */
export async function revokeMySession(
  input: unknown,
): Promise<Result<{ revoked: number }>> {
  const user = await requireUser();
  const parsed = SessionHandleSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await revokeMySessionService(user, parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function requestAccountDeletion(
  input: unknown,
): Promise<Result<{ requestedAt: Date }>> {
  const user = await requireUser();
  const parsed = DeletionRequestSchema.safeParse(input);
  if (!parsed.success)
    return err("VALIDATION", { fieldErrors: fieldErrorsOf(parsed.error) });
  const result = await requestDeletion(user, parsed.data.password);
  if (result.ok) refresh();
  return result;
}

export async function cancelAccountDeletion(): Promise<
  Result<{ cancelled: boolean }>
> {
  const user = await requireUser();
  const result = await cancelDeletion(user);
  if (result.ok) refresh();
  return result;
}

/** Step 1 of an avatar change: a signed URL the browser PUTs the WebP to. */
export async function createAvatarUploadUrl(
  input: unknown,
): Promise<Result<{ path: string; uploadUrl: string }>> {
  const user = await requireUser();
  const parsed = AvatarUploadSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  return createAvatarUpload(user, parsed.data);
}

/** Step 2: save the uploaded path; the old picture is deleted. */
export async function saveMyAvatar(
  input: unknown,
): Promise<Result<{ avatarPath: string }>> {
  const user = await requireUser();
  const parsed = AvatarPathSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await setAvatar(user, parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function removeMyAvatar(): Promise<Result<{ removed: boolean }>> {
  const user = await requireUser();
  const result = await removeAvatar(user);
  if (result.ok) refresh();
  return result;
}
