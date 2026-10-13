import { z } from "zod";
import { AnswerSchema } from "@/features/attempts/schemas";
import { GAME_SECONDS, QUESTION_TYPES } from "@/features/lessons/schema";
import {
  GAME_MODES,
  type GameSettings,
  MAX_LESSONS,
  MAX_LIVES,
  MAX_QUESTIONS,
  MIN_LIVES,
  MIN_QUESTIONS,
  PACE_NAMES,
  type Pace,
  PIN_PATTERN,
  RACER_COLORS,
  RACERS,
  ZOMBIE_LIVES,
  ZOMBIE_TYPES,
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

/**
 * The teacher's create form (`/admin/games/new`). A zombie room (B-14)
 * needs lives of 1 or 3, mcq/tf only, and no same-question rule; its pace
 * is unused (`seconds` is its clock).
 */
export const CreateGameSchema = z
  .object({
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
    pace: z.enum(PACE_NAMES as [Pace, ...Pace[]]).default("normal"),
    types: z.array(z.enum(QUESTION_TYPES)).min(1).refine(unique),
    /** Room settings (B-12); off unless the teacher turns them on. */
    sameQuestion: z.boolean().default(false),
    lockJoin: z.boolean().default(false),
    lives: z.coerce
      .number()
      .int()
      .min(MIN_LIVES)
      .max(MAX_LIVES)
      .nullable()
      .default(null),
    mode: z.enum(GAME_MODES).default("race"),
    /** Zombie rooms: seconds per wave, null for no clock. */
    seconds: z.coerce
      .number()
      .int()
      .refine((n) => (GAME_SECONDS as readonly number[]).includes(n))
      .nullable()
      .default(null),
  })
  .superRefine((v, ctx) => {
    if (v.mode !== "zombie") return;
    if (!(ZOMBIE_LIVES as readonly (number | null)[]).includes(v.lives))
      ctx.addIssue({ code: "custom", path: ["lives"], message: "lives" });
    if (v.types.some((ty) => !(ZOMBIE_TYPES as readonly string[]).includes(ty)))
      ctx.addIssue({ code: "custom", path: ["types"], message: "types" });
    if (v.sameQuestion)
      ctx.addIssue({ code: "custom", path: ["sameQuestion"], message: "rule" });
  });
/** Settings and the mode left out mean "off" and a race. */
export type CreateGameInput = Omit<
  z.infer<typeof CreateGameSchema>,
  keyof GameSettings | "mode" | "seconds"
> &
  Partial<GameSettings> &
  Partial<Pick<z.infer<typeof CreateGameSchema>, "mode" | "seconds">>;

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
