"use server";

import { redirect } from "next/navigation";
import { requireStudent } from "@/features/auth/guards";
import { getRequestMeta } from "@/lib/request";
import { err, type FormState } from "@/lib/result";
import { StartAttemptSchema } from "./schemas";
import { startAttempt as startOrResume } from "./service";

/**
 * Attempt actions (05 §2). Saving and submitting go through the JSON route
 * handlers under `/api/attempts/[id]/*` instead, for the offline retry queue
 * and `sendBeacon`.
 */

/** Form action: starts or resumes a test, then opens the runner. */
export async function startAttempt(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStudent();
  const parsed = StartAttemptSchema.safeParse({
    lessonId: formData.get("lessonId"),
  });
  if (!parsed.success) return err("VALIDATION");
  const { ip } = await getRequestMeta();
  const result = await startOrResume(user, parsed.data.lessonId, { ip });
  if (!result.ok) return result;
  // No cache tags: nothing shared changes until the attempt is submitted.
  redirect(`/attempts/${result.data.attemptId}`);
}
