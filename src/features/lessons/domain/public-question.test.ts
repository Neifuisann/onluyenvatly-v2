import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { questionArb } from "@/test/arbitraries";
import type { Question } from "../schema";
import {
  identityOrder,
  isPermutation,
  toPublicQuestion,
} from "./public-question";

const SECRET_KEYS = new Set(["answer", "tolerance", "explanation", "correct"]);

/** Every object key anywhere in a JSON-able value. */
function keysDeep(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) keysDeep(v, out);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysDeep(v, out);
    }
  return out;
}

/** A random permutation of 0..n-1 driven by fast-check. */
type WithOrder = { q: Question; order: number[] | undefined };
const withOrder: fc.Arbitrary<WithOrder> = questionArb.chain(
  (q): fc.Arbitrary<WithOrder> =>
    q.type === "mcq"
      ? fc
          .shuffledSubarray(identityOrder(q.options.length), {
            minLength: q.options.length,
            maxLength: q.options.length,
          })
          .map((order) => ({ q, order }))
      : fc.constant({ q, order: undefined }),
);

describe("toPublicQuestion", () => {
  it("never leaks answer, tolerance or explanation keys (property)", () => {
    fc.assert(
      fc.property(withOrder, ({ q, order }) => {
        const pub = toPublicQuestion(q, order);
        const json = JSON.parse(JSON.stringify(pub));
        for (const key of keysDeep(json))
          expect(SECRET_KEYS).not.toContain(key);
      }),
      { numRuns: 500 },
    );
  });

  it("drops unexpected keys smuggled into stored JSON", () => {
    const tainted = {
      id: "q_1",
      type: "mcq",
      stem: "S",
      answer: 0,
      correct: "A",
      explanation: "vì…",
      image: { path: "a.webp", answer: 1 },
      options: [
        { text: "x", correct: true, answer: true },
        { text: "y", image: { path: "b.webp", secret: "!" } },
      ],
    } as unknown as Question;
    const pub = toPublicQuestion(tainted);
    expect(pub).toEqual({
      id: "q_1",
      type: "mcq",
      stem: "S",
      image: { path: "a.webp" },
      options: [{ text: "x" }, { text: "y", image: { path: "b.webp" } }],
    });
  });

  it("applies the option order and keeps the multiset of options (property)", () => {
    fc.assert(
      fc.property(withOrder, ({ q, order }) => {
        const pub = toPublicQuestion(q, order);
        if (q.type !== "mcq" || pub.type !== "mcq" || !order) return;
        pub.options.forEach((o, i) => {
          expect(o.text).toBe(q.options[order[i] ?? -1]?.text);
        });
      }),
    );
  });

  it("keeps tf statements in order without answers", () => {
    const q: Question = {
      id: "q_2",
      type: "tf",
      stem: "Xét các phát biểu",
      statements: [
        { text: "a", answer: true },
        { text: "b", answer: false },
      ],
      explanation: "…",
    };
    expect(toPublicQuestion(q)).toEqual({
      id: "q_2",
      type: "tf",
      stem: "Xét các phát biểu",
      statements: [{ text: "a" }, { text: "b" }],
    });
  });

  it("reduces a short question to its stem", () => {
    const q: Question = {
      id: "q_3",
      type: "short",
      stem: "Tính T",
      answer: "0.63",
      tolerance: 0.01,
      points: 0.5,
    };
    expect(toPublicQuestion(q)).toEqual({
      id: "q_3",
      type: "short",
      stem: "Tính T",
    });
  });

  it("rejects an order that is not a permutation", () => {
    const q: Question = {
      id: "q_4",
      type: "mcq",
      stem: "S",
      options: [{ text: "a" }, { text: "b" }],
      answer: 0,
    };
    expect(() => toPublicQuestion(q, [0, 0])).toThrow();
    expect(() => toPublicQuestion(q, [0])).toThrow();
    expect(() => toPublicQuestion(q, [1, 2])).toThrow();
  });
});

describe("isPermutation", () => {
  it("checks length, range, integers and duplicates", () => {
    expect(isPermutation([2, 0, 1], 3)).toBe(true);
    expect(isPermutation([], 0)).toBe(true);
    expect(isPermutation([0, 1], 3)).toBe(false);
    expect(isPermutation([0, 0, 1], 3)).toBe(false);
    expect(isPermutation([0, 1, 3], 3)).toBe(false);
    expect(isPermutation([0, 1.5, 2], 3)).toBe(false);
  });
});
