/**
 * Admin dashboard rules (S6-06). Pure: Vietnam-day windows, zero-filled
 * daily counts and the "hardest questions" ranking. Vietnam has no daylight
 * saving time, so a Vietnam day is always [00:00, 24:00) at UTC+7.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Days in the attempts chart. */
export const CHART_DAYS = 30;
/** "This week": the last 7 Vietnam days, today included. */
export const WEEK_DAYS = 7;
/** A question needs this many answers this week to be ranked. */
export const HARDEST_MIN_ANSWERS = 5;
export const HARDEST_LIMIT = 5;

/** `YYYY-MM-DD` of the Vietnam day `date` falls in. */
export function vnDayKey(date: Date): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The last `days` Vietnam days up to and including today's: their keys,
 * oldest first, and the instant the first one starts.
 */
export function vnWindow(
  now: Date,
  days: number,
): { since: Date; keys: string[] } {
  const todayStart =
    Math.floor((now.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS;
  const since = todayStart - (days - 1) * DAY_MS;
  return {
    since: new Date(since),
    keys: Array.from({ length: days }, (_, i) =>
      vnDayKey(new Date(since + i * DAY_MS)),
    ),
  };
}

export type DayCount = { day: string; count: number };

/** One entry per key (days without attempts are 0), in key order. */
export function fillDays(
  keys: readonly string[],
  counts: Readonly<Record<string, number>>,
): DayCount[] {
  return keys.map((day) => ({ day, count: Number(counts[day] ?? 0) }));
}

/** Sum of the last `n` days. */
export function sumLastDays(days: readonly DayCount[], n: number): number {
  return days.slice(-n).reduce((s, d) => s + d.count, 0);
}

/** `28/09` from `2026-09-28`. */
export function formatDayMonth(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

export type HardQuestionRow = {
  lessonId: number;
  lessonTitle: string;
  questionId: string;
  /** The newest version these answers came from (the stats page link). */
  versionId: number;
  /** 1-based position in that version, null if the question left it. */
  position: number | null;
  answers: number;
  fullMarks: number;
};

export type HardQuestion = HardQuestionRow & { fullMarksRate: number };

/**
 * Lowest full-marks rate first, then the most answered, then a stable
 * order; only questions with enough answers, top 5.
 */
export function rankHardest(rows: readonly HardQuestionRow[]): HardQuestion[] {
  return rows
    .filter((r) => r.answers >= HARDEST_MIN_ANSWERS)
    .map((r) => ({ ...r, fullMarksRate: r.fullMarks / r.answers }))
    .sort(
      (a, b) =>
        a.fullMarksRate - b.fullMarksRate ||
        b.answers - a.answers ||
        a.lessonId - b.lessonId ||
        a.questionId.localeCompare(b.questionId),
    )
    .slice(0, HARDEST_LIMIT);
}
