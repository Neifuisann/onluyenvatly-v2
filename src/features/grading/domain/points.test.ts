import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Question } from "@/features/lessons/schema";
import { distributePoints, pointsPlan, round2, toCents } from "./points";

const q = (type: Question["type"], id: string, points?: number): Question =>
  ({
    id,
    type,
    stem: id,
    ...(points !== undefined && { points }),
    ...(type === "mcq" && {
      options: [{ text: "a" }, { text: "b" }],
      answer: 0,
    }),
    ...(type === "tf" && {
      statements: [
        { text: "a", answer: true },
        { text: "b", answer: false },
      ],
    }),
    ...(type === "short" && { answer: "1" }),
  }) as Question;

describe("distributePoints (v1 remainder cents)", () => {
  it("golden: 1.00 over 3 questions → [0.34, 0.33, 0.33]", () => {
    expect(distributePoints(1, 3)).toEqual([0.34, 0.33, 0.33]);
  });

  it("handles even splits, zero totals and zero questions", () => {
    expect(distributePoints(3, 12)).toEqual(Array(12).fill(0.25));
    expect(distributePoints(0, 2)).toEqual([0, 0]);
    expect(distributePoints(1, 0)).toEqual([]);
    expect(distributePoints(0.01, 3)).toEqual([0.01, 0, 0]);
  });

  it("always sums exactly to the total (property)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 1, max: 200 }),
        (cents, n) => {
          const parts = distributePoints(cents / 100, n);
          expect(parts).toHaveLength(n);
          expect(parts.reduce((s, p) => s + toCents(p), 0)).toBe(cents);
          expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(
            0.0100001,
          );
        },
      ),
    );
  });
});

describe("pointsPlan", () => {
  const qs = [
    q("mcq", "q_1"),
    q("tf", "q_2", 2),
    q("mcq", "q_3", 0.5),
    q("short", "q_4"),
    q("mcq", "q_5"),
  ];

  it("per-question: the question's own points, else 1", () => {
    expect(pointsPlan(qs, { mode: "per-question" })).toEqual([1, 2, 0.5, 1, 1]);
  });

  it("per-type-total: splits each type's total in display order", () => {
    expect(
      pointsPlan(qs, { mode: "per-type-total", mcq: 1, tf: 4, short: 0.5 }),
    ).toEqual([0.34, 4, 0.33, 0.5, 0.33]);
  });

  it("falls back to per-question points for a type without a total", () => {
    expect(pointsPlan(qs, { mode: "per-type-total", mcq: 3 })).toEqual([
      1, 2, 1, 1, 1,
    ]);
  });
});

describe("round2", () => {
  it("rounds half up despite float noise", () => {
    expect(round2(0.025)).toBe(0.03);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(7.142857)).toBe(7.14);
  });
});
