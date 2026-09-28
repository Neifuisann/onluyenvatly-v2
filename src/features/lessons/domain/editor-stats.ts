/**
 * The editor's stats bar (S5-02, 07 §5.6): "Tổng: 28 câu · 18/4/6 · 10đ".
 * Pure; uses the same points plan and pool rules as attempts.
 */
import { pointsPlan, toCents } from "../../grading/domain/points.ts";
import { type LessonConfig, QUESTION_TYPES, type Question } from "../schema.ts";
import { countByType, poolTypeCounts, type TypeCounts } from "./summary.ts";

export type EditorStats = {
  counts: TypeCounts;
  total: number;
  /** Sum of every question's points, all questions taken. */
  points: number;
  /** What one attempt gets when the pool is on; null when it's off. */
  perAttempt: {
    counts: TypeCounts;
    total: number;
    /** null when it depends on which questions are drawn. */
    points: number | null;
  } | null;
};

export function editorStats(
  questions: readonly Question[],
  config: Pick<LessonConfig, "pool" | "points">,
): EditorStats {
  const counts = countByType(questions);
  const total = questions.length;
  const plan = pointsPlan(questions, config.points);
  const points = plan.reduce((s, p) => s + toCents(p), 0) / 100;
  if (!config.pool.enabled) return { counts, total, points, perAttempt: null };

  const drawn = poolTypeCounts(counts, config.pool);
  let cents: number | null = 0;
  for (const type of QUESTION_TYPES) {
    const k = drawn[type];
    if (k === 0 || cents === null) continue;
    const typeTotal =
      config.points.mode === "per-type-total" ? config.points[type] : undefined;
    if (typeTotal !== undefined) {
      cents += toCents(typeTotal);
      continue;
    }
    const own = questions
      .filter((q) => q.type === type)
      .map((q) => toCents(q.points ?? 1));
    if (k === own.length) cents += own.reduce((s, c) => s + c, 0);
    else if (own.every((c) => c === own[0])) cents += k * (own[0] ?? 0);
    else cents = null;
  }
  return {
    counts,
    total,
    points,
    perAttempt: {
      counts: drawn,
      total: QUESTION_TYPES.reduce((s, t) => s + drawn[t], 0),
      points: cents === null ? null : cents / 100,
    },
  };
}
