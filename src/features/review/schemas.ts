import { z } from "zod";
import { QUESTION_TYPES } from "@/features/lessons/schema";
import { REVIEW_SIZES } from "./domain/practice";

/** `POST /api/review/start` (05 `startReviewPractice`, S7-06). */
export const StartReviewSchema = z.object({
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
