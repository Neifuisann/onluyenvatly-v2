import { z } from "zod";
import { LessonIdSchema } from "@/features/lessons/domain/lesson-params";
import { MAX_QUESTIONS } from "@/features/lessons/schema";

/** Attempt ids are UUIDs; reject anything else before it reaches SQL. */
export const AttemptIdSchema = z.uuid();

/** `startAttempt` form: the lesson id arrives as a string. */
export const StartAttemptSchema = z.object({ lessonId: LessonIdSchema });

/**
 * One stored answer (04 `attempts.answers`): an mcq letter or short text, tf
 * booleans (null = unanswered), or null. Shape only; grading decides what
 * counts.
 */
export const AnswerSchema = z.union([
  z.null(),
  z.string().max(100),
  z.array(z.boolean().nullable()).max(8),
]);

const answers = z.array(AnswerSchema).max(MAX_QUESTIONS);
const flagged = z
  .array(
    z
      .number()
      .int()
      .min(0)
      .max(MAX_QUESTIONS - 1),
  )
  .max(MAX_QUESTIONS);

/** `POST /api/attempts/[id]/save`: the whole (small) state, last write wins. */
export const SaveProgressSchema = z.strictObject({ answers, flagged });
export type SaveProgressInput = z.infer<typeof SaveProgressSchema>;

/** `POST /api/attempts/[id]/submit`. The key makes retries idempotent. */
export const SubmitAttemptSchema = z.strictObject({
  answers,
  flagged,
  clientSubmitId: z.uuid(),
});
export type SubmitAttemptInput = z.infer<typeof SubmitAttemptSchema>;

/** Request bodies are tiny (≈ 1 KB for 40 questions); refuse anything big. */
export const MAX_BODY_BYTES = 16_384;
