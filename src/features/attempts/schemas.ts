import { z } from "zod";
import { LessonIdSchema } from "@/features/lessons/domain/lesson-params";

/** `startAttempt` form: the lesson id arrives as a string. */
export const StartAttemptSchema = z.object({ lessonId: LessonIdSchema });
