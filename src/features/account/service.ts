import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, like, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { media, sessions, users } from "@/db/schema";
import type { Role } from "@/features/auth/core/login-policy";
import { verifyPassword } from "@/features/auth/core/password";
import { MEDIA_QUOTA_BYTES } from "@/features/media/domain/upload";
import {
  MEDIA_BUCKET,
  removeObjects,
  type StorageConfig,
  signUpload,
  storageConfig,
} from "@/features/media/storage";
import { writeAudit } from "@/lib/audit";
import { fieldMessages } from "@/lib/messages";
import { rateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import {
  type AvatarUpload,
  avatarObjectPath,
  changedKeys,
  isOwnAvatarPath,
  type PrivacyInput,
  type ProfileInput,
  type ProfileKey,
  SessionHandleSchema,
} from "./domain/account";

/**
 * A signed-in user's own account (S8-04). Callers run `requireUser()`
 * first and pass that user: every write is scoped to `users.id = me`. Audit
 * rows carry the changed keys only, never the values.
 */

export type Me = { id: string; role: Role; sessionId: string };

/** 06 §4: a few tries an hour is plenty for a profile picture. */
export const AVATAR_LIMIT = [10, "1h"] as const;
/** The password check behind a deletion request, like changePassword. */
export const DELETION_LIMIT = [5, "10m"] as const;

export async function updateProfile(
  me: Me,
  input: ProfileInput,
  now = new Date(),
): Promise<Result<{ changed: ProfileKey[] }>> {
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select({
        fullName: users.fullName,
        dateOfBirth: users.dateOfBirth,
        grade: users.grade,
        className: users.className,
      })
      .from(users)
      .where(eq(users.id, me.id))
      .for("update")
      .limit(1);
    if (!before) return err("NOT_FOUND");
    const changed = changedKeys(before, input);
    if (changed.length === 0) return ok({ changed });
    await tx
      .update(users)
      .set({
        ...Object.fromEntries(changed.map((k) => [k, input[k]])),
        updatedAt: now,
      })
      .where(eq(users.id, me.id));
    await writeAudit(tx, {
      actorId: me.id,
      action: "account.update_profile",
      targetType: "user",
      targetId: me.id,
      data: { changed },
    });
    return ok({ changed });
  });
}

export async function setPrivacy(
  me: Me,
  input: PrivacyInput,
  now = new Date(),
): Promise<Result<{ changed: boolean }>> {
  const rows = await db
    .update(users)
    .set({ leaderboardInitials: input.leaderboardInitials, updatedAt: now })
    .where(
      and(
        eq(users.id, me.id),
        ne(users.leaderboardInitials, input.leaderboardInitials),
      ),
    )
    .returning({ id: users.id });
  return ok({ changed: rows.length > 0 });
}

/**
 * Logs out one of my other devices. The current session is refused: that's
 * what "Đăng xuất" is for, and it also clears the cookie.
 */
export async function revokeMySession(
  me: Me,
  handle: string,
): Promise<Result<{ revoked: number }>> {
  if (
    !SessionHandleSchema.safeParse(handle).success ||
    me.sessionId.startsWith(handle)
  )
    return err("VALIDATION");
  const rows = await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, me.id),
        like(sessions.id, `${handle}%`),
        ne(sessions.id, me.sessionId),
      ),
    )
    .returning({ id: sessions.id });
  if (rows.length === 0) return err("NOT_FOUND");
  return ok({ revoked: rows.length });
}

/**
 * Asks the teacher to delete my account (06 §5). The password is checked
 * first; the request is a timestamp the admin sees, and deleting stays the
 * admin's `deleteStudent`. Admin accounts can't ask (another admin removes
 * them). Asking twice keeps the first date.
 */
export async function requestDeletion(
  me: Me,
  password: string,
  now = new Date(),
): Promise<Result<{ requestedAt: Date }>> {
  if (me.role !== "student") return err("FORBIDDEN");
  const limit = await rateLimit(
    `account:deletion:${me.id}`,
    ...DELETION_LIMIT,
    now,
  );
  if (!limit.ok) return err("RATE_LIMITED");
  const [row] = await db
    .select({
      passwordHash: users.passwordHash,
      requestedAt: users.deletionRequestedAt,
    })
    .from(users)
    .where(eq(users.id, me.id))
    .limit(1);
  if (!row) return err("NOT_FOUND");
  if (!(await verifyPassword(password, row.passwordHash)))
    return err("VALIDATION", {
      fieldErrors: { password: fieldMessages.currentPasswordWrong },
    });
  if (row.requestedAt) return ok({ requestedAt: row.requestedAt });
  return db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ deletionRequestedAt: now, updatedAt: now })
      .where(eq(users.id, me.id));
    await writeAudit(tx, {
      actorId: me.id,
      action: "account.request_deletion",
      targetType: "user",
      targetId: me.id,
    });
    return ok({ requestedAt: now });
  });
}

export async function cancelDeletion(
  me: Me,
  now = new Date(),
): Promise<Result<{ cancelled: boolean }>> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(users)
      .set({ deletionRequestedAt: null, updatedAt: now })
      .where(
        and(eq(users.id, me.id), sql`${users.deletionRequestedAt} is not null`),
      )
      .returning({ id: users.id });
    if (rows.length > 0)
      await writeAudit(tx, {
        actorId: me.id,
        action: "account.cancel_deletion",
        targetType: "user",
        targetId: me.id,
      });
    return ok({ cancelled: rows.length > 0 });
  });
}

// ------------------------------------------------------------------ avatar

type StorageDeps = {
  now?: Date;
  config?: StorageConfig | null;
  sign?: typeof signUpload;
  remove?: typeof removeObjects;
};

/**
 * Signs an upload for a new avatar (the browser has cropped it to a small
 * WebP square). Like lesson images (S5-05) the `media` row is written now,
 * for the quota and the cleanup of uploads that never arrived.
 */
export async function createAvatarUpload(
  me: Me,
  req: AvatarUpload,
  {
    now = new Date(),
    config = storageConfig(),
    sign = signUpload,
  }: StorageDeps = {},
): Promise<Result<{ path: string; uploadUrl: string }>> {
  if (!config) return err("STORAGE_UNAVAILABLE");
  const limit = await rateLimit(
    `account:avatar:${me.id}`,
    ...AVATAR_LIMIT,
    now,
  );
  if (!limit.ok) return err("RATE_LIMITED");
  const [used] = await db
    .select({ bytes: sql<number>`coalesce(sum(${media.bytes}), 0)::bigint` })
    .from(media);
  if (Number(used?.bytes ?? 0) + req.bytes > MEDIA_QUOTA_BYTES)
    return err("STORAGE_FULL");
  const path = avatarObjectPath(me.id, randomUUID());
  const uploadUrl = await sign(config, path);
  if (!uploadUrl) return err("STORAGE_UNAVAILABLE");
  await db.insert(media).values({
    path,
    bytes: req.bytes,
    width: req.width,
    height: req.height,
    uploadedBy: me.id,
  });
  return ok({ path, uploadUrl });
}

/** Removes a replaced avatar: its `media` row, then (best effort) the file. */
async function dropAvatar(path: string, deps: StorageDeps) {
  await db.delete(media).where(eq(media.path, path));
  const config = deps.config === undefined ? storageConfig() : deps.config;
  if (config)
    await (deps.remove ?? removeObjects)(config, MEDIA_BUCKET, [path]);
}

/**
 * Saves an uploaded avatar: only a path signed for me (my folder and my
 * `media` row). The previous picture is deleted afterwards.
 */
export async function setAvatar(
  me: Me,
  path: string,
  deps: StorageDeps = {},
): Promise<Result<{ avatarPath: string }>> {
  if (!isOwnAvatarPath(me.id, path)) return err("VALIDATION");
  const [file] = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.path, path), eq(media.uploadedBy, me.id)))
    .limit(1);
  if (!file) return err("NOT_FOUND");
  const previous = await swapAvatar(me, path, deps.now ?? new Date());
  if (previous && previous !== path) await dropAvatar(previous, deps);
  return ok({ avatarPath: path });
}

export async function removeAvatar(
  me: Me,
  deps: StorageDeps = {},
): Promise<Result<{ removed: boolean }>> {
  const previous = await swapAvatar(me, null, deps.now ?? new Date());
  if (previous) await dropAvatar(previous, deps);
  return ok({ removed: previous !== null });
}

/** Sets `avatar_path` and returns the one it replaced. */
async function swapAvatar(
  me: Me,
  path: string | null,
  now: Date,
): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ avatarPath: users.avatarPath })
      .from(users)
      .where(eq(users.id, me.id))
      .for("update")
      .limit(1);
    await tx
      .update(users)
      .set({ avatarPath: path, updatedAt: now })
      .where(eq(users.id, me.id));
    return row?.avatarPath ?? null;
  });
}
