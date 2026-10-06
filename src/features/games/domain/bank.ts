/**
 * The race's question bank and each player's path through it. Pure.
 *
 * The bank is drawn once, when the teacher creates the room: a random sample
 * of the chosen lessons' published questions. Every player answers the same
 * bank, in an order and with mcq options shuffled from their own seed, so
 * neighbours can't copy "the third answer is C".
 */
import type { AttemptItem } from "../../../db/schema.ts";
import { type Rng, shuffle } from "../../attempts/domain/random.ts";
import type { Schedule } from "../../attempts/domain/schedule.ts";
import { identityOrder } from "../../lessons/domain/public-question.ts";
import type { Question, QuestionType } from "../../lessons/schema.ts";
import { lessonAllowsPractice } from "../../review/domain/practice.ts";

/**
 * A race shows the key after every answer, so it may only use a lesson
 * whose result page would show it now (ADR-004), and never a scheduled test
 * before it opens: the class would see the exam first.
 */
export function lessonAllowsGame(config: Schedule, now: Date): boolean {
  const start = config.startsAt ? Date.parse(config.startsAt) : Number.NaN;
  if (start > now.getTime()) return false;
  return lessonAllowsPractice(config, now);
}

/** One bank question: lesson, version and question id. */
export type BankItem = { l: number; v: number; q: string };

export type BankCandidate = {
  lessonId: number;
  versionId: number;
  question: Question;
};

/**
 * `count` questions of the allowed types, sampled uniformly across every
 * candidate. Fewer when the lessons don't have enough.
 */
export function drawBank(
  candidates: readonly BankCandidate[],
  types: readonly QuestionType[],
  count: number,
  rng: Rng,
): BankItem[] {
  const allowed = new Set(types);
  const pool = candidates.filter((c) => allowed.has(c.question.type));
  return shuffle(pool, rng)
    .slice(0, Math.max(0, count))
    .map((c) => ({ l: c.lessonId, v: c.versionId, q: c.question.id }));
}

/** Counts per type among the candidates, for the create form's preview. */
export function countTypes(questions: readonly Pick<Question, "type">[]) {
  const counts: Record<QuestionType, number> = { mcq: 0, tf: 0, short: 0 };
  for (const q of questions) counts[q.type] += 1;
  return counts;
}

export type PlayerPlan = {
  /** Bank indexes in the order this player meets them. */
  order: number[];
  /** Per bank index: the mcq option order (original indexes in display order). */
  options: (number[] | undefined)[];
};

/**
 * A player's order and option shuffles from their seed. Deterministic: the
 * page and the answer handler rebuild the same plan without storing it.
 * `optionCounts[i]` is the bank question's option count (0 for tf/short).
 */
export function playerPlan(
  optionCounts: readonly number[],
  rng: Rng,
): PlayerPlan {
  const order = shuffle(identityOrder(optionCounts.length), rng);
  const options = optionCounts.map((n) =>
    n > 0 ? shuffle(identityOrder(n), rng) : undefined,
  );
  return { order, options };
}

/** The attempt-style item `gradeItem` expects for one bank question. */
export function gradingItem(
  bankItem: BankItem,
  options: number[] | undefined,
): AttemptItem {
  return { q: bankItem.q, ...(options && { o: options }), p: 1 };
}

/** Option count per question, aligned with the bank (0 unless mcq). */
export function optionCounts(questions: readonly Question[]): number[] {
  return questions.map((q) => (q.type === "mcq" ? q.options.length : 0));
}
