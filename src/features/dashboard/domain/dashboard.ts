/**
 * Dashboard rules (S4-06, 07 §5.1). Pure: the page hands in what the per-user
 * and cached queries returned.
 */
import type { AttemptAnswer } from "../../../db/schema.ts";
import { isAnswered } from "../../attempts/domain/runner-state.ts";

/** Recommended lesson cards on the dashboard. */
export const RECOMMENDED_COUNT = 4;

/**
 * Lessons I haven't finished yet, in the catalog's order (the teacher's
 * `sort_order`). `lessons` is already filtered to my grade.
 */
export function recommendLessons<T extends { id: number }>(
  lessons: readonly T[],
  doneLessonIds: readonly number[],
  count = RECOMMENDED_COUNT,
): T[] {
  const done = new Set(doneLessonIds);
  return lessons.filter((l) => !done.has(l.id)).slice(0, count);
}

export type ContinueSummary = {
  answered: number;
  total: number;
  /** Whole seconds left, 0 once the deadline passed; null without a limit. */
  secondsLeft: number | null;
};

/** "18/28 câu · còn 21:40" for the in-progress card. */
export function continueSummary(
  answers: readonly AttemptAnswer[],
  deadlineAt: Date | null,
  now: Date,
): ContinueSummary {
  return {
    answered: answers.filter(isAnswered).length,
    total: answers.length,
    secondsLeft: deadlineAt
      ? Math.max(0, Math.floor((deadlineAt.getTime() - now.getTime()) / 1000))
      : null,
  };
}
