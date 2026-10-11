/**
 * AI solve (09 AI8): after an import, a stronger model answers the
 * questions the exam left without a key. Which questions are unanswered,
 * the prompt, reading the model's JSON and writing the answers back into
 * the editor's text format (04 §3.3). Pure.
 */

import { z } from "zod";
import { classifyLine } from "../../lessons/domain/text-format.ts";

/**
 * Changelog (09 §5):
 * - solve-v1 (2026-10-11): JSON answers by question number; the true/false
 *   rules (literal reading, "an experiment verifies, never proves a law",
 *   the steps of a scientific inquiry) took Sonnet 5.5 from 0/4 to 6/6
 *   perfect runs on the 2025 THPT reference exam (40 answers).
 */
export const SOLVE_PROMPT_VERSION = "solve-v1";

/** Solves per teacher per hour (each one is a long call to a paid model). */
export const SOLVES_PER_HOUR = 10;
/** Longest the text sent to the model may be (a whole exam is ~30 KB). */
export const SOLVE_MAX_TEXT = 200_000;
export const SOLVE_TIMEOUT_MS = 240_000;
export const SOLVE_MAX_OUTPUT_TOKENS = 32_000;

export type SolveType = "mcq" | "tf" | "short";
export type Unanswered = { number: number; type: SolveType };

/** The lines of each `Câu N:` block; text before the first header is dropped. */
function blocks(text: string): string[][] {
  const out: string[][] = [];
  for (const line of text.split("\n")) {
    if (classifyLine(line.trim()).kind === "header") out.push([]);
    out.at(-1)?.push(line);
  }
  return out;
}

/**
 * Questions with no answer yet, numbered by their position (1-based): an
 * mcq without `*`, a true/false question without any `*` (all-false keys
 * are rare and the teacher reviews the result), an empty `Answer:`.
 */
export function unansweredQuestions(text: string): Unanswered[] {
  const out: Unanswered[] = [];
  blocks(text).forEach((lines, i) => {
    const kinds = lines.map((l) => classifyLine(l.trim()));
    const options = kinds.filter((k) => k.kind === "option");
    const statements = kinds.filter((k) => k.kind === "statement");
    const answer = kinds.find((k) => k.kind === "answer");
    const number = i + 1;
    if (options.length > 0) {
      if (!options.some((k) => k.correct)) out.push({ number, type: "mcq" });
    } else if (statements.length > 0) {
      if (!statements.some((k) => k.correct)) out.push({ number, type: "tf" });
    } else if (answer && !answer.rest.trim()) {
      out.push({ number, type: "short" });
    }
  });
  return out;
}

export const SOLVE_SYSTEM = [
  "Bạn là giáo viên Vật lý THPT ở Việt Nam, giải đề chính xác tuyệt đối. Đề bài được cho dưới dạng văn bản (mỗi câu bắt đầu bằng `Câu N:`); nếu có file đề gốc đính kèm thì dùng nó để xem hình vẽ, đồ thị, bảng số liệu.",
  "Chỉ giải các câu được yêu cầu. Trả về DUY NHẤT một đối tượng JSON, không markdown, không lời giải:",
  '{"answers":[{"q":<số câu>,"choice":"B"} | {"q":<số câu>,"statements":[true,false,…]} | {"q":<số câu>,"value":"2,8"}]}',
  "- Trắc nghiệm (các dòng `A.`, `B.`…): `choice` là chữ cái của phương án đúng.",
  "- Đúng/Sai (các dòng `a)`, `b)`…): `statements` có đúng một giá trị cho mỗi phát biểu theo thứ tự, true = Đúng.",
  "- Trả lời ngắn (dòng `Answer:`): `value` là đáp số, chỉ con số (không đơn vị), dấu phẩy thập phân, làm tròn đúng theo yêu cầu của đề.",
  "",
  "Quy tắc chấm ý Đúng/Sai (theo chuẩn đề thi THPT Việt Nam):",
  "- Đọc từng mệnh đề theo nghĩa đen, kiểm tra chính xác từng công thức, số mũ, đơn vị, hệ số; sai một chi tiết là Sai.",
  '- Một thí nghiệm cụ thể chỉ "kiểm chứng/minh hoạ" định luật, không "chứng minh" được định luật tổng quát.',
  "- Với các bước của phương pháp nghiên cứu khoa học, phân biệt: kế hoạch, giả thuyết, thí nghiệm, kết luận; dữ liệu chưa đủ thì không được kết luận.",
  "",
  "Tính toán cẩn thận từng bước trong đầu và tự kiểm tra lại trước khi trả lời.",
].join("\n");

/** The user turn: the whole lesson text, then which questions to answer. */
export function solvePrompt(text: string, todo: readonly Unanswered[]): string {
  return [
    "ĐỀ BÀI:",
    text,
    "",
    `Hãy giải các câu: ${todo.map((u) => u.number).join(", ")}.`,
  ].join("\n");
}

const AnswerSchema = z.union([
  z.object({ q: z.number().int().positive(), choice: z.string() }),
  z.object({
    q: z.number().int().positive(),
    statements: z.array(z.boolean()).min(1).max(8),
  }),
  z.object({
    q: z.number().int().positive(),
    value: z.union([z.string(), z.number()]),
  }),
]);
const ReplySchema = z.object({ answers: z.array(z.unknown()) });

export type SolvedAnswer =
  | { q: number; choice: string }
  | { q: number; statements: boolean[] }
  | { q: number; value: string | number };

/**
 * The model's JSON, from the first `{` to the last `}` (models sometimes
 * wrap it in a fence). Answers that don't fit the schema are skipped, so
 * one bad entry doesn't lose the others. null when there is no JSON.
 */
export function parseSolveReply(raw: string): SolvedAnswer[] | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const reply = ReplySchema.safeParse(json);
  if (!reply.success) return null;
  return reply.data.answers.flatMap((a) => {
    const parsed = AnswerSchema.safeParse(a);
    return parsed.success ? [parsed.data] : [];
  });
}

/** `2.8` → `2,8`, as the exams write decimals; anything else trimmed. */
function shortValue(value: string | number): string {
  const s = String(value).trim();
  return /^[+-]?\d+\.\d+$/.test(s) ? s.replace(".", ",") : s;
}

const STAR_LINE = /^(\s*)(\*?)(.*)$/;
const star = (line: string) => line.replace(STAR_LINE, "$1*$3");

/**
 * Writes the answers into the questions in `todo` only (an answer the model
 * gives for another question, or one that doesn't fit the question, is
 * ignored). Returns the new text and the numbers of the questions filled.
 */
export function applySolvedAnswers(
  text: string,
  todo: readonly Unanswered[],
  answers: readonly SolvedAnswer[],
): { text: string; filled: number[] } {
  const wanted = new Map(todo.map((u) => [u.number, u.type]));
  const byNumber = new Map(answers.map((a) => [a.q, a]));
  const filled: number[] = [];
  const lines = text.split("\n");
  // Index of each block's lines, so a block is edited in place.
  const starts: number[] = [];
  lines.forEach((l, i) => {
    if (classifyLine(l.trim()).kind === "header") starts.push(i);
  });
  for (const [b, from] of starts.entries()) {
    const number = b + 1;
    const to = starts[b + 1] ?? lines.length;
    const type = wanted.get(number);
    const answer = byNumber.get(number);
    if (!type || !answer) continue;
    const at = (kind: string) => {
      const out: number[] = [];
      for (let i = from + 1; i < to; i++) {
        const k = classifyLine((lines[i] ?? "").trim());
        if (k.kind === "explanation") break;
        if (k.kind === kind) out.push(i);
      }
      return out;
    };
    if (type === "mcq" && "choice" in answer) {
      const letter = answer.choice.trim().toUpperCase();
      const line = at("option").find((i) => {
        const k = classifyLine((lines[i] ?? "").trim());
        return k.kind === "option" && k.letter === letter;
      });
      if (line === undefined) continue;
      lines[line] = star(lines[line] ?? "");
      filled.push(number);
    } else if (type === "tf" && "statements" in answer) {
      const rows = at("statement");
      if (rows.length !== answer.statements.length) continue;
      rows.forEach((i, j) => {
        if (answer.statements[j]) lines[i] = star(lines[i] ?? "");
      });
      filled.push(number);
    } else if (type === "short" && "value" in answer) {
      const value = shortValue(answer.value);
      const line = at("answer")[0];
      if (line === undefined || !value) continue;
      lines[line] = (lines[line] ?? "").replace(
        /^(\s*answer\s*:).*$/i,
        `$1 ${value}`,
      );
      filled.push(number);
    }
  }
  return { text: lines.join("\n"), filled };
}

/**
 * The text of an OpenAI-compatible streamed reply (`data: {…}` lines);
 * a non-streamed JSON reply is read too, as some gateways ignore `stream`.
 */
export function readChatCompletion(body: string): string {
  const trimmed = body.trimStart();
  if (!trimmed.startsWith("data:")) {
    try {
      const json = JSON.parse(trimmed) as {
        choices?: { message?: { content?: unknown } }[];
      };
      const content = json.choices?.[0]?.message?.content;
      return typeof content === "string" ? content : "";
    } catch {
      return "";
    }
  }
  let text = "";
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const chunk = JSON.parse(data) as {
        choices?: { delta?: { content?: unknown } }[];
      };
      const delta = chunk.choices?.[0]?.delta?.content;
      if (typeof delta === "string") text += delta;
    } catch {
      // A keep-alive or a partial line: skip it.
    }
  }
  return text;
}
