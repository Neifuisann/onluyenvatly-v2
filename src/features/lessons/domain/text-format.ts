/**
 * The editor text format's line grammar (04 §3.3), shared by the parser and
 * the serializer so both agree on which lines are structural.
 *
 * Escaping: a text line that would read as structural is written with a
 * leading `\`. The parser strips exactly one `\` only when the rest of the
 * line is itself structural (or escaped), so LaTeX lines such as `\frac{…}`
 * are never touched.
 */

export type LineKind =
  | { kind: "header"; rest: string }
  | { kind: "option"; correct: boolean; letter: string; rest: string }
  | { kind: "statement"; correct: boolean; letter: string; rest: string }
  | { kind: "answer"; rest: string }
  | { kind: "points"; raw: string }
  | { kind: "free" }
  | { kind: "explanation"; rest: string }
  | {
      kind: "image";
      alt: string;
      path: string;
      w: number | undefined;
      h: number | undefined;
    }
  | { kind: "text" };

// `Câu 1:` or `Câu 1.` (the dot needs a space or line end, so `Câu 1.5 m` is text).
const HEADER = /^câu\s*\d+\s*(?::|\.(?=\s|$))\s*(.*)$/iu;
const OPTION = /^(\*?)([A-F])\.\s*(.*)$/u;
const STATEMENT = /^(\*?)([a-h])\)\s*(.*)$/u;
const ANSWER = /^answer\s*:\s*(.*)$/iu;
const POINTS = /^\[\s*(\d+(?:[.,]\d+)?)\s*(?:pts?|điểm|đ)\s*\]$/iu;
/** A points marker at the end of a `Câu N:` line (v1 put them there). */
export const TRAILING_POINTS =
  /\s*\[\s*(\d+(?:[.,]\d+)?)\s*(?:pts?|điểm|đ)\s*\]$/iu;
/** Everyone gets the points (B-10). */
const FREE = /^\[\s*(?:tặng điểm|free)\s*\]$/iu;
const EXPLANATION = /^giải thích\s*:\s*(.*)$/iu;
const IMAGE =
  /^!\[([^\]\n]*)\]\(media:([A-Za-z0-9][A-Za-z0-9/_.-]*)(?:\s+=(\d+)x(\d+))?\)$/u;

/** Classify one trimmed line in a question body. */
export function classifyLine(line: string): LineKind {
  let m = HEADER.exec(line);
  if (m) return { kind: "header", rest: m[1] ?? "" };
  m = OPTION.exec(line);
  if (m)
    return {
      kind: "option",
      correct: m[1] === "*",
      letter: m[2] ?? "",
      rest: m[3] ?? "",
    };
  m = STATEMENT.exec(line);
  if (m)
    return {
      kind: "statement",
      correct: m[1] === "*",
      letter: m[2] ?? "",
      rest: m[3] ?? "",
    };
  m = ANSWER.exec(line);
  if (m) return { kind: "answer", rest: m[1] ?? "" };
  m = POINTS.exec(line);
  if (m) return { kind: "points", raw: m[1] ?? "" };
  if (FREE.test(line)) return { kind: "free" };
  m = EXPLANATION.exec(line);
  if (m) return { kind: "explanation", rest: m[1] ?? "" };
  m = IMAGE.exec(line);
  if (m)
    return {
      kind: "image",
      alt: m[1] ?? "",
      path: m[2] ?? "",
      w: m[3] ? Number(m[3]) : undefined,
      h: m[4] ? Number(m[4]) : undefined,
    };
  return { kind: "text" };
}

/** Inside a `Giải thích:` block only a new `Câu N:` header is structural. */
export type Context = "body" | "explanation";

function isStructural(line: string, context: Context): boolean {
  const kind = classifyLine(line).kind;
  return context === "body" ? kind !== "text" : kind === "header";
}

/** Would this line be read as something other than plain text? */
export function isSpecial(line: string, context: Context): boolean {
  if (isStructural(line, context)) return true;
  return line.startsWith("\\") && isSpecial(line.slice(1), context);
}

/** Parser side: the plain text of an escaped line, or null if not escaped. */
export function unescapeLine(line: string, context: Context): string | null {
  return line.startsWith("\\") && isSpecial(line.slice(1), context)
    ? line.slice(1)
    : null;
}

/** Serializer side. */
export function escapeLine(line: string, context: Context): string {
  return isSpecial(line, context) ? `\\${line}` : line;
}

/** `1,5` → 1.5; null when it isn't a plain decimal number. */
export function parseDecimal(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Canonical short answer (04 §3.1): trimmed, and a plain decimal with a comma
 * gets a dot (`0,63` → `0.63`). Anything else is kept as typed.
 */
export function canonicalShortAnswer(raw: string): string {
  const s = raw.trim();
  return /^[+-]?\d+,\d+$/.test(s) ? s.replace(",", ".") : s;
}

/** `Answer: 0,63 ± 0,01` → answer and optional tolerance text. */
export function splitTolerance(rest: string): {
  answer: string;
  tolerance: string | null;
} {
  const m = /^(.*?)\s*(?:±|\+\/-|\+-)\s*(.*)$/u.exec(rest);
  return m
    ? { answer: m[1] ?? "", tolerance: m[2] ?? "" }
    : { answer: rest, tolerance: null };
}

/** Numbers in the text format always use a dot and no exponent padding. */
export function formatNumber(n: number): string {
  return String(n);
}

/** Normalize pasted text: NFC, `\n` line ends, no NBSP or tabs. */
export function normalizeInput(text: string): string {
  return text.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[ \t]/g, " ");
}
