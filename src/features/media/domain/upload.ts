/**
 * Image uploads (S5-05, ADR-006). Pure: sizes, paths and the request the
 * browser sends before uploading straight to Storage.
 */
import { z } from "zod";

/** Longest side after the browser resize (ADR-006). */
export const MAX_SIDE = 1280;
export const WEBP_QUALITY = 0.8;
/** 06 §4: the resized file; anything larger means the resize didn't happen. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
/** What the teacher may pick or paste, before resizing. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
/** Supabase Free has 1 GB of storage; keep a margin for migrated v1 files. */
export const MEDIA_QUOTA_BYTES = 900 * 1024 * 1024;

export const UPLOAD_TYPES = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
} as const;
export type UploadType = keyof typeof UPLOAD_TYPES;

export const UploadRequestSchema = z.strictObject({
  contentType: z.enum(
    Object.keys(UPLOAD_TYPES) as [UploadType, ...UploadType[]],
  ),
  bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  width: z.number().int().positive().max(MAX_SIDE),
  height: z.number().int().positive().max(MAX_SIDE),
});
export type UploadRequest = z.infer<typeof UploadRequestSchema>;

/** Scales `width × height` down (never up) so the longest side fits `max`. */
export function fitWithin(
  width: number,
  height: number,
  max = MAX_SIDE,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * `yyyy/mm/<uuid>.<ext>` inside the `media` bucket. Content-unique, so the
 * public URL can be cached forever.
 */
export function mediaObjectPath(
  now: Date,
  id: string,
  contentType: UploadType,
): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}/${mm}/${id}.${UPLOAD_TYPES[contentType]}`;
}

/** The text-format line for an uploaded image (04 §3.3). */
export function imageMarkup(
  path: string,
  size?: { width: number; height: number },
  alt = "",
): string {
  const dims = size ? ` =${size.width}x${size.height}` : "";
  return `![${alt}](media:${path}${dims})`;
}
