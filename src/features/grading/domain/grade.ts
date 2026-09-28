/**
 * Server-side grading (ADR-004, 04 §4). Pure: questions, items and answers in,
 * marks out. The client only ever sends what it displayed (a letter, booleans,
 * text); the stored option order maps letters back to the original options.
 */
import type { AttemptAnswer, AttemptItem } from "../../../db/schema.ts";
import type { LessonConfig, Question } from "../../lessons/schema.ts";
import { round2, toCents } from "./points.ts";
import { shortAnswerMatches } from "./short-answer.ts";

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export type Outcome = "correct" | "partial" | "wrong" | "blank";
export type ItemMark = { earned: number; max: number; outcome: Outcome };
export type TfScoring = LessonConfig["tfScoring"];

/** THPT 2025: share of the points for k correct statements out of 4. */
const THPT_TF = [0, 0.1, 0.25, 0.5, 1] as const;

export function tfShare(correct: number, total: number, scoring: TfScoring) {
  if (total <= 0) return 0;
  if (scoring === "thpt2025" && total === 4) return THPT_TF[correct] ?? 0;
  return correct / total;
}

/** Original option index for a displayed letter, or null if it isn't one. */
export function originalOption(
  letter: unknown,
  item: Pick<AttemptItem, "o">,
  optionCount: number,
): number | null {
  if (typeof letter !== "string") return null;
  const shown = OPTION_LETTERS.indexOf(
    letter as (typeof OPTION_LETTERS)[number],
  );
  if (shown < 0 || shown >= optionCount) return null;
  return item.o ? (item.o[shown] ?? null) : shown;
}

export function isBlank(answer: unknown): boolean {
  if (answer === null || answer === undefined) return true;
  if (typeof answer === "string") return answer.trim() === "";
  if (Array.isArray(answer)) return answer.every((a) => a === null);
  return false;
}

function mark(max: number, share: number, blank = false): ItemMark {
  const earned = round2(max * share);
  let outcome: Outcome = "partial";
  if (share >= 1) outcome = "correct";
  else if (share <= 0) outcome = blank ? "blank" : "wrong";
  return { earned, max, outcome };
}

/** Grades one item. Malformed answers score 0, as wrong answers. */
export function gradeItem(
  q: Question,
  item: AttemptItem,
  answer: unknown,
  tfScoring: TfScoring,
): ItemMark {
  const max = item.p;
  if (isBlank(answer)) return mark(max, 0, true);
  switch (q.type) {
    case "mcq":
      return mark(
        max,
        originalOption(answer, item, q.options.length) === q.answer ? 1 : 0,
      );
    case "tf": {
      if (!Array.isArray(answer)) return mark(max, 0);
      // An unanswered statement counts as wrong.
      const k = q.statements.filter((s, i) => answer[i] === s.answer).length;
      return mark(max, tfShare(k, q.statements.length, tfScoring));
    }
    case "short":
      return mark(
        max,
        typeof answer === "string" &&
          shortAnswerMatches(answer, q.answer, q.tolerance)
          ? 1
          : 0,
      );
  }
}

export type GradeResult = {
  marks: ItemMark[];
  /** `earned` per item, for `attempts.earned`. */
  earned: number[];
  score: number;
  maxScore: number;
  /** score / maxScore × 10, 2 decimals. */
  score10: number;
};

/**
 * @param questions aligned with `items` (the question each item points to).
 * @param answers aligned with `items`; missing entries are blank.
 */
export function grade(
  questions: readonly Question[],
  items: readonly AttemptItem[],
  answers: readonly unknown[],
  tfScoring: TfScoring,
): GradeResult {
  if (questions.length !== items.length)
    throw new Error("questions and items must be aligned");
  const marks = items.map((item, i) => {
    const q = questions[i];
    if (!q || q.id !== item.q)
      throw new Error(`Item ${i} does not match question ${item.q}`);
    return gradeItem(q, item, answers[i], tfScoring);
  });
  return summarize(marks);
}

export function summarize(marks: readonly ItemMark[]): GradeResult {
  const score = marks.reduce((s, m) => s + toCents(m.earned), 0) / 100;
  const maxScore = marks.reduce((s, m) => s + toCents(m.max), 0) / 100;
  return {
    marks: [...marks],
    earned: marks.map((m) => m.earned),
    score,
    maxScore,
    score10: maxScore > 0 ? round2((score / maxScore) * 10) : 0,
  };
}

/** The answer a student would give to score full marks, in display terms. */
export function expectedAnswer(q: Question, item: AttemptItem): AttemptAnswer {
  switch (q.type) {
    case "mcq": {
      const shown = item.o ? item.o.indexOf(q.answer) : q.answer;
      return OPTION_LETTERS[shown] ?? null;
    }
    case "tf":
      return q.statements.map((s) => s.answer);
    case "short":
      return q.answer;
  }
}
