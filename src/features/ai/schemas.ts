import { z } from "zod";
import { MAX_QUESTIONS } from "@/features/lessons/schema";
import { HASH_PATTERN } from "./domain/explain";

/** `POST /api/ai/explain` body: one question of one of my attempts. */
export const ExplainInputSchema = z.strictObject({
  attemptId: z.uuid(),
  index: z
    .number()
    .int()
    .min(0)
    .max(MAX_QUESTIONS - 1),
});

export const ExplanationHashSchema = z.string().regex(HASH_PATTERN);

/** `voteExplanation`: `null` clears my vote. */
export const VoteInputSchema = z.strictObject({
  hash: ExplanationHashSchema,
  vote: z.enum(["up", "down"]).nullable(),
});
