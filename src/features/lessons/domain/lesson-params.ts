import { z } from "zod";

// Drizzle exposes bigint ids as numbers; reject unsafe integers before SQL.
export const LessonIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));
export const LegacyLessonIdSchema = z.string().min(1).max(100);
