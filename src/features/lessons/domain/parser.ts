/**
 * Text format → `Question[]` (04 §3.3). Pure; runs in the editor (live
 * preview), in server actions (save) and in the migration script.
 *
 *   Câu 1: stem            [0.25 pts] at the end sets points
 *   ![alt](media:p =WxH)   image of the stem, or of the option above it
 *   A. …  *B. …            mcq (A–F, `*` marks the answer)
 *   *a) …  b) …            true/false (a–h, `*` marks true statements)
 *   Answer: 0,63 ± 0,01    short answer, optional absolute tolerance
 *   [0.25 pts]             points
 *   Giải thích: …          teacher explanation, runs until the next `Câu N:`
 *
 * Any other line continues the previous element. `\` before a line that would
 * be structural makes it plain text (see text-format.ts).
 */
import { parseIssueMessages as M } from "../messages.ts";
import {
  type Media,
  type Question,
  QuestionIdSchema,
  QuestionSchema,
  type QuestionType,
} from "../schema.ts";
import {
  canonicalShortAnswer,
  classifyLine,
  type LineKind,
  normalizeInput,
  parseDecimal,
  splitTolerance,
  TRAILING_POINTS,
  unescapeLine,
} from "./text-format.ts";

export type ParseIssue = {
  /** 1-based line and column in the input text. */
  line: number;
  col: number;
  severity: "error" | "warning";
  code: keyof typeof M;
  message: string;
  /** Index into `questions`, when the issue belongs to one. */
  questionIndex?: number;
};

export type ParseResult = {
  /**
   * One entry per `Câu N:` block, in order. Only schema-valid when there are
   * no error-severity issues.
   */
  questions: Question[];
  /** 1-based line of each question's `Câu N:` header. */
  lines: number[];
  issues: ParseIssue[];
};

export type ParseOptions = {
  /**
   * The lesson's previous questions: their ids are reused for the same
   * question (same stem, else same position and type), keeping ids stable
   * across edits (04 §3.1).
   */
  previous?: readonly Question[];
  /** New id generator; defaults to "q_" + 8 random base62 characters. */
  generateId?: () => string;
};

type Element = { lines: string[]; image?: Media };

type Draft = {
  line: number;
  type: QuestionType | null;
  stem: Element;
  options: Element[];
  statements: (Element & { correct: boolean })[];
  answerIndex: number | null;
  shortAnswer: string | null;
  tolerance: number | undefined;
  points: number | undefined;
  explanation: string[] | null;
};

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function randomQuestionId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  let id = "q_";
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return id;
}

const joinText = (lines: readonly string[]) => lines.join("\n").trim();

/** Stems compared for id reuse: case, spacing and accents don't matter. */
export function stemKey(stem: string): string {
  return stem
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseLessonText(
  text: string,
  options: ParseOptions = {},
): ParseResult {
  const issues: ParseIssue[] = [];
  const drafts: Draft[] = [];
  let cur: Draft | null = null;
  let warnedPreamble = false;

  const issue = (
    code: ParseIssue["code"],
    line: number,
    col: number,
    message: string,
    severity: ParseIssue["severity"] = "error",
  ) =>
    issues.push({
      line,
      col,
      severity,
      code,
      message,
      ...(cur && { questionIndex: drafts.length - 1 }),
    });

  const lines = normalizeInput(text).split("\n");
  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trim();
    const col = raw.length - raw.trimStart().length + 1;
    const context = cur?.explanation ? "explanation" : "body";

    const escaped = unescapeLine(line, context);
    const kind: LineKind =
      escaped === null ? classifyLine(line) : { kind: "text" };

    if (kind.kind === "header") {
      const rest = kind.rest;
      const marker = TRAILING_POINTS.exec(rest);
      cur = {
        line: lineNo,
        type: null,
        stem: { lines: [marker ? rest.slice(0, marker.index) : rest] },
        options: [],
        statements: [],
        answerIndex: null,
        shortAnswer: null,
        tolerance: undefined,
        points: undefined,
        explanation: null,
      };
      drafts.push(cur);
      if (marker) setPoints(marker[1] ?? "", lineNo, col);
      return;
    }

    if (!cur) {
      if (line && !warnedPreamble) {
        warnedPreamble = true;
        issue(
          "TEXT_BEFORE_FIRST_QUESTION",
          lineNo,
          col,
          M.TEXT_BEFORE_FIRST_QUESTION,
          "warning",
        );
      }
      return;
    }
    const q: Draft = cur;

    if (q.explanation) {
      q.explanation.push(escaped ?? line);
      return;
    }

    const lastElement = (): Element =>
      q.options.at(-1) ?? q.statements.at(-1) ?? q.stem;

    const claimType = (type: QuestionType): boolean => {
      if (q.type === null) q.type = type;
      if (q.type === type) return true;
      issue("MIXED_TYPES", lineNo, col, M.MIXED_TYPES);
      return false;
    };

    switch (kind.kind) {
      case "text":
        lastElement().lines.push(escaped ?? line);
        return;
      case "points":
        setPoints(kind.raw, lineNo, col);
        return;
      case "explanation":
        q.explanation = [kind.rest];
        return;
      case "image": {
        const target = lastElement();
        if (q.statements.length > 0 && target !== q.stem) {
          issue("IMAGE_NOT_ALLOWED", lineNo, col, M.IMAGE_NOT_ALLOWED);
          return;
        }
        if (target.image) {
          issue("DUPLICATE_IMAGE", lineNo, col, M.DUPLICATE_IMAGE);
          return;
        }
        target.image = {
          path: kind.path,
          ...(kind.w !== undefined && kind.h !== undefined
            ? { w: kind.w, h: kind.h }
            : {}),
          ...(kind.alt && { alt: kind.alt }),
        };
        return;
      }
      case "answer": {
        if (!claimType("short")) return;
        if (q.shortAnswer !== null) {
          issue("DUPLICATE_ANSWER", lineNo, col, M.DUPLICATE_ANSWER);
          return;
        }
        const { answer, tolerance } = splitTolerance(kind.rest);
        q.shortAnswer = canonicalShortAnswer(answer);
        if (tolerance !== null) {
          const t = parseDecimal(tolerance);
          if (t === null || t < 0)
            issue("INVALID_TOLERANCE", lineNo, col, M.INVALID_TOLERANCE);
          else q.tolerance = t;
        }
        return;
      }
      case "option": {
        if (!claimType("mcq")) return;
        const expected = String.fromCharCode(65 + q.options.length);
        if (kind.letter !== expected)
          issue("OPTION_ORDER", lineNo, col, M.OPTION_ORDER(`${expected}.`));
        if (kind.correct) {
          if (q.answerIndex !== null)
            issue("MCQ_MULTIPLE_ANSWERS", lineNo, col, M.MCQ_MULTIPLE_ANSWERS);
          else q.answerIndex = q.options.length;
        }
        q.options.push({ lines: [kind.rest] });
        return;
      }
      case "statement": {
        if (!claimType("tf")) return;
        const expected = String.fromCharCode(97 + q.statements.length);
        if (kind.letter !== expected)
          issue("OPTION_ORDER", lineNo, col, M.OPTION_ORDER(`${expected})`));
        q.statements.push({ lines: [kind.rest], correct: kind.correct });
        return;
      }
    }
  });

  function setPoints(raw: string, lineNo: number, col: number) {
    const q = cur;
    if (!q) return;
    const n = parseDecimal(raw);
    if (n === null || n > 100) {
      issue("INVALID_POINTS", lineNo, col, M.INVALID_POINTS);
      return;
    }
    if (q.points !== undefined)
      issue("DUPLICATE_POINTS", lineNo, col, M.DUPLICATE_POINTS, "warning");
    q.points = n;
  }

  const ids = assignIds(drafts, options);
  const questions = drafts.map((d, index) =>
    finalize(d, ids[index] ?? "", index, issues),
  );
  issues.sort((a, b) => a.line - b.line || a.col - b.col);
  return { questions, lines: drafts.map((d) => d.line), issues };
}

function finalize(
  d: Draft,
  id: string,
  questionIndex: number,
  issues: ParseIssue[],
): Question {
  const before = issues.length;
  const add = (code: ParseIssue["code"], message: string) =>
    issues.push({
      line: d.line,
      col: 1,
      severity: "error",
      code,
      message,
      questionIndex,
    });

  const stem = joinText(d.stem.lines);
  if (!stem && !d.stem.image) add("EMPTY_STEM", M.EMPTY_STEM);
  const base = {
    id,
    stem,
    ...(d.stem.image && { image: d.stem.image }),
    ...(d.points !== undefined && { points: d.points }),
    ...(d.explanation && { explanation: joinText(d.explanation) }),
  };

  let q: Question;
  switch (d.type) {
    case "mcq":
      if (d.options.length < 2)
        add("MCQ_TOO_FEW_OPTIONS", M.MCQ_TOO_FEW_OPTIONS);
      if (d.answerIndex === null) add("MCQ_NO_ANSWER", M.MCQ_NO_ANSWER);
      q = {
        ...base,
        type: "mcq",
        options: d.options.map((o) => ({
          text: joinText(o.lines),
          ...(o.image && { image: o.image }),
        })),
        answer: d.answerIndex ?? -1,
      };
      break;
    case "tf":
      if (d.statements.length < 2)
        add("TF_TOO_FEW_STATEMENTS", M.TF_TOO_FEW_STATEMENTS);
      q = {
        ...base,
        type: "tf",
        statements: d.statements.map((s) => ({
          text: joinText(s.lines),
          answer: s.correct,
        })),
      };
      break;
    case "short":
      if (!d.shortAnswer) add("SHORT_EMPTY_ANSWER", M.SHORT_EMPTY_ANSWER);
      q = {
        ...base,
        type: "short",
        answer: d.shortAnswer ?? "",
        ...(d.tolerance !== undefined && { tolerance: d.tolerance }),
      };
      break;
    default:
      add("NO_ANSWER_FORMAT", M.NO_ANSWER_FORMAT);
      q = { ...base, type: "short", answer: "" };
  }

  // Anything the specific checks above didn't catch (lengths, empty options…).
  if (issues.length === before) {
    const parsed = QuestionSchema.safeParse(q);
    if (!parsed.success)
      add("INVALID", M.INVALID(parsed.error.issues[0]?.message ?? ""));
  }
  return q;
}

/** Stem identity for id reuse; an image-only stem is known by its image. */
function matchKey(stem: string, image: Media | undefined): string {
  const key = stemKey(stem);
  return key || (image ? `\u0000img:${image.path}` : "");
}

/** Reuse previous ids: same stem first, then same position and type. */
function assignIds(drafts: readonly Draft[], options: ParseOptions): string[] {
  const previous = (options.previous ?? []).filter(
    (q) => QuestionIdSchema.safeParse(q.id).success,
  );
  const generate = options.generateId ?? randomQuestionId;
  const used = new Set<string>();
  const ids: (string | undefined)[] = drafts.map(() => undefined);

  const byStem = new Map<string, string[]>();
  for (const q of previous) {
    const key = matchKey(q.stem, q.image);
    if (key) byStem.set(key, [...(byStem.get(key) ?? []), q.id]);
  }
  drafts.forEach((d, i) => {
    const key = matchKey(joinText(d.stem.lines), d.stem.image);
    const candidates = (key && byStem.get(key)) || [];
    const id = candidates.find((c) => !used.has(c));
    if (id) {
      ids[i] = id;
      used.add(id);
    }
  });
  drafts.forEach((d, i) => {
    const prev = previous[i];
    if (ids[i] || !prev || used.has(prev.id) || prev.type !== d.type) return;
    ids[i] = prev.id;
    used.add(prev.id);
  });
  const taken = new Set([...used, ...previous.map((q) => q.id)]);
  return ids.map((id) => {
    if (id) return id;
    let fresh = generate();
    while (taken.has(fresh)) fresh = generate();
    taken.add(fresh);
    return fresh;
  });
}
