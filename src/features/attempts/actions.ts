"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStudent } from "@/features/auth/guards";
import { QUESTION_TYPES } from "@/features/lessons/schema";
import {
  type PracticeFeedback,
  REVIEW_SIZES,
} from "@/features/review/domain/practice";
import { startReviewPractice as startReview } from "@/features/review/practice-service";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request";
import { err, type FormState, type Result } from "@/lib/result";
import { CheckPracticeSchema, StartAttemptSchema } from "./schemas";
import {
  checkPracticeAnswer as checkPractice,
  startAttempt as startOrResume,
} from "./service";

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

/**
 * "Kiểm tra" in practice mode (05 `checkPracticeAnswer`, S7-06): one item's
 * score and key, then the answer is locked. Refused for tests (ADR-004).
 */
export async function checkPracticeAnswer(
  input: unknown,
): Promise<Result<PracticeFeedback>> {
  const user = await requireStudent();
  const parsed = CheckPracticeSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  // A set has at most 30 questions; this only stops scripted hammering.
  const limit = await rateLimit(`practice:check:${user.id}`, 120, "10m");
  if (!limit.ok) return err("RATE_LIMITED");
  return checkPractice(user.id, parsed.data);
}

const StartReviewSchema = z.object({
  count: z.coerce
    .number()
    .int()
    .refine((n) => (REVIEW_SIZES as readonly number[]).includes(n)),
  chapter: z
    .string()
    .trim()
    .max(100)
    .transform((c) => c || null)
    .nullable()
    .default(null),
  type: z
    .enum(QUESTION_TYPES)
    .or(z.literal("").transform(() => null))
    .nullable()
    .default(null),
});

/**
 * Form action on `/review` (05 `startReviewPractice`, S7-06): a practice
 * set from my open mistakes under the page's filters, then the runner.
 */
export async function startReviewPractice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStudent();
  const parsed = StartReviewSchema.safeParse({
    count: formData.get("count"),
    chapter: formData.get("chapter"),
    type: formData.get("type"),
  });
  if (!parsed.success) return err("VALIDATION");
  const { ip } = await getRequestMeta();
  const result = await startReview(user, parsed.data, { ip });
  if (!result.ok) return result;
  // Per-student data only: nothing shared to invalidate.
  redirect(`/attempts/${result.data.attemptId}`);
}
