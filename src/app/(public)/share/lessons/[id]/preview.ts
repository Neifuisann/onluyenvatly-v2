import "server-only";
import { LessonIdSchema } from "@/features/lessons/domain/lesson-params";
import { getSharePreview } from "@/features/lessons/queries";

/** The share preview for a raw `[id]` segment, or null (bad id, unpublished). */
export async function sharePreviewFor(rawId: string) {
  const parsed = LessonIdSchema.safeParse(rawId);
  return parsed.success ? getSharePreview(parsed.data) : null;
}
