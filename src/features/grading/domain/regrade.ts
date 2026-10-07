/**
 * Regrading after a correction (B-10). Pure. Only the items whose question
 * changed are graded again; every other item keeps its stored mark, so a
 * fix to question 3 never moves points on question 7 (migrated v1 marks
 * included).
 */
import type { AttemptAnswer, AttemptItem } from "../../../db/schema.ts";
import type { Question } from "../../lessons/schema.ts";
import { gradeItem, type TfScoring } from "./grade.ts";
import { round2, toCents } from "./points.ts";

export type RegradeInput = {
  items: readonly AttemptItem[];
  answers: readonly AttemptAnswer[];
  /** null until the attempt is graded (in progress). */
  earned: readonly number[] | null;
};

export type Regraded = {
  items: AttemptItem[];
  earned: number[] | null;
  score: number | null;
  maxScore: number;
  score10: number | null;
};

/**
 * @param questions the corrected version's questions, by id.
 * @param changed question ids whose content changed.
 * @param points new item points per question id (removed → 0).
 * @returns null when nothing about this attempt changes.
 */
export function regradeAttempt(
  a: RegradeInput,
  questions: ReadonlyMap<string, Question>,
  changed: ReadonlySet<string>,
  points: ReadonlyMap<string, number>,
  tfScoring: TfScoring,
): Regraded | null {
  if (!a.items.some((item) => changed.has(item.q))) return null;
  const items = a.items.map((item) => {
    const p = points.get(item.q);
    return p === undefined || !changed.has(item.q) ? item : { ...item, p };
  });
  const repriced = items.some((item, i) => item !== a.items[i]);
  const maxScore = items.reduce((s, i) => s + toCents(i.p), 0) / 100;
  if (!a.earned)
    return repriced
      ? { items, earned: null, score: null, maxScore, score10: null }
      : null;

  const earned = items.map((item, i) => {
    const q = questions.get(item.q);
    if (!changed.has(item.q) || !q) return a.earned?.[i] ?? 0;
    return gradeItem(q, item, a.answers[i] ?? null, tfScoring).earned;
  });
  // A text-only fix (a typo in the stem) moves no mark: nothing to write.
  const remarked = earned.some(
    (e, i) => toCents(e) !== toCents(a.earned?.[i] ?? 0),
  );
  if (!repriced && !remarked) return null;
  const score = earned.reduce((s, e) => s + toCents(e), 0) / 100;
  return {
    items,
    earned,
    score,
    maxScore,
    score10: maxScore > 0 ? round2((score / maxScore) * 10) : 0,
  };
}
