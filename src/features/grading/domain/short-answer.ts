/**
 * Short-answer normalization and comparison (04 §4). Pure; also used by the
 * runner to show students how their answer will be read.
 */

/** Trim, drop every space, `,` → `.`, drop a trailing `.`. */
export function normalizeShortAnswer(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/,/g, ".").replace(/\.$/, "");
}

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/** The number a normalized answer spells, or null ("1/2", "abc", ""). */
export function parseShortNumber(normalized: string): number | null {
  if (!NUMBER.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Numbers are compared exactly, up to floating-point noise, unless the
 * question sets an absolute tolerance: "1,5" = "1.5" = " 1.50 ", but "0.628"
 * is not "0.63" (THPT answers must be rounded as the question asks). Answers
 * that aren't numbers fall back to a case-insensitive normalized comparison.
 */
export function shortAnswerMatches(
  given: string,
  expected: string,
  tolerance = 0,
): boolean {
  const a = normalizeShortAnswer(given);
  if (a === "") return false;
  const b = normalizeShortAnswer(expected);
  const x = parseShortNumber(a);
  const y = parseShortNumber(b);
  if (x !== null && y !== null) {
    const noise = 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
    return Math.abs(x - y) <= tolerance + noise;
  }
  return a.toLowerCase() === b.toLowerCase();
}
