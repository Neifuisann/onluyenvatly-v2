/**
 * Points plan (04 §4): how much each selected question is worth. Money-style
 * integer cents, so totals are exact.
 */
import type {
  LessonConfig,
  Question,
  QuestionType,
} from "../../lessons/schema.ts";

export const toCents = (x: number) => Math.round(x * 100 + 1e-9);

/** Half-up rounding to 2 decimals that survives float noise (0.025 → 0.03). */
export const round2 = (x: number) => toCents(x) / 100;

/**
 * v1 remainder-cent algorithm: every question gets the floor share, and the
 * first ones get one extra cent until the total is exact. 1.00 over 3 →
 * [0.34, 0.33, 0.33].
 */
export function distributePoints(total: number, count: number): number[] {
  if (count <= 0) return [];
  const cents = toCents(total);
  const base = Math.floor(cents / count);
  const extra = cents - base * count;
  return Array.from({ length: count }, (_, i) =>
    i < extra ? (base + 1) / 100 : base / 100,
  );
}

/**
 * Points per question, aligned with `questions` (the selected questions in
 * display order).
 * - `per-question`: the question's own `[x pts]`, else 1.
 * - `per-type-total`: each type's total split over that type's questions in
 *   display order. A type without a total falls back to per-question points.
 */
export function pointsPlan(
  questions: readonly Question[],
  points: LessonConfig["points"],
): number[] {
  const own = (q: Question) => q.points ?? 1;
  if (points.mode === "per-question") return questions.map(own);

  const shares = new Map<QuestionType, number[]>();
  for (const type of ["mcq", "tf", "short"] as const) {
    const total = points[type];
    if (total === undefined) continue;
    const n = questions.filter((q) => q.type === type).length;
    shares.set(type, distributePoints(total, n));
  }
  const seen: Record<QuestionType, number> = { mcq: 0, tf: 0, short: 0 };
  return questions.map((q) => {
    const share = shares.get(q.type);
    if (!share) return own(q);
    const i = seen[q.type]++;
    return share[i] ?? 0;
  });
}
