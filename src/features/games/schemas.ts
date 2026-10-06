import { z } from "zod";
import { AnswerSchema } from "@/features/attempts/schemas";
import { QUESTION_TYPES } from "@/features/lessons/schema";
import {
  MAX_LESSONS,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  PACE_NAMES,
  type Pace,
  PIN_PATTERN,
  RACER_COLORS,
  RACERS,
} from "./domain/rules";

/** Room ids are UUIDs; reject anything else before it reaches SQL. */
export const RoomIdSchema = z.uuid();

/** A typed or linked PIN; spaces around it are forgiven. */
export const PinSchema = z.string().trim().regex(PIN_PATTERN);

export const RacerSchema = z.enum(RACERS);
export const RacerColorSchema = z
  .number()
  .int()
  .min(0)
  .max(RACER_COLORS - 1);

const unique = <T>(items: T[]) => new Set(items).size === items.length;

/** The teacher's create form (`/admin/games/new`). */
export const CreateGameSchema = z.object({
  title: z
    .string()
    .trim()
    .max(80)
    .transform((t) => t || null),
  lessonIds: z
    .array(z.coerce.number().int().positive())
    .min(1)
    .max(MAX_LESSONS)
    .refine(unique),
  count: z.coerce.number().int().min(MIN_QUESTIONS).max(MAX_QUESTIONS),
  pace: z.enum(PACE_NAMES as [Pace, ...Pace[]]),
  types: z.array(z.enum(QUESTION_TYPES)).min(1).refine(unique),
});
export type CreateGameInput = z.infer<typeof CreateGameSchema>;

/** Joining, or changing racer while waiting in the lobby. */
export const JoinGameSchema = z.object({
  roomId: RoomIdSchema,
  racer: RacerSchema,
  color: z.coerce.number().pipe(RacerColorSchema),
});
export type JoinGameInput = z.infer<typeof JoinGameSchema>;

/** `POST /api/games/[id]/answer`: the position answered and the answer. */
export const GameAnswerSchema = z.strictObject({
  index: z
    .number()
    .int()
    .min(0)
    .max(MAX_QUESTIONS - 1),
  answer: AnswerSchema,
});
export type GameAnswerInput = z.infer<typeof GameAnswerSchema>;

export const RemovePlayerSchema = z.object({
  roomId: RoomIdSchema,
  playerId: z.coerce.number().int().positive(),
});

/** Polls send the `rev` they have; anything else means "send everything". */
export const RevSchema = z.coerce.number().int().min(0).catch(-1);

/** Answer bodies are tiny. */
export const MAX_ANSWER_BYTES = 2_048;
