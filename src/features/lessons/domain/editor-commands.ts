/**
 * Text commands of the immersive editor (07 §5.6): marking the key from the
 * preview, renumbering `Câu N`, inserting sample questions. Pure; each one
 * returns edits against the text it was given, so the editor applies them as
 * one undoable change without resetting the document.
 */
import type { QuestionType } from "../schema.ts";
import { classifyLine, unescapeLine } from "./text-format.ts";

/** Replace `[from, to)` (character offsets in the original text) with `insert`. */
export type TextEdit = { from: number; to: number; insert: string };

type Line = { no: number; from: number; text: string };

/** Not normalized: offsets must match the editor's document. */
function splitLines(text: string): Line[] {
  let from = 0;
  return text.split("\n").map((t, i) => {
    const line = { no: i + 1, from, text: t };
    from += t.length + 1;
    return line;
  });
}

/** Same kind as the parser gives the line (escaped lines are plain text). */
function kindOf(line: string, context: "body" | "explanation") {
  const trimmed = line.trim();
  return unescapeLine(trimmed, context) === null
    ? classifyLine(trimmed)
    : ({ kind: "text" } as const);
}

/** Lines of each `Câu N:` block, header first, in order. */
function questionBlocks(lines: Line[]): Line[][] {
  const blocks: Line[][] = [];
  let explanation = false;
  for (const line of lines) {
    const kind = kindOf(line.text, explanation ? "explanation" : "body");
    if (kind.kind === "header") {
      blocks.push([line]);
      explanation = false;
      continue;
    }
    const block = blocks.at(-1);
    if (!block) continue;
    block.push(line);
    if (!explanation && kind.kind === "explanation") explanation = true;
  }
  return blocks;
}

/** Applies non-overlapping edits (tests and previews). */
export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  return [...edits]
    .sort((a, b) => b.from - a.from)
    .reduce((t, e) => t.slice(0, e.from) + e.insert + t.slice(e.to), text);
}

/**
 * Index of the question whose block holds the 1-based `line`, from the
 * parser's header lines (ascending); -1 before the first header.
 */
export function questionAtLine(headers: readonly number[], line: number) {
  let lo = 0;
  let hi = headers.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((headers[mid] ?? 0) <= line) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/**
 * Clicking an option or statement in the preview (v1 `markAnswerCorrect`):
 * an mcq gets `*` on that option only (clicking the key again clears it);
 * a true/false statement toggles its `*`. Lines inside `Giải thích:` are
 * never touched. Empty when the question or item isn't in the text.
 */
export function toggleCorrect(
  text: string,
  questionIndex: number,
  type: "mcq" | "tf",
  itemIndex: number,
): TextEdit[] {
  const block = questionBlocks(splitLines(text))[questionIndex];
  if (!block) return [];
  const wanted = type === "mcq" ? "option" : "statement";
  const items: { line: Line; correct: boolean }[] = [];
  let explanation = false;
  for (const line of block.slice(1)) {
    const kind = kindOf(line.text, explanation ? "explanation" : "body");
    if (explanation) continue;
    if (kind.kind === "explanation") explanation = true;
    if (kind.kind === wanted) items.push({ line, correct: kind.correct });
  }
  const target = items[itemIndex];
  if (!target) return [];

  const setStar = (line: Line, on: boolean): TextEdit[] => {
    const at = line.from + (line.text.length - line.text.trimStart().length);
    const has = line.text.trimStart().startsWith("*");
    if (on === has) return [];
    return [
      on
        ? { from: at, to: at, insert: "*" }
        : { from: at, to: at + 1, insert: "" },
    ];
  };

  if (type === "tf") return setStar(target.line, !target.correct);
  const makeKey = !target.correct;
  return items.flatMap((item, i) =>
    setStar(item.line, makeKey && i === itemIndex),
  );
}

const HEADER_NUMBER = /^(\s*câu\s*)(\d+)/iu;

/** Sets a header's number to `n`; nothing when it already is `n`. */
function numberEdit(header: Line | undefined, n: number): TextEdit[] {
  const m = header && HEADER_NUMBER.exec(header.text);
  if (!header || !m || m[2] === String(n)) return [];
  const from = header.from + (m[1] ?? "").length;
  return [{ from, to: from + (m[2] ?? "").length, insert: String(n) }];
}

/** `Câu 1, Câu 3, Câu 3` → `Câu 1, Câu 2, Câu 3` (Azota "sửa lỗi STT câu"). */
export function renumberQuestions(text: string): TextEdit[] {
  return questionBlocks(splitLines(text)).flatMap((block, i) =>
    numberEdit(block[0], i + 1),
  );
}

/** A sample question in the text format, numbered `n`. */
export function questionTemplate(type: QuestionType, n: number): string {
  switch (type) {
    case "mcq":
      return `Câu ${n}: Nội dung câu hỏi trắc nghiệm
A. Phương án A
*B. Phương án B (dấu * là đáp án đúng)
C. Phương án C
D. Phương án D
Giải thích: Lời giải (không bắt buộc)`;
    case "tf":
      return `Câu ${n}: Nội dung câu hỏi đúng/sai
*a) Mệnh đề đúng (dấu * là đúng)
b) Mệnh đề sai
*c) Mệnh đề đúng
d) Mệnh đề sai`;
    case "short":
      return `Câu ${n}: Nội dung câu hỏi trả lời ngắn, có thể dùng công thức $v = s/t$
Answer: 0,5 ± 0,01`;
  }
}

/**
 * Inserts a sample question after the question holding the cursor (or at
 * the end when the cursor is before the first one or the text is empty),
 * then renumbers everything after it. Returns the edits, the new question's
 * number and the 1-based line of its header in the edited text.
 */
export function insertQuestion(
  text: string,
  cursorLine: number,
  type: QuestionType,
): { edits: TextEdit[]; number: number; line: number } {
  const lines = splitLines(text);
  const blocks = questionBlocks(lines);
  const headers = blocks.map((b) => b[0]?.no ?? 0);
  const at = questionAtLine(headers, cursorLine);
  const after = at === -1 ? blocks.at(-1) : blocks[at];
  // The new block goes after the block's last non-blank line.
  const last =
    after?.findLast((l) => l.text.trim() !== "") ??
    lines.findLast((l) => l.text.trim() !== "");
  const index = at === -1 ? blocks.length : at + 1;
  const template = questionTemplate(type, index + 1);
  const pos = last ? last.from + last.text.length : 0;
  const insert = last ? `\n\n${template}` : template;
  const inserted: TextEdit = { from: pos, to: pos, insert };
  // Later headers move down by one.
  const later = blocks
    .slice(index)
    .flatMap((block, i) => numberEdit(block[0], index + i + 2));
  return {
    edits: [inserted, ...later],
    number: index + 1,
    line: (last?.no ?? 0) + (last ? 2 : 1),
  };
}

/**
 * A LaTeX snippet for the cursor: as is inside `$…$` (an odd number of
 * unescaped `$` before it on the line), else wrapped in `$…$`.
 */
export function mathSnippet(beforeCursor: string, snippet: string): string {
  const dollars = beforeCursor.match(/(?<!\\)\$/g)?.length ?? 0;
  return dollars % 2 === 1 ? snippet : `$${snippet}$`;
}
