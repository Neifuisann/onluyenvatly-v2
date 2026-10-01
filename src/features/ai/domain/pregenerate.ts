/**
 * Admin pre-generation of a lesson's explanations (S7-03, ADR-007). Pure:
 * which question comes next and the pace the browser keeps.
 */
import { z } from "zod";
import type { Question } from "../../lessons/schema.ts";
import { MAX_EXPLANATION_CHARS, needsAi, questionHash } from "./explain.ts";

/**
 * Pre-generation calls per minute. The free tier allows ~15 RPM on the
 * lite model, and students keep asking meanwhile, so the browser leaves
 * headroom: one question per call, a call every 6 s.
 */
export { PREGEN_INTERVAL_MS, PREGEN_PER_MINUTE } from "./pregenerate-limits.ts";

export type ExplanationPlanRow = {
  /** 1-based, in the teacher's order. */
  position: number;
  question: Question;
  /** null when the teacher wrote the explanation in the lesson. */
  hash: string | null;
};

export type ExplanationCounts = {
  total: number;
  teacher: number;
  stored: number;
  missing: number;
};

/** Every question of a version with its cache key (none for teacher text). */
export function planRows(questions: readonly Question[]): ExplanationPlanRow[] {
  return questions.map((question, i) => ({
    position: i + 1,
    question,
    hash: needsAi(question) ? questionHash(question) : null,
  }));
}

export function countPlan(
  rows: readonly ExplanationPlanRow[],
  stored: ReadonlySet<string>,
): ExplanationCounts {
  const teacher = rows.filter((r) => r.hash === null).length;
  const have = rows.filter((r) => r.hash !== null && stored.has(r.hash)).length;
  return {
    total: rows.length,
    teacher,
    stored: have,
    missing: rows.length - teacher - have,
  };
}

/**
 * Questions still to generate, in the teacher's order, one per content: not
 * stored and not skipped. A question this run already failed on is skipped
 * together with every question of the same content, so one bad answer
 * doesn't loop.
 */
function pending(
  rows: readonly ExplanationPlanRow[],
  stored: ReadonlySet<string>,
  skip: ReadonlySet<string>,
): ExplanationPlanRow[] {
  const skipped = new Set(
    rows.filter((r) => skip.has(r.question.id)).map((r) => r.hash),
  );
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (r.hash === null || stored.has(r.hash) || skipped.has(r.hash))
      return false;
    if (seen.has(r.hash)) return false;
    seen.add(r.hash);
    return true;
  });
}

/** The next question to generate, or null when the lesson is done. */
export function nextMissing(
  rows: readonly ExplanationPlanRow[],
  stored: ReadonlySet<string>,
  skip: ReadonlySet<string>,
): ExplanationPlanRow | null {
  return pending(rows, stored, skip)[0] ?? null;
}

/** Generations left (distinct contents). */
export function remainingCount(
  rows: readonly ExplanationPlanRow[],
  stored: ReadonlySet<string>,
  skip: ReadonlySet<string>,
): number {
  return pending(rows, stored, skip).length;
}

/** The teacher's edit of an explanation (Markdown-lite + LaTeX). */
export const ExplanationTextSchema = z
  .string()
  .transform((s) => s.replace(/\r\n?/g, "\n").trim())
  .pipe(z.string().min(1).max(MAX_EXPLANATION_CHARS));
