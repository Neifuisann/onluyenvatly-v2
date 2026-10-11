/**
 * Class invite links (B-03): `/join/<code>` adds the signed-in student to the
 * class, and `?bai=<lessonId>` then opens one of its lessons. That is how a
 * teacher shares a lesson: the link carries the class, so whoever opens it
 * lands in a class that has the lesson. Pure, shared by the pages and actions.
 */
import { z } from "zod";

/** No 0/O, 1/I/L: codes are read aloud and typed from a projector. */
export const JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const JOIN_CODE_LENGTH = 8;

/** Largest multiple of the alphabet size below 256 (rejection sampling). */
const UNBIASED_LIMIT =
  Math.floor(256 / JOIN_CODE_ALPHABET.length) * JOIN_CODE_ALPHABET.length;

/**
 * A fresh code: 31^8 ≈ 8.5·10^11 values, uniformly drawn, so guessing one
 * is hopeless at the join rate limit. `randomBytes` is injectable for tests.
 */
export function generateJoinCode(
  randomBytes: (n: number) => Uint8Array = (n) =>
    crypto.getRandomValues(new Uint8Array(n)),
): string {
  let code = "";
  while (code.length < JOIN_CODE_LENGTH) {
    for (const byte of randomBytes(JOIN_CODE_LENGTH * 2)) {
      if (byte >= UNBIASED_LIMIT) continue;
      code += JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length];
      if (code.length === JOIN_CODE_LENGTH) break;
    }
  }
  return code;
}

/** A code as typed or pasted: case and spaces don't matter. */
export const JoinCodeSchema = z
  .string()
  .max(40)
  .transform((s) => s.replace(/[\s-]/g, "").toUpperCase())
  .pipe(
    z
      .string()
      .length(JOIN_CODE_LENGTH)
      .regex(new RegExp(`^[${JOIN_CODE_ALPHABET}]+$`)),
  );

const LessonIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2 ** 53);

/** `?bai=` on a join link; anything unreadable is ignored, not an error. */
export const JoinLessonParamSchema = LessonIdSchema.optional().catch(undefined);

export const JoinClassSchema = z.strictObject({
  code: JoinCodeSchema,
  lessonId: LessonIdSchema.optional(),
});

/** "Chia sẻ" on a lesson: give it to this class and copy the class's link. */
export const ShareLessonSchema = z.strictObject({
  lessonId: LessonIdSchema,
  classId: LessonIdSchema,
});

/** The path a teacher sends: the class, and optionally a lesson in it. */
export function joinPath(code: string, lessonId?: number): string {
  return lessonId ? `/join/${code}?bai=${lessonId}` : `/join/${code}`;
}

/**
 * Where a student goes after joining (or when already in the class): the
 * lesson when the class has it, else the class page.
 */
export function afterJoinPath(
  classId: number,
  lessonId: number | undefined,
  classHasLesson: boolean,
): string {
  return lessonId && classHasLesson
    ? `/lessons/${lessonId}`
    : `/classes/${classId}`;
}
