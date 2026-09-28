import type { Result } from "@/lib/result";
import { createUploadUrl } from "../actions";
import {
  fitWithin,
  MAX_SOURCE_BYTES,
  MAX_UPLOAD_BYTES,
  type UploadType,
  WEBP_QUALITY,
} from "../domain/upload";
import { uploadCopy as t } from "../messages";

/** Raster types the browser can decode; SVG is refused (scripts, no size). */
const ACCEPTED = /^image\/(png|jpeg|webp|gif|bmp|avif)$/;
export const ACCEPT_ATTR = "image/png,image/jpeg,image/webp,image/gif";

export type PreparedImage = {
  blob: Blob;
  contentType: UploadType;
  width: number;
  height: number;
};

type Prepared =
  | { ok: true; image: PreparedImage }
  | { ok: false; message: string };

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
}

async function decode(file: Blob): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      return null;
    }
  }
}

/**
 * ADR-006: resize in the browser to at most 1280 px and encode WebP (0.8).
 * Browsers that can't encode WebP get JPEG on white, since JPEG has no
 * transparency and figures are often drawn on a transparent background.
 */
export async function prepareImage(file: Blob): Promise<Prepared> {
  if (!ACCEPTED.test(file.type)) return { ok: false, message: t.notImage };
  if (file.size > MAX_SOURCE_BYTES) return { ok: false, message: t.tooBig };
  const bitmap = await decode(file);
  if (!bitmap) return { ok: false, message: t.decodeFailed };
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, message: t.decodeFailed };
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);

  let blob = await toBlob(canvas, "image/webp", WEBP_QUALITY);
  let contentType: UploadType = "image/webp";
  if (blob?.type !== "image/webp") {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
    blob = await toBlob(canvas, "image/jpeg", 0.85);
    contentType = "image/jpeg";
  }
  bitmap.close();
  if (!blob) return { ok: false, message: t.decodeFailed };
  if (blob.size > MAX_UPLOAD_BYTES)
    return { ok: false, message: t.stillTooBig };
  return { ok: true, image: { blob, contentType, width, height } };
}

export type Uploaded = { path: string; width: number; height: number };

/** Resize, get a signed URL from the server, PUT the bytes to Storage. */
export async function uploadImage(
  file: Blob,
): Promise<Result<Uploaded> | { ok: false; message: string }> {
  const prepared = await prepareImage(file);
  if (!prepared.ok) return prepared;
  const { blob, contentType, width, height } = prepared.image;
  const ticket = await createUploadUrl({
    contentType,
    bytes: blob.size,
    width,
    height,
  }).catch(() => null);
  if (!ticket) return { ok: false, message: t.uploadFailed };
  if (!ticket.ok) return ticket;
  const res = await fetch(ticket.data.uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": contentType,
      // Paths are content-unique: cache for a year (ADR-006).
      "cache-control": "max-age=31536000",
      "x-upsert": "false",
    },
    body: blob,
  }).catch(() => null);
  if (!res?.ok) return { ok: false, message: t.uploadFailed };
  return { ok: true, data: { path: ticket.data.path, width, height } };
}
