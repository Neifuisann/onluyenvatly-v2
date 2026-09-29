import { describe, expect, it } from "vitest";
import type { Question } from "../../lessons/schema.ts";
import {
  buildReview,
  correctCount,
  countOutcomes,
  matchesFilter,
  outcomeOf,
  revealFor,
} from "./review.ts";

const now = new Date("2026-10-20T02:00:00Z");
const at = (ms: number) => new Date(now.getTime() + ms);

describe("revealFor", () => {
  it("shows after submit, hides for never", () => {
    expect(revealFor("after_submit", at(1e6), now, false)).toEqual({
      kind: "shown",
    });
    expect(revealFor("never", null, now, false)).toEqual({ kind: "never" });
  });

  it("waits for the lesson's reveal time", () => {
    expect(revealFor("after_deadline", at(1), now, false)).toEqual({
      kind: "later",
      at: at(1),
    });
    expect(revealFor("after_deadline", now, now, false)).toEqual({
      kind: "shown",
    });
  });

  it("keeps an unscheduled after_deadline lesson hidden", () => {
    expect(revealFor("after_deadline", null, now, false)).toEqual({
      kind: "never",
    });
  });

  it("always shows admins", () => {
    expect(revealFor("never", null, now, true)).toEqual({ kind: "shown" });
    expect(revealFor("after_deadline", at(1e6), now, true)).toEqual({
      kind: "shown",
    });
  });
});

describe("outcomeOf", () => {
  it.each([
    [1, 1, "A", "correct"],
    [0.25, 1, [true, true, null, false], "partial"],
    [0, 1, "B", "wrong"],
    [0, 1, null, "blank"],
    [0, 1, " ", "blank"],
    [0, 1, [null, null], "blank"],
    [0, 0, "A", "wrong"],
  ] as const)("%f of %f (%j) → %s", (earned, max, answer, outcome) => {
    expect(outcomeOf(earned, max, answer)).toBe(outcome);
  });
});

describe("buildReview", () => {
  const questions: Question[] = [
    {
      id: "m",
      type: "mcq",
      stem: "?",
      options: [{ text: "a" }, { text: "b" }, { text: "c" }],
      answer: 2,
      explanation: "vì c",
    },
    {
      id: "t",
      type: "tf",
      stem: "?",
      statements: [
        { text: "1", answer: true },
        { text: "2", answer: false },
      ],
    },
    { id: "s", type: "short", stem: "?", answer: "1.5" },
  ];
  const byId = new Map(questions.map((q) => [q.id, q]));
  const items = [
    { q: "m", o: [2, 0, 1], p: 1 },
    { q: "t", p: 1 },
    { q: "s", p: 1 },
  ];

  it("gives marks, outcomes and both answers in display terms", () => {
    const entries = buildReview(
      items,
      ["A", [true, true], null],
      [1, 0.5, 0],
      byId,
    );
    expect(
      entries.map(({ index, outcome, given, expected, earned }) => ({
        index,
        outcome,
        given,
        expected,
        earned,
      })),
    ).toEqual([
      { index: 0, outcome: "correct", given: "A", expected: "A", earned: 1 },
      {
        index: 1,
        outcome: "partial",
        given: [true, true],
        expected: [true, false],
        earned: 0.5,
      },
      { index: 2, outcome: "blank", given: null, expected: "1.5", earned: 0 },
    ]);
    expect(entries[0]?.question.explanation).toBe("vì c");
  });

  it("tolerates missing answers and marks", () => {
    const entries = buildReview(items, [], null, byId);
    expect(entries.map((e) => e.outcome)).toEqual(["blank", "blank", "blank"]);
  });

  it("takes questions aligned with the items (review attempts)", () => {
    const entries = buildReview(items, ["A"], [1], questions);
    expect(entries.map((e) => e.question.id)).toEqual(["m", "t", "s"]);
    expect(() => buildReview([{ q: "t", p: 1 }], [], null, questions)).toThrow(
      /missing/,
    );
  });

  it("refuses items whose question is missing", () => {
    expect(() => buildReview([{ q: "x", p: 1 }], [], null, byId)).toThrow(
      /missing/,
    );
  });
});

describe("filters", () => {
  const entries = [
    { outcome: "correct" },
    { outcome: "partial" },
    { outcome: "blank" },
    { outcome: "wrong" },
  ] as const;

  it("counts right and everything else", () => {
    expect(countOutcomes(entries)).toEqual({ all: 4, right: 1, wrong: 3 });
  });

  it("matches by filter", () => {
    const pick = (f: "all" | "wrong" | "right") =>
      entries.filter((e) => matchesFilter(e.outcome, f)).length;
    expect([pick("all"), pick("wrong"), pick("right")]).toEqual([4, 3, 1]);
  });
});

describe("correctCount", () => {
  it("counts full marks only", () => {
    const items = [{ p: 1 }, { p: 0.25 }, { p: 1 }, { p: 0 }];
    expect(correctCount(items, [1, 0.25, 0.5, 0])).toBe(2);
    expect(correctCount(items, null)).toBe(0);
  });
});
