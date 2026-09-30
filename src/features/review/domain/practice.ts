/**
 * Personalized practice from the mistakes bank (01 R4–R5, Q9; S7-06): which
 * mistakes may be practised, which ones a new set takes, the set's items,
 * answer locking and the instant feedback. Pure.
 */
import type { AttemptAnswer, AttemptItem } from "../../../db/schema.ts";
import { type Rng, shuffle } from "../../attempts/domain/random.ts";
import { type RevealPolicy, revealFor } from "../../attempts/domain/review.ts";
import { revealAt, type Schedule } from "../../attempts/domain/schedule.ts";
import {
  expectedAnswer,
  gradeItem,
  type Outcome,
} from "../../grading/domain/grade.ts";
import { identityOrder } from "../../lessons/domain/public-question.ts";
import { QUESTION_TYPES } from "../../lessons/domain/question-types.ts";
import type { Question, QuestionType } from "../../lessons/schema.ts";

/** Set sizes offered on `/review` (R5: 10–30 questions). */
export const REVIEW_SIZES = [10, 20, 30] as const;
export type ReviewSize = (typeof REVIEW_SIZES)[number];
/** Every practice question is worth the same. */
export const REVIEW_POINTS = 1;
/** Practice grades tf like the exam; a lesson's own scale doesn't apply. */
export const REVIEW_TF_SCORING = "thpt2025" as const;
/** Mistakes read to choose from; a student rarely has more open ones. */
export const MAX_CANDIDATES = 500;

/**
 * A mistake may be practised only when its lesson's result page would show
 * the answer now: practice reveals it after each question (ADR-004).
 */
export function canPractice(
  policy: RevealPolicy,
  lessonRevealAt: Date | null,
  now: Date,
): boolean {
  return revealFor(policy, lessonRevealAt, now, false).kind === "shown";
}

/** `canPractice` for a lesson's stored config (`revealAnswers` + schedule). */
export function lessonAllowsPractice(config: Schedule, now: Date): boolean {
  return canPractice(config.revealAnswers, revealAt(config), now);
}

export type MistakeCandidate = {
  lessonId: number;
  questionId: string;
  versionId: number;
  wrongCount: number;
  updatedAt: Date;
};

/**
 * The questions a new set takes: the most often missed first, then the
 * ones seen longest ago; the chosen ones in random order.
 */
export function pickMistakes<T extends MistakeCandidate>(
  candidates: readonly T[],
  count: number,
  rng: Rng,
): T[] {
  const ordered = [...candidates].sort(
    (a, b) =>
      b.wrongCount - a.wrongCount ||
      a.updatedAt.getTime() - b.updatedAt.getTime(),
  );
  return shuffle(ordered.slice(0, Math.max(0, count)), rng);
}

/**
 * Items of a review attempt: each carries its own version (`v`), mcq options
 * are always shuffled, every question is worth `REVIEW_POINTS`.
 */
export function reviewItems(
  picked: readonly { question: Question; versionId: number }[],
  rng: Rng,
): AttemptItem[] {
  return picked.map(({ question, versionId }) => ({
    q: question.id,
    v: versionId,
    ...(question.type === "mcq" && {
      o: shuffle(identityOrder(question.options.length), rng),
    }),
    p: REVIEW_POINTS,
  }));
}

/**
 * Answers from the browser with the checked ones replaced by what was
 * checked: once the key has been shown, an answer can't change.
 */
export function lockChecked(
  input: readonly AttemptAnswer[],
  stored: readonly AttemptAnswer[],
  checked: readonly number[],
): AttemptAnswer[] {
  const locked = new Set(checked);
  return input.map((a, i) => (locked.has(i) ? (stored[i] ?? null) : a));
}

/** Indexes after checking `index`: unique, ascending. */
export function addChecked(checked: readonly number[], index: number) {
  return [...new Set([...checked, index])].sort((a, b) => a - b);
}

export type PracticeFeedback = {
  outcome: Outcome;
  earned: number;
  max: number;
  /** The key in display terms (the letter this student sees). */
  expected: AttemptAnswer;
};

/** "Kiểm tra": how one answer scores, and the key. */
export function practiceFeedback(
  question: Question,
  item: AttemptItem,
  answer: AttemptAnswer,
): PracticeFeedback {
  const mark = gradeItem(question, item, answer, REVIEW_TF_SCORING);
  return {
    outcome: mark.outcome,
    earned: mark.earned,
    max: mark.max,
    expected: expectedAnswer(question, item),
  };
}

/** Mistakes of one lesson and type, as `getMistakeGroups` reads them. */
export type BankGroup = {
  lessonId: number;
  chapter: string | null;
  questionType: QuestionType | null;
  count: number;
  practicable: boolean;
};

export type BankFilters = {
  chapter: string | null;
  type: QuestionType | null;
};

export type BankSummary = {
  /** Every open mistake. */
  total: number;
  /** Chapters with open mistakes, Vietnamese order, with counts. */
  chapters: { name: string; count: number }[];
  /** Counts per type inside the chosen chapter. */
  types: Record<QuestionType, number>;
  /** Matching the filters. */
  matching: number;
  /** Matching and allowed in practice. */
  practicable: number;
};

export function summarizeBank(
  groups: readonly BankGroup[],
  filters: BankFilters,
): BankSummary {
  const chapters = new Map<string, number>();
  const types: Record<QuestionType, number> = { mcq: 0, tf: 0, short: 0 };
  let total = 0;
  let matching = 0;
  let practicable = 0;
  for (const g of groups) {
    total += g.count;
    if (g.chapter)
      chapters.set(g.chapter, (chapters.get(g.chapter) ?? 0) + g.count);
    if (filters.chapter && g.chapter !== filters.chapter) continue;
    if (g.questionType) types[g.questionType] += g.count;
    if (filters.type && g.questionType !== filters.type) continue;
    matching += g.count;
    if (g.practicable) practicable += g.count;
  }
  const vi = new Intl.Collator("vi").compare;
  return {
    total,
    chapters: [...chapters]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => vi(a.name, b.name)),
    types,
    matching,
    practicable,
  };
}

/** Pages of 20 on `/review`, cumulative ("Xem thêm"), at most 10 steps. */
export const BANK_PAGE_SIZE = 20;
export const BANK_MAX_PAGES = 10;

export type ReviewParams = BankFilters & { page: number };

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() || null;

/** `/review?chapter=&type=&page=`; anything invalid means "no filter". */
export function parseReviewParams(
  params: Record<string, string | string[] | undefined>,
): ReviewParams {
  const chapter = first(params.chapter);
  const type = first(params.type);
  const page = Number(first(params.page));
  return {
    chapter: chapter && chapter.length <= 100 ? chapter : null,
    type: QUESTION_TYPES.includes(type as QuestionType)
      ? (type as QuestionType)
      : null,
    page:
      Number.isInteger(page) && page >= 1 ? Math.min(page, BANK_MAX_PAGES) : 1,
  };
}

/** A `/review` URL with some params changed; a new filter starts at page 1. */
export function reviewHref(
  params: ReviewParams,
  patch: Partial<ReviewParams>,
): string {
  const next = { ...params, page: 1, ...patch };
  const query = new URLSearchParams();
  if (next.chapter) query.set("chapter", next.chapter);
  if (next.type) query.set("type", next.type);
  if (next.page > 1) query.set("page", String(next.page));
  const s = query.toString();
  return s ? `/review?${s}` : "/review";
}
