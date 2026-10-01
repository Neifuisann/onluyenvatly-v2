/** S9-06: preserve embedded content and recorded marks; never re-grade history. */
import type { AttemptAnswer } from "../../../db/schema.ts";
import type { Question } from "../schema.ts";
import { cleanLegacyText, normalizeV1Questions } from "./legacy.ts";

type Row = Record<string, unknown>;
export function stableLegacyJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableLegacyJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableLegacyJson(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export const legacyStem = (value: string) =>
  cleanLegacyText(value)
    .text.replace(/\s*\[\s*\d+(?:[.,]\d+)?\s*pts?\s*\]\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("vi");
const text = (value: unknown): string =>
  typeof value === "object" && value !== null
    ? String((value as Row).text ?? "")
    : String(value ?? "");
const bool = (value: unknown): boolean | null =>
  value === true || value === "true"
    ? true
    : value === false || value === "false"
      ? false
      : null;
const blank = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === "" ||
  value === "Chưa trả lời";
function choice(value: unknown, options: unknown[]): number | null {
  if (blank(value)) return null;
  const exact = options.flatMap((o, i) => (text(o) === text(value) ? [i] : []));
  if (exact.length === 1) return exact[0] ?? null;
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < options.length
  )
    return value;
  const letter = /^([A-F])[.)]?$/i.exec(String(value).trim());
  const index = letter?.[1]?.toUpperCase().charCodeAt(0);
  return index !== undefined && index - 65 < options.length ? index - 65 : null;
}

/** Canonical options remove shuffled-order differences from snapshot hashes. */
export function canonicalLegacyQuestion(question: Question): {
  question: Question;
  order?: number[];
} {
  const { points: _points, explanation: _explanation, ...content } = question;
  if (content.type !== "mcq") return { question: content };
  const sorted = content.options
    .map((o, index) => ({ o, index }))
    .sort(
      (a, b) =>
        JSON.stringify(a.o).localeCompare(JSON.stringify(b.o)) ||
        a.index - b.index,
    );
  const order = content.options.map((_, index) =>
    sorted.findIndex((s) => s.index === index),
  );
  return {
    question: {
      ...content,
      options: sorted.map((s) => s.o),
      answer: order[content.answer] ?? 0,
    },
    order,
  };
}
const contentKey = (q: Question) => {
  const { id: _id, ...content } = canonicalLegacyQuestion(q).question;
  return stableLegacyJson(content);
};
export type LegacyResultItem = {
  question: Question;
  historical: boolean;
  order?: number[];
  points: number;
  answer: AttemptAnswer;
  earned: number;
};
export function normalizeLegacyResult(
  raw: unknown,
  current: readonly Question[],
  historicalId: (content: string) => string,
): LegacyResultItem[] {
  if (!Array.isArray(raw) || raw.length === 0)
    throw new Error("empty result questions");
  const index = current.map((question) => ({
    question,
    stem: legacyStem(question.stem),
  }));
  return raw.map((value): LegacyResultItem => {
    if (!value || typeof value !== "object")
      throw new Error("invalid result question");
    const row = value as Row;
    const options = Array.isArray(row.optionsText)
      ? row.optionsText
      : Array.isArray(row.options)
        ? row.options
        : [];
    const type = String(row.type ?? "abcd");
    const isMcq = ["abcd", "multiple_choice"].includes(type);
    const isTf = ["truefalse", "true_false"].includes(type);
    const key = row.correctAnswer ?? row.correct;
    const correct = isMcq ? choice(key, options) : key;
    if (isMcq && correct === null) throw new Error("unresolved result key");
    const normalized = normalizeV1Questions([
      { ...row, id: "q_snapshot", options, correct },
    ]);
    const parsed = normalized.questions[0];
    if (!parsed || normalized.problems.some((p) => p.severity === "error"))
      throw new Error("invalid embedded question");
    const points = Number(row.points ?? parsed.points ?? 1);
    const earned = Number(row.earnedPoints);
    if (
      row.earnedPoints === undefined ||
      !Number.isFinite(earned) ||
      !Number.isFinite(points) ||
      points < 0 ||
      points > 100 ||
      earned < 0 ||
      earned > points + 0.011
    )
      throw new Error("invalid recorded marks");
    let answer: AttemptAnswer;
    if (isMcq) {
      const index = choice(row.userAnswer, options);
      if (!blank(row.userAnswer) && index === null)
        throw new Error("unresolved result choice");
      answer = index === null ? null : String.fromCharCode(65 + index);
    } else if (isTf) {
      if (!blank(row.userAnswer) && !Array.isArray(row.userAnswer))
        throw new Error("invalid result statements");
      const given: unknown[] = Array.isArray(row.userAnswer)
        ? row.userAnswer
        : [];
      if (
        given.length > options.length ||
        given.some((v) => !blank(v) && bool(v) === null)
      )
        throw new Error("invalid result statements");
      answer = options.map((_, i) => bool(given[i]));
    } else answer = blank(row.userAnswer) ? null : String(row.userAnswer);
    const stem = legacyStem(parsed.stem);
    const matches = index
      .filter(
        (entry) => entry.question.type === parsed.type && entry.stem === stem,
      )
      .map((entry) => entry.question);
    const matching = matches.find((q) => contentKey(q) === contentKey(parsed));
    if (matching) {
      if (matching.type === "mcq" && parsed.type === "mcq") {
        const remaining = new Set(matching.options.map((_, i) => i));
        const order = parsed.options.map((option) => {
          const index = [...remaining].find(
            (i) =>
              JSON.stringify(matching.options[i]) === JSON.stringify(option),
          );
          if (index === undefined) throw new Error("ambiguous option mapping");
          remaining.delete(index);
          return index;
        });
        return {
          question: matching,
          historical: false,
          order,
          points,
          answer,
          earned,
        };
      }
      return { question: matching, historical: false, points, answer, earned };
    }
    const canonical = canonicalLegacyQuestion(parsed);
    canonical.question.id =
      matches.length === 1
        ? (matches[0]?.id ?? historicalId(contentKey(parsed)))
        : historicalId(contentKey(parsed));
    return {
      question: canonical.question,
      historical: true,
      ...(canonical.order && { order: canonical.order }),
      points,
      answer,
      earned,
    };
  });
}
