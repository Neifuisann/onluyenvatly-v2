import "server-only";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { media } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import {
  MEDIA_QUOTA_BYTES,
  mediaObjectPath,
  type UploadRequest,
} from "./domain/upload";
import { type StorageConfig, signUpload, storageConfig } from "./storage";

/** 06 §4. Pasting a handful of figures at once stays well inside. */
export const UPLOAD_LIMIT = [60, "10m"] as const;

export type UploadTicket = {
  /** Object path inside the `media` bucket, for `![](media:…)` and covers. */
  path: string;
  /** Signed, one-time PUT URL on Supabase Storage. */
  uploadUrl: string;
};

/**
 * Reserves a path and signs an upload for it (S5-05). The `media` row is
 * written now, with the size the browser reported: it feeds the quota check,
 * and the daily cron removes rows whose object never arrived.
 */
export async function createUpload(
  actor: { id: string },
  req: UploadRequest,
  {
    now = new Date(),
    config = storageConfig(),
    sign = signUpload,
  }: {
    now?: Date;
    config?: StorageConfig | null;
    sign?: typeof signUpload;
  } = {},
): Promise<Result<UploadTicket>> {
  if (!config) return err("STORAGE_UNAVAILABLE");
  const limit = await rateLimit(
    `media:upload:${actor.id}`,
    ...UPLOAD_LIMIT,
    now,
  );
  if (!limit.ok) return err("RATE_LIMITED");
  const [used] = await db
    .select({ bytes: sql<number>`coalesce(sum(${media.bytes}), 0)::bigint` })
    .from(media);
  if (Number(used?.bytes ?? 0) + req.bytes > MEDIA_QUOTA_BYTES)
    return err("STORAGE_FULL");

  const path = mediaObjectPath(now, randomUUID(), req.contentType);
  const uploadUrl = await sign(config, path);
  if (!uploadUrl) return err("STORAGE_UNAVAILABLE");
  await db.insert(media).values({
    path,
    bytes: req.bytes,
    width: req.width,
    height: req.height,
    uploadedBy: actor.id,
  });
  return ok({ path, uploadUrl });
}

/** Whether `path` is a file uploaded through `createUpload` (or migrated). */
export async function mediaExists(path: string): Promise<boolean> {
  const [row] = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.path, path))
    .limit(1);
  return Boolean(row);
}
