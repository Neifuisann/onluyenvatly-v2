import { z } from "zod";

const index = z.number().int().min(0).max(2000);

/** `POST /api/attempts/[id]/game`: one move of a zombie game (B-11). */
export const GameMoveSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("begin") }),
  z.strictObject({
    kind: z.literal("shoot"),
    wave: index,
    lane: z.number().int().min(0).max(5),
  }),
  z.strictObject({ kind: z.literal("timeout"), wave: index }),
]);
export type GameMove = z.infer<typeof GameMoveSchema>;

/** A move is a few dozen bytes. */
export const MAX_MOVE_BYTES = 256;
