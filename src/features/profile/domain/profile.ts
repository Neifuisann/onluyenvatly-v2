/**
 * Profile rules (S4-07, 01 R7). Pure: accuracy breakdowns, the streak of
 * active days and history paging, from plain rows.
 */
import { z } from "zod";
import type { QuestionType } from "../../lessons/schema.ts";

/** Attempts per "Xem thêm" step in the history list. */
export const HISTORY_PAGE_SIZE = 20;
export const MAX_HISTORY_PAGE = 25;

/** Accuracy is computed over the latest submitted tests. */
export const ACCURACY_WINDOW = 100;

/** One (type, chapter) group from the accuracy query. */
export type AccuracyRow = {
  type: string | null;
  chapter: string | null;
  questions: number;
  earned: number;
  points: number;
};

export type AccuracyEntry<K> = {
  key: K;
  questions: number;
  /** 0..1 share of the points earned. */
  accuracy: number;
};

const QUESTION_TYPES: readonly QuestionType[] = ["mcq", "tf", "short"];

function group<K>(
  rows: readonly AccuracyRow[],
  keyOf: (r: AccuracyRow) => K | null,
): AccuracyEntry<K>[] {
  const sums = new Map<
    K,
    { questions: number; earned: number; points: number }
  >();
  for (const r of rows) {
    const key = keyOf(r);
    if (key === null) continue;
    const s = sums.get(key) ?? { questions: 0, earned: 0, points: 0 };
    s.questions += r.questions;
    s.earned += r.earned;
    s.points += r.points;
    sums.set(key, s);
  }
  return [...sums].map(([key, s]) => ({
    key,
    questions: s.questions,
    accuracy: s.points > 0 ? Math.min(1, Math.max(0, s.earned / s.points)) : 0,
  }));
}

/**
 * Accuracy per question type (fixed order) and per chapter, weakest first so
 * what to review comes up top (07 §1 "cần ôn").
 */
export function accuracyBreakdown(rows: readonly AccuracyRow[]) {
  const byType = group(rows, (r) =>
    QUESTION_TYPES.includes(r.type as QuestionType)
      ? (r.type as QuestionType)
      : null,
  ).sort(
    (a, b) => QUESTION_TYPES.indexOf(a.key) - QUESTION_TYPES.indexOf(b.key),
  );
  const vi = new Intl.Collator("vi").compare;
  const byChapter = group(rows, (r) => r.chapter).sort(
    (a, b) => a.accuracy - b.accuracy || vi(a.key, b.key),
  );
  return { byType, byChapter };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (key: string, n: number) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);

/**
 * Consecutive days with a submitted test, ending today, or yesterday when
 * today has none yet (the streak isn't broken until the day is over).
 * `days` are `YYYY-MM-DD` keys in Vietnam time, any order.
 */
export function activeStreak(days: readonly string[], today: string): number {
  const set = new Set(days);
  let day = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

/** `?page=` of `/profile` (cumulative "Xem thêm"). Never throws. */
export function parseHistoryPage(
  params: Record<string, string | string[] | undefined>,
): number {
  const raw = Array.isArray(params.page) ? params.page[0] : params.page;
  return z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_HISTORY_PAGE)
    .catch(1)
    .parse(raw ?? 1);
}
