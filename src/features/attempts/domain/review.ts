/**
 * What a result page may show (ADR-004, 06 §2) and the per-question review
 * built from the stored marks. Pure.
 */
import type { AttemptAnswer, AttemptItem } from "../../../db/schema.ts";
import {
  expectedAnswer,
  isBlank,
  type Outcome,
} from "../../grading/domain/grade.ts";
import { toCents } from "../../grading/domain/points.ts";
import type { LessonConfig, Question } from "../../lessons/schema.ts";

export type RevealPolicy = LessonConfig["revealAnswers"];

export type Reveal =
  | { kind: "shown" }
  /** after_deadline: shown once the shared exam window has closed. */
  | { kind: "later"; at: Date }
  | { kind: "never" };

/**
 * Answers, explanations and per-question marks are shown together or not at
 * all: right/wrong marks alone would give mcq answers away for a retake.
 * Hidden, the student still sees each question, their choice and the total.
 *
 * `after_deadline` opens at the lesson's `revealAt` (schedule.ts:
 * startsAt + time limit + 30 s); without one (not scheduled) it stays hidden.
 * Admins always see everything.
 */
export function revealFor(
  policy: RevealPolicy,
  lessonRevealAt: Date | null,
  now: Date,
  isAdmin: boolean,
): Reveal {
  if (isAdmin || policy === "after_submit") return { kind: "shown" };
  if (policy === "never" || !lessonRevealAt) return { kind: "never" };
  return now >= lessonRevealAt
    ? { kind: "shown" }
    : { kind: "later", at: lessonRevealAt };
}

/** Outcome from the stored mark (the grade at submit time is the truth). */
export function outcomeOf(
  earned: number,
  max: number,
  answer: unknown,
): Outcome {
  if (toCents(earned) >= toCents(max) && max > 0) return "correct";
  if (isBlank(answer)) return "blank";
  return toCents(earned) > 0 ? "partial" : "wrong";
}

export type ReviewEntry = {
  /** 0-based position in the test. */
  index: number;
  question: Question;
  item: AttemptItem;
  earned: number;
  outcome: Outcome;
  /** In display terms (the letter the student saw). */
  given: AttemptAnswer;
  expected: AttemptAnswer;
};

/**
 * One entry per item, in test order.
 * @param questions WITH answers; only call after `revealFor` said "shown".
 *   The version's questions by id, or (review attempts, whose items span
 *   lessons, S7-06) the questions aligned with `items`.
 */
export function buildReview(
  items: readonly AttemptItem[],
  answers: readonly AttemptAnswer[],
  earned: readonly number[] | null,
  questions: ReadonlyMap<string, Question> | readonly Question[],
): ReviewEntry[] {
  return items.map((item, index) => {
    const found =
      questions instanceof Map
        ? questions.get(item.q)
        : (questions as readonly Question[])[index];
    const question = found?.id === item.q ? found : undefined;
    if (!question) throw new Error(`Question ${item.q} missing from version`);
    const given = answers[index] ?? null;
    const mark = earned?.[index] ?? 0;
    return {
      index,
      question,
      item,
      earned: mark,
      outcome: outcomeOf(mark, item.p, given),
      given,
      expected: expectedAnswer(question, item),
    };
  });
}

export type ReviewFilter = "all" | "wrong" | "right";

/** "Sai" lists anything short of full marks, blanks included. */
export function matchesFilter(outcome: Outcome, filter: ReviewFilter) {
  if (filter === "all") return true;
  return (outcome === "correct") === (filter === "right");
}

export function countOutcomes(entries: readonly { outcome: Outcome }[]) {
  const right = entries.filter((e) => e.outcome === "correct").length;
  return { all: entries.length, right, wrong: entries.length - right };
}

/** Items with full marks; needs only the stored marks, never the answers. */
export function correctCount(
  items: readonly Pick<AttemptItem, "p">[],
  earned: readonly number[] | null,
): number {
  return items.filter(
    (item, i) => item.p > 0 && toCents(earned?.[i] ?? 0) >= toCents(item.p),
  ).length;
}
