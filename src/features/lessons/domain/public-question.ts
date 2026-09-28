/**
 * The taking view of a question (04 §3.1, ADR-004). This is the ONLY way
 * question data reaches a browser before submit.
 *
 * Every field is copied explicitly (never spread), so answers, tolerance,
 * explanations and any unexpected keys in stored JSON are dropped by
 * construction.
 */
import type { Media, Question, QuestionType } from "../schema.ts";

export type PublicMedia = Media;

type PublicBase = {
  id: string;
  stem: string;
  image?: PublicMedia;
};

export type PublicQuestion =
  | (PublicBase & {
      type: "mcq";
      /** In display order (after `optionOrder`). */
      options: { text: string; image?: PublicMedia }[];
    })
  | (PublicBase & { type: "tf"; statements: { text: string }[] })
  | (PublicBase & { type: "short" });

export type PublicQuestionOf<T extends QuestionType> = Extract<
  PublicQuestion,
  { type: T }
>;

function copyMedia(m: Media): PublicMedia {
  return {
    path: m.path,
    ...(m.w !== undefined && { w: m.w }),
    ...(m.h !== undefined && { h: m.h }),
    ...(m.alt !== undefined && { alt: m.alt }),
  };
}

export function identityOrder(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export function isPermutation(order: readonly number[], n: number): boolean {
  if (order.length !== n) return false;
  const seen = new Set<number>();
  for (const i of order) {
    if (!Number.isInteger(i) || i < 0 || i >= n || seen.has(i)) return false;
    seen.add(i);
  }
  return true;
}

/**
 * @param optionOrder mcq only: original option indexes in display order, e.g.
 *   `[2, 0, 3, 1]` shows original option 2 as "A". Defaults to the stored order.
 */
export function toPublicQuestion(
  q: Question,
  optionOrder?: readonly number[],
): PublicQuestion {
  const base: PublicBase = {
    id: q.id,
    stem: q.stem,
    ...(q.image && { image: copyMedia(q.image) }),
  };
  switch (q.type) {
    case "mcq": {
      const order = optionOrder ?? identityOrder(q.options.length);
      if (!isPermutation(order, q.options.length))
        throw new Error(`Invalid option order for question ${q.id}`);
      return {
        ...base,
        type: "mcq",
        options: order.map((i) => {
          const o = q.options[i];
          if (!o) throw new Error(`Missing option ${i} in question ${q.id}`);
          return {
            text: o.text,
            ...(o.image && { image: copyMedia(o.image) }),
          };
        }),
      };
    }
    case "tf":
      return {
        ...base,
        type: "tf",
        statements: q.statements.map((s) => ({ text: s.text })),
      };
    case "short":
      return { ...base, type: "short" };
  }
}
