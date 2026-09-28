import { z } from "zod";
import { LessonIdSchema } from "@/features/lessons/domain/lesson-params";

/** Attempt ids are UUIDs; reject anything else before it reaches SQL. */
export const AttemptIdSchema = z.uuid();

/** `startAttempt` form: the lesson id arrives as a string. */
export const StartAttemptSchema = z.object({ lessonId: LessonIdSchema });
