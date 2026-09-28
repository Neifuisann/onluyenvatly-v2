/**
 * What gets written to a lesson version when the teacher saves or publishes
 * (S5-04). Pure: the server re-parses the editor text itself, so ids and
 * answers never come from the browser.
 */
import { z } from "zod";
import { publishCopy as M } from "../messages.ts";
import {
  type LessonConfig,
  QUESTION_TYPES,
  type Question,
  QuestionSchema,
  QuestionsSchema,
} from "../schema.ts";
import { type ParseOptions, parseLessonText } from "./parser.ts";
import { countByType } from "./summary.ts";

/** A generous cap: the largest v1 lesson is about 60 KB of text. */
export const MAX_SOURCE_LENGTH = 300_000;

export const SourceTextSchema = z.string().max(MAX_SOURCE_LENGTH);

export type DraftContent = {
  sourceText: string;
  /**
   * Every question that is valid on its own, so a draft can be saved while
   * the teacher is still fixing it and ids stay stable across saves.
   */
  questions: Question[];
  errors: number;
};

/** A draft is saved as typed; only valid questions are kept in `questions`. */
export function draftContent(
  text: string,
  options: ParseOptions = {},
): DraftContent {
  const parsed = parseLessonText(text, options);
  // The parser keeps ids unique; drop only what isn't valid yet.
  const questions = parsed.questions.filter(
    (q) => QuestionSchema.safeParse(q).success,
  );
  return {
    sourceText: text,
    questions,
    errors: parsed.issues.filter((i) => i.severity === "error").length,
  };
}

/**
 * Why the pool can't be drawn from these questions, or null. The settings
 * form checks this too, but the content may have shrunk since.
 */
export function poolProblem(
  pool: LessonConfig["pool"],
  questions: readonly Question[],
): string | null {
  if (!pool.enabled) return null;
  const available = countByType(questions);
  const byType = pool.byType;
  if (byType && QUESTION_TYPES.some((t) => (byType[t] ?? 0) > 0)) {
    for (const t of QUESTION_TYPES) {
      const want = byType[t] ?? 0;
      if (want > available[t]) return M.poolByType(t, want, available[t]);
    }
    return null;
  }
  const total = questions.length;
  if (pool.size !== undefined && pool.size > total)
    return M.poolSize(pool.size, total);
  return null;
}

export type PublishCheck =
  | { ok: true; questions: Question[] }
  | { ok: false; message: string };

/** Publishing needs a text with no errors, at least one question, and a pool that fits. */
export function checkPublishable(
  text: string,
  config: Pick<LessonConfig, "pool">,
  options: ParseOptions = {},
): PublishCheck {
  const parsed = parseLessonText(text, options);
  const errors = parsed.issues.filter((i) => i.severity === "error").length;
  if (errors > 0) return { ok: false, message: M.hasErrors(errors) };
  if (parsed.questions.length === 0) return { ok: false, message: M.empty };
  const valid = QuestionsSchema.safeParse(parsed.questions);
  if (!valid.success)
    return {
      ok: false,
      message: valid.error.issues[0]?.message ?? M.invalid,
    };
  const pool = poolProblem(config.pool, valid.data);
  if (pool) return { ok: false, message: pool };
  return { ok: true, questions: valid.data };
}
