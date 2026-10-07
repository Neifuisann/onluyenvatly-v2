/**
 * Builds an attempt's items at start (ADR-004): which questions, in which
 * order, with which option order and how many points. Pure and seeded.
 */
import type { AttemptItem } from "../../../db/schema.ts";
import { pointsPlan } from "../../grading/domain/points.ts";
import { identityOrder } from "../../lessons/domain/public-question.ts";
import {
  countByType,
  liveQuestions,
  poolTypeCounts,
} from "../../lessons/domain/summary.ts";
import {
  type LessonConfig,
  QUESTION_TYPES,
  type Question,
} from "../../lessons/schema.ts";
import { type Rng, shuffle } from "./random.ts";

export type ItemsConfig = Pick<
  LessonConfig,
  "pool" | "shuffleQuestions" | "shuffleOptions" | "points"
>;

/**
 * Pool selection: `poolTypeCounts` decides how many of each type; which ones
 * is random. The chosen questions keep the teacher's order.
 */
export function selectQuestions(
  questions: readonly Question[],
  pool: LessonConfig["pool"],
  rng: Rng,
): Question[] {
  if (!pool.enabled) return [...questions];
  const counts = poolTypeCounts(countByType(questions), pool);
  const chosen = new Set<Question>();
  for (const type of QUESTION_TYPES) {
    const ofType = questions.filter((q) => q.type === type);
    for (const q of shuffle(ofType, rng).slice(0, counts[type])) chosen.add(q);
  }
  return questions.filter((q) => chosen.has(q));
}

/**
 * Question shuffle as in v1: shuffled within each type, then grouped
 * mcq → tf → short, the THPT exam layout.
 */
export function orderQuestions(
  questions: readonly Question[],
  shuffleQuestions: boolean,
  rng: Rng,
): Question[] {
  if (!shuffleQuestions) return [...questions];
  return QUESTION_TYPES.flatMap((type) =>
    shuffle(
      questions.filter((q) => q.type === type),
      rng,
    ),
  );
}

export function buildItems(
  questions: readonly Question[],
  config: ItemsConfig,
  rng: Rng,
): AttemptItem[] {
  const ordered = orderQuestions(
    // Removed questions (B-10) stay only for the attempts that have them.
    selectQuestions(liveQuestions(questions), config.pool, rng),
    config.shuffleQuestions,
    rng,
  );
  const points = pointsPlan(ordered, config.points);
  return ordered.map((q, i) => ({
    q: q.id,
    ...(q.type === "mcq" &&
      config.shuffleOptions && {
        o: shuffle(identityOrder(q.options.length), rng),
      }),
    // `pointsPlan` returns one entry per question.
    p: points[i] as number,
  }));
}

/** The item's question, looked up by id in its version's questions. */
export function questionsForItems(
  items: readonly AttemptItem[],
  byId: ReadonlyMap<string, Question>,
): Question[] {
  return items.map((item) => {
    const q = byId.get(item.q);
    if (!q) throw new Error(`Question ${item.q} is missing from its version`);
    return q;
  });
}
