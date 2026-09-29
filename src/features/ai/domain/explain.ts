/**
 * AI explanations (09 §3, ADR-007): the cache key, the prompt, cleaning the
 * model's text and the vote rules. Pure (the hash uses node:crypto).
 */
import { createHash } from "node:crypto";
import type { Question } from "../../lessons/schema.ts";

/**
 * Changelog (09 §5), stored with each explanation:
 * - explain-v1 (S7-02): 09 §3 prompt; options referred to by content, since
 *   each student sees them shuffled; figures flagged as unseen.
 */
export const PROMPT_VERSION = "explain-v1";

/** Down votes that put an unreviewed explanation in the teacher's queue. */
export const FLAG_DOWN_VOTES = 3;

/** Stored explanations are capped (a 250-word answer is ~2,000 chars). */
export const MAX_EXPLANATION_CHARS = 6000;

/** Output tokens for one explanation (~450 expected; thinking counts too). */
export const EXPLAIN_MAX_OUTPUT_TOKENS = 2048;

const normalize = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();

/**
 * The cache key: sha256 of the question's normalized content and answer
 * (not its id, points or the teacher's explanation). Editing the stem,
 * an option or the key gives a new hash; the same question copied into
 * another lesson keeps it.
 */
export function questionHash(q: Question): string {
  const base = { t: q.type, s: normalize(q.stem), i: q.image?.path ?? null };
  const body =
    q.type === "mcq"
      ? {
          ...base,
          o: q.options.map((o) => [normalize(o.text), o.image?.path ?? null]),
          a: q.answer,
        }
      : q.type === "tf"
        ? {
            ...base,
            st: q.statements.map((s) => [normalize(s.text), s.answer]),
          }
        : { ...base, a: normalize(q.answer), tol: q.tolerance ?? 0 };
  return createHash("sha256")
    .update(`q1:${JSON.stringify(body)}`)
    .digest("hex");
}

export const HASH_PATTERN = /^[0-9a-f]{64}$/;

/** Teacher-written explanations always win (ADR-007): no AI for those. */
export function needsAi(q: Question): boolean {
  return !q.explanation?.trim();
}

export const EXPLAIN_SYSTEM = [
  "Bạn là giáo viên Vật lý THPT tại Việt Nam. Giải thích ngắn gọn, chính xác, đúng chương trình GDPT 2018.",
  "Dùng LaTeX trong $...$ cho công thức. Không bịa số liệu. Nếu đề thiếu dữ kiện, nói rõ.",
  "Chỉ dùng văn bản thường, **in đậm** và công thức; không dùng tiêu đề #, bảng, HTML hay hình ảnh. Mỗi ý một dòng.",
].join("\n");

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const TYPE_NAMES = {
  mcq: "Trắc nghiệm nhiều lựa chọn",
  tf: "Đúng/Sai",
  short: "Trả lời ngắn",
} as const;

const imageNote = (has: boolean) =>
  has
    ? [
        "(Đề có hình vẽ kèm theo mà bạn không xem được. Nếu cần dữ kiện từ hình, hãy nói rõ.)",
      ]
    : [];

/**
 * The user turn (09 §3). The student's own answer is never sent, so one
 * explanation serves everyone.
 */
export function buildExplainPrompt(q: Question): string {
  const lines = [
    `Loại câu: ${TYPE_NAMES[q.type]}`,
    `Đề bài: ${q.stem.trim() || "(chỉ có hình)"}`,
  ];
  if (q.type === "mcq") {
    const withImage = !!q.image || q.options.some((o) => o.image);
    lines.push(...imageNote(withImage), "Các lựa chọn:");
    q.options.forEach((o, i) => {
      lines.push(`${LETTERS[i]}. ${o.text.trim() || "(hình)"}`);
    });
    const key = q.options[q.answer];
    lines.push(
      `Đáp án đúng: ${LETTERS[q.answer]}. ${key?.text.trim() ?? ""}`,
      "Yêu cầu: 1) Ý chính cần nhớ (1–2 câu) 2) Các bước giải ngắn 3) Vì sao các lựa chọn sai là sai 4) Mẹo tránh nhầm.",
      "Thứ tự các lựa chọn được xáo trộn cho mỗi học sinh: khi nhắc tới một lựa chọn, hãy nêu nội dung của nó, đừng chỉ ghi chữ cái.",
    );
  } else if (q.type === "tf") {
    lines.push(...imageNote(!!q.image), "Các phát biểu và đáp án:");
    q.statements.forEach((s, i) => {
      lines.push(
        `${String.fromCharCode(97 + i)}) ${s.text.trim()} — ${s.answer ? "Đúng" : "Sai"}`,
      );
    });
    lines.push(
      "Yêu cầu: 1) Ý chính cần nhớ (1–2 câu) 2) Với từng phát biểu, giải thích ngắn vì sao Đúng hoặc Sai 3) Mẹo tránh nhầm.",
    );
  } else {
    lines.push(...imageNote(!!q.image));
    const tolerance = q.tolerance ? ` (sai số cho phép ±${q.tolerance})` : "";
    lines.push(
      `Đáp án đúng: ${q.answer.trim()}${tolerance}`,
      "Yêu cầu: 1) Ý chính cần nhớ (1–2 câu) 2) Các bước giải ngắn dẫn tới đáp án 3) Mẹo tránh nhầm (đơn vị, làm tròn).",
    );
  }
  lines.push("Tối đa 250 từ.");
  return lines.join("\n");
}

/**
 * Keeps the model's text inside what `MathText` renders (06 §4): headings
 * become bold lines, list markers become "•", images are dropped (no
 * `media:` paths from a model), blank-line runs collapse, length is capped.
 */
export function cleanExplanation(text: string): string {
  const cleaned = text
    .replace(/\r\n?/g, "\n")
    .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, "")
    .replace(/^[ \t]*#{1,6}[ \t]+(.+?)[ \t#]*$/gm, "**$1**")
    .replace(/^[ \t]*[-*•][ \t]+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned.length > MAX_EXPLANATION_CHARS
    ? `${cleaned.slice(0, MAX_EXPLANATION_CHARS - 1).trimEnd()}…`
    : cleaned;
}

export type Vote = "up" | "down" | null;

/** Counter changes when a student's vote goes from `prev` to `next`. */
export function voteDelta(
  prev: Vote,
  next: Vote,
): { up: number; down: number } {
  const count = (v: Vote, side: "up" | "down") => (v === side ? 1 : 0);
  return {
    up: count(next, "up") - count(prev, "up"),
    down: count(next, "down") - count(prev, "down"),
  };
}

/** In the 👎 queue until an admin edits or approves it (S7-03). */
export function isFlagged(e: {
  votesDown: number;
  reviewedAt: Date | null;
}): boolean {
  return e.reviewedAt === null && e.votesDown >= FLAG_DOWN_VOTES;
}
