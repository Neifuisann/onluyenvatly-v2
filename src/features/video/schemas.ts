import { z } from "zod";
import { AnswerSchema } from "@/features/attempts/schemas";
import { MAX_QUESTIONS, MAX_VIDEO_SECONDS } from "@/features/lessons/schema";

/**
 * `POST /api/attempts/[id]/video`: one step of a video lesson. `progress`
 * saves where the student is; `answer` stores one cue's answers; `finish`
 * grades the attempt when the video has ended.
 */
export const VideoMoveSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("progress"),
    pos: z.number().min(0).max(MAX_VIDEO_SECONDS),
  }),
  z.strictObject({
    kind: z.literal("answer"),
    cue: z
      .number()
      .int()
      .min(0)
      .max(MAX_QUESTIONS - 1),
    answers: z.array(AnswerSchema).min(1).max(MAX_QUESTIONS),
  }),
  z.strictObject({ kind: z.literal("finish") }),
]);
export type VideoMove = z.infer<typeof VideoMoveSchema>;

/** One cue's answers at most: a few KB. */
export const MAX_VIDEO_MOVE_BYTES = 16_384;
