/**
 * How many questions of each type a student gets, after pool selection. Feeds
 * the denormalized `lessons.question_count` / `type_counts` (card text such as
 * "28 câu") and, from S3-02, the pool selection itself.
 */
import {
  type LessonConfig,
  QUESTION_TYPES,
  type Question,
  type QuestionType,
} from "../schema.ts";

export type TypeCounts = Record<QuestionType, number>;

/** The questions a new attempt can get: all but the removed ones (B-10). */
export function liveQuestions<Q extends Pick<Question, "removed">>(
  questions: readonly Q[],
): Q[] {
  return questions.filter((q) => !q.removed);
}

export function countByType(questions: readonly Question[]): TypeCounts {
  const counts: TypeCounts = { mcq: 0, tf: 0, short: 0 };
  for (const q of liveQuestions(questions)) counts[q.type] += 1;
  return counts;
}

/**
 * - pool off: everything;
 * - `byType`: that many of each type (capped by what exists; unlisted types
 *   get none, as in v1);
 * - `size`: split proportionally with the largest-remainder method, so the
 *   total is exactly `size` (v1 rounded per type and topped up at random).
 */
export function poolTypeCounts(
  available: TypeCounts,
  pool: LessonConfig["pool"],
): TypeCounts {
  if (!pool.enabled) return { ...available };
  const byType = pool.byType;
  if (byType && QUESTION_TYPES.some((t) => (byType[t] ?? 0) > 0)) {
    const out: TypeCounts = { mcq: 0, tf: 0, short: 0 };
    for (const t of QUESTION_TYPES)
      out[t] = Math.min(byType[t] ?? 0, available[t]);
    return out;
  }
  const total = QUESTION_TYPES.reduce((s, t) => s + available[t], 0);
  const size = pool.size ?? total;
  if (size >= total) return { ...available };

  const out: TypeCounts = { mcq: 0, tf: 0, short: 0 };
  const remainders = QUESTION_TYPES.map((t) => {
    const quota = (size * available[t]) / total;
    out[t] = Math.floor(quota);
    return { t, frac: quota - out[t] };
  });
  let left = size - QUESTION_TYPES.reduce((s, t) => s + out[t], 0);
  // Stable sort keeps mcq → tf → short order on ties.
  remainders.sort((a, b) => b.frac - a.frac);
  for (const { t } of remainders) {
    if (left === 0) break;
    if (out[t] < available[t]) {
      out[t] += 1;
      left -= 1;
    }
  }
  return out;
}

/** Values for `lessons.question_count` and `lessons.type_counts` (zeros omitted). */
export function summarizeLesson(
  questions: readonly Question[],
  config: Pick<LessonConfig, "pool">,
): { questionCount: number; typeCounts: Partial<TypeCounts> } {
  const counts = poolTypeCounts(countByType(questions), config.pool);
  const typeCounts: Partial<TypeCounts> = {};
  let questionCount = 0;
  for (const t of QUESTION_TYPES) {
    if (counts[t] > 0) typeCounts[t] = counts[t];
    questionCount += counts[t];
  }
  return { questionCount, typeCounts };
}
