"use server";

import { requireAdmin } from "@/features/auth/guards";
import { err, type Result } from "@/lib/result";
import { UploadRequestSchema } from "./domain/upload";
import { createUpload, type UploadTicket } from "./service";

/**
 * `createUploadUrl` (05 §2, ADR-006): admin only. The browser has already
 * resized the image; it sends the type, size and pixel size, gets a signed
 * URL and uploads straight to Storage. No shared data changes until the
 * path is saved into a lesson.
 */
export async function createUploadUrl(
  input: unknown,
): Promise<Result<UploadTicket>> {
  const user = await requireAdmin();
  const parsed = UploadRequestSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  return createUpload(user, parsed.data);
}
