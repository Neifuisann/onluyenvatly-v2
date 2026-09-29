import { z } from "zod";
import { LessonIdSchema } from "@/features/lessons/domain/lesson-params";
import { MAX_QUESTIONS } from "@/features/lessons/schema";
import { GUARD_KINDS, MAX_GUARD_BATCH } from "./domain/guard";

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

/** Exam-guard events not yet sent; the server appends them (S4-04). */
const guardEvents = z
  .array(
    z.strictObject({
      // Seconds since start; a day is far beyond any test.
      t: z.number().int().min(0).max(86_400),
      k: z.enum(GUARD_KINDS),
    }),
  )
  .max(MAX_GUARD_BATCH)
  .default([]);

/**
 * `POST /api/attempts/[id]/save`: the whole (small) answer state, last write
 * wins, plus new guard events, which only ever append.
 */
export const SaveProgressSchema = z.strictObject({
  answers,
  flagged,
  guardEvents,
});
export type SaveProgressInput = z.input<typeof SaveProgressSchema>;

/** `POST /api/attempts/[id]/submit`. The key makes retries idempotent. */
export const SubmitAttemptSchema = z.strictObject({
  answers,
  flagged,
  guardEvents,
  clientSubmitId: z.uuid(),
});
export type SubmitAttemptInput = z.input<typeof SubmitAttemptSchema>;

/** Request bodies are tiny (≈ 1 KB for 40 questions); refuse anything big. */
export const MAX_BODY_BYTES = 16_384;

/** `checkPracticeAnswer` (S7-06): one item's answer in a practice set. */
export const CheckPracticeSchema = z.strictObject({
  attemptId: AttemptIdSchema,
  index: z
    .number()
    .int()
    .min(0)
    .max(MAX_QUESTIONS - 1),
  answer: AnswerSchema,
});
export type CheckPracticeInput = z.infer<typeof CheckPracticeSchema>;
