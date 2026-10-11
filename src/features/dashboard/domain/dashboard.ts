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
 * `sort_order`), my grade's first (B-03: my classes' lessons, which may mix
 * grades or have none).
 */
export function recommendLessons<
  T extends { id: number; grade: number | null },
>(
  lessons: readonly T[],
  doneLessonIds: readonly number[],
  grade: number | null = null,
  count = RECOMMENDED_COUNT,
): T[] {
  const done = new Set(doneLessonIds);
  const open = lessons.filter((l) => !done.has(l.id));
  const mine = (l: T) => (grade !== null && l.grade === grade ? 0 : 1);
  // Array#sort is stable: within each group the catalog's order stays.
  return [...open].sort((a, b) => mine(a) - mine(b)).slice(0, count);
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
