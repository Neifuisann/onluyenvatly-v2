/**
 * Corrections to a published version (B-10, Azota's "Chấm lại điểm"): the
 * teacher fixes a key, points, gives a question free, removes one or edits
 * one question's text, in place, and the attempts on that version are
 * regraded. Pure: questions and corrections in, new questions out.
 *
 * A correction never changes a question's shape (type, option or statement
 * count): stored answers and option orders index into it. Structural edits
 * go through the full editor, which publishes a new version.
 */
import { correctionCopy as M } from "../messages.ts";
import {
  type LessonConfig,
  type Question,
  QuestionsSchema,
  type QuestionType,
} from "../schema.ts";
import { parseLessonText } from "./parser.ts";
import { liveQuestions } from "./summary.ts";
import { canonicalShortAnswer } from "./text-format.ts";

export type Correction =
  | { kind: "mcq-answer"; questionId: string; answer: number }
  | { kind: "tf-answer"; questionId: string; answers: boolean[] }
  | { kind: "short-answer"; questionId: string; answer: string }
  | { kind: "points"; questionId: string; points: number }
  | { kind: "free"; questionId: string; free: boolean }
  | { kind: "remove"; questionId: string }
  | { kind: "content"; question: Question };

export type CorrectionResult =
  | {
      ok: true;
      questions: Question[];
      /** Ids whose stored JSON changed. */
      changed: string[];
      /** New item points per question id (only where they change). */
      points: Map<string, number>;
    }
  | { ok: false; message: string };

/**
 * Whether a question's own points count: always per question, and for a
 * type without a total in `per-type-total` (`pointsPlan`'s fallback).
 */
export function pointsEditable(
  config: Pick<LessonConfig, "points">,
  type: QuestionType,
): boolean {
  const p = config.points;
  return p.mode === "per-question" || p[type] === undefined;
}

/** Same type and option/statement count: stored answers still fit. */
export function sameShape(a: Question, b: Question): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "mcq" && b.type === "mcq")
    return a.options.length === b.options.length;
  if (a.type === "tf" && b.type === "tf")
    return a.statements.length === b.statements.length;
  return true;
}

function apply(q: Question, c: Correction): Question | string {
  switch (c.kind) {
    case "mcq-answer":
      if (q.type !== "mcq" || c.answer >= q.options.length) return M.badAnswer;
      return { ...q, answer: c.answer };
    case "tf-answer":
      if (q.type !== "tf" || c.answers.length !== q.statements.length)
        return M.badAnswer;
      return {
        ...q,
        statements: q.statements.map((s, i) => ({
          ...s,
          answer: c.answers[i] ?? s.answer,
        })),
      };
    case "short-answer": {
      const answer = canonicalShortAnswer(c.answer);
      if (q.type !== "short" || !answer) return M.badAnswer;
      return { ...q, answer };
    }
    case "points":
      return { ...q, points: c.points };
    case "free": {
      const { free: _, ...rest } = q;
      return c.free ? { ...q, free: true } : rest;
    }
    case "remove":
      return { ...q, removed: true };
    case "content":
      if (!sameShape(q, c.question)) return M.shapeChanged;
      // Same id; a corrected question is live.
      return { ...c.question, id: q.id };
  }
}

/** JSON with sorted keys: stored and parsed questions order keys differently. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : v,
  );
}

/** The points an attempt item of `after` should be worth, if they change. */
function newItemPoints(
  before: Question,
  after: Question,
  config: Pick<LessonConfig, "points">,
): number | undefined {
  if (after.removed) return 0;
  if (!pointsEditable(config, after.type)) return undefined;
  const now = after.points ?? 1;
  return now !== (before.points ?? 1) ? now : undefined;
}

export function applyCorrections(
  questions: readonly Question[],
  corrections: readonly Correction[],
  config: Pick<LessonConfig, "points">,
): CorrectionResult {
  const next = [...questions];
  for (const c of corrections) {
    const id = c.kind === "content" ? c.question.id : c.questionId;
    const i = next.findIndex((q) => q.id === id);
    const q = next[i];
    if (!q || q.removed) return { ok: false, message: M.notFound };
    if (c.kind === "points" && !pointsEditable(config, q.type))
      return { ok: false, message: M.pointsByType };
    const out = apply(q, c);
    if (typeof out === "string") return { ok: false, message: out };
    next[i] = out;
  }
  if (liveQuestions(next).length === 0)
    return { ok: false, message: M.lastQuestion };
  const valid = QuestionsSchema.safeParse(next);
  if (!valid.success)
    return {
      ok: false,
      message: valid.error.issues[0]?.message ?? M.invalid,
    };

  const changed: string[] = [];
  const points = new Map<string, number>();
  valid.data.forEach((after, i) => {
    const before = questions[i] as Question;
    if (canonical(before) === canonical(after)) return;
    changed.push(after.id);
    const p = newItemPoints(before, after, config);
    if (p !== undefined) points.set(after.id, p);
  });
  return { ok: true, questions: valid.data, changed, points };
}

/**
 * "Sửa nội dung" of one question (B-10): its text must hold exactly that
 * question, without errors. The id is the corrected question's.
 */
export function parseSingleQuestion(
  text: string,
  questionId: string,
): { ok: true; question: Question } | { ok: false; message: string } {
  const parsed = parseLessonText(text, { generateId: () => questionId });
  const error = parsed.issues.find((i) => i.severity === "error");
  if (error)
    return { ok: false, message: M.lineError(error.line, error.message) };
  const [question, extra] = parsed.questions;
  if (!question || extra) return { ok: false, message: M.oneQuestion };
  return { ok: true, question: { ...question, id: questionId } };
}

/**
 * The corrections that turn `before` into the teacher's working copy
 * `after` (same questions, same order). A removed question needs nothing else.
 */
export function diffCorrections(
  before: readonly Question[],
  after: readonly Question[],
): Correction[] {
  const out: Correction[] = [];
  before.forEach((b, i) => {
    const a = after[i];
    if (!a || a.id !== b.id || b.removed) return;
    const questionId = b.id;
    if (a.removed) {
      out.push({ kind: "remove", questionId });
      return;
    }
    if (a.type === "mcq" && b.type === "mcq" && a.answer !== b.answer)
      out.push({ kind: "mcq-answer", questionId, answer: a.answer });
    if (
      a.type === "tf" &&
      b.type === "tf" &&
      a.statements.some((s, j) => s.answer !== b.statements[j]?.answer)
    )
      out.push({
        kind: "tf-answer",
        questionId,
        answers: a.statements.map((s) => s.answer),
      });
    if (a.type === "short" && b.type === "short" && a.answer !== b.answer)
      out.push({ kind: "short-answer", questionId, answer: a.answer });
    if ((a.points ?? 1) !== (b.points ?? 1) && a.points !== undefined)
      out.push({ kind: "points", questionId, points: a.points });
    if (Boolean(a.free) !== Boolean(b.free))
      out.push({ kind: "free", questionId, free: Boolean(a.free) });
  });
  return out;
}
