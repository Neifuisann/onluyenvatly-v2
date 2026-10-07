/**
 * "Tạo từ bài có sẵn" (S5-07): a review lesson drawn at random from other
 * lessons' questions, a set number of each type. Pure: the service reads
 * the source questions and writes the draft; the RNG is injected for tests.
 */
import { z } from "zod";
import { composeCopy as M } from "../messages.ts";
import {
  MAX_QUESTIONS,
  QUESTION_TYPES,
  type Question,
  type QuestionType,
} from "../schema.ts";
import { LessonIdSchema } from "./admin-list.ts";
import { stemKey } from "./parser.ts";
import type { TypeCounts } from "./summary.ts";

/** A lesson to draw from, with its questions per type (`getComposeSources`). */
export type ComposeSource = TypeCounts & {
  id: number;
  title: string;
  status: "draft" | "published" | "archived";
  grade: number | null;
};

/** How many source lessons one review lesson may draw from. */
export const MAX_COMPOSE_SOURCES = 60;

const typeCount = z.number().int().min(0).max(MAX_QUESTIONS);

export const ComposeSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  lessonIds: z
    .array(LessonIdSchema)
    .min(1)
    .max(MAX_COMPOSE_SOURCES)
    .refine((ids) => new Set(ids).size === ids.length),
  counts: z
    .strictObject({ mcq: typeCount, tf: typeCount, short: typeCount })
    .refine((c) => {
      const total = composeTotal(c);
      return total >= 1 && total <= MAX_QUESTIONS;
    }),
});
export type ComposeInput = z.infer<typeof ComposeSchema>;

export function composeTotal(counts: TypeCounts): number {
  return QUESTION_TYPES.reduce((sum, t) => sum + counts[t], 0);
}

/** Questions per type summed over the chosen lessons. */
export function sumCounts(rows: readonly TypeCounts[]): TypeCounts {
  const out: TypeCounts = { mcq: 0, tf: 0, short: 0 };
  for (const row of rows) for (const t of QUESTION_TYPES) out[t] += row[t];
  return out;
}

/** Why `counts` can't be drawn from `available`, or null. */
export function composeProblem(
  counts: TypeCounts,
  available: TypeCounts,
): string | null {
  const total = composeTotal(counts);
  if (total === 0) return M.noneWanted;
  if (total > MAX_QUESTIONS) return M.tooMany(MAX_QUESTIONS);
  for (const t of QUESTION_TYPES)
    if (counts[t] > available[t])
      return M.notEnough(t, counts[t], available[t]);
  return null;
}

/**
 * The same question copied into several lessons counts once: equal type and
 * stem (case, spacing and accents ignored). The first copy is kept.
 */
export function uniqueQuestions(questions: readonly Question[]): Question[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    // Image-only stems differ by their picture, not by their (empty) text.
    const key = `${q.type}\u0000${stemKey(q.stem)}\u0000${q.image?.path ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Fisher–Yates on a copy; `random` returns [0, 1). */
export function shuffled<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export type PickResult =
  | { ok: true; questions: Question[] }
  | { ok: false; message: string };

/**
 * `counts[type]` questions of each type, drawn without repeats from
 * `questions` (duplicates removed first). Grouped multiple choice →
 * true/false → short answer, the order of the national exam's three parts.
 */
export function pickQuestions(
  questions: readonly Question[],
  counts: TypeCounts,
  random: () => number = Math.random,
): PickResult {
  const pool = uniqueQuestions(questions);
  const byType = (t: QuestionType) => pool.filter((q) => q.type === t);
  const available: TypeCounts = {
    mcq: byType("mcq").length,
    tf: byType("tf").length,
    short: byType("short").length,
  };
  const problem = composeProblem(counts, available);
  if (problem) return { ok: false, message: problem };
  return {
    ok: true,
    questions: QUESTION_TYPES.flatMap((t) =>
      shuffled(byType(t), random).slice(0, counts[t]),
    ),
  };
}

/** The default title: the only source's name, else a count of them. */
export function composeTitle(sources: readonly { title: string }[]): string {
  const [only] = sources;
  return sources.length === 1 && only
    ? M.titleOne(only.title)
    : M.titleMany(sources.length);
}
