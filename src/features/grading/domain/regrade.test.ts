import { describe, expect, it } from "vitest";
import type { AttemptItem } from "../../../db/schema";
import type { Question } from "../../lessons/schema";
import { gradeItem } from "./grade";
import { regradeAttempt } from "./regrade";

const mcq = (id: string, answer: number, extra: Partial<Question> = {}) =>
  ({
    id,
    type: "mcq",
    stem: id,
    options: [{ text: "a" }, { text: "b" }, { text: "c" }, { text: "d" }],
    answer,
    ...extra,
  }) as Question;

const items: AttemptItem[] = [
  { q: "q_1", p: 1 },
  // Shuffled: "A" shows original option 2.
  { q: "q_2", p: 1, o: [2, 0, 1, 3] },
  { q: "q_3", p: 2 },
];

const byId = (...qs: Question[]) => new Map(qs.map((q) => [q.id, q]));

describe("regradeAttempt", () => {
  const graded = {
    items,
    answers: ["A", "A", "B"],
    // Migrated-style mark on q_3 that a fresh grade would not give.
    earned: [1, 0, 1.5],
  };

  it("regrades only the changed question, through the option order", () => {
    const r = regradeAttempt(
      graded,
      byId(mcq("q_1", 0), mcq("q_2", 2), mcq("q_3", 3)),
      new Set(["q_2"]),
      new Map(),
      "thpt2025",
    );
    expect(r).toEqual({
      items,
      earned: [1, 1, 1.5],
      score: 3.5,
      maxScore: 4,
      score10: 8.75,
    });
  });

  it("is null when no mark or points move (a text-only fix)", () => {
    expect(
      regradeAttempt(
        graded,
        byId(mcq("q_1", 0, { stem: "typo fixed" })),
        new Set(["q_1"]),
        new Map(),
        "thpt2025",
      ),
    ).toBeNull();
    expect(
      regradeAttempt(
        { items, answers: [null, null, null], earned: null },
        byId(mcq("q_1", 0)),
        new Set(["q_1"]),
        new Map(),
        "thpt2025",
      ),
    ).toBeNull();
  });

  it("is null when the attempt has none of the changed questions", () => {
    expect(
      regradeAttempt(graded, byId(), new Set(["q_9"]), new Map(), "thpt2025"),
    ).toBeNull();
  });

  it("drops a removed question from the total", () => {
    const r = regradeAttempt(
      graded,
      byId(mcq("q_1", 0, { removed: true })),
      new Set(["q_1"]),
      new Map([["q_1", 0]]),
      "thpt2025",
    );
    expect(r?.items[0]).toEqual({ q: "q_1", p: 0 });
    expect(r).toMatchObject({
      earned: [0, 0, 1.5],
      score: 1.5,
      maxScore: 3,
      score10: 5,
    });
  });

  it("gives a free question's points even to a blank answer", () => {
    const r = regradeAttempt(
      { ...graded, answers: [null, "A", "B"], earned: [0, 0, 1.5] },
      byId(mcq("q_1", 3, { free: true })),
      new Set(["q_1"]),
      new Map(),
      "thpt2025",
    );
    expect(r).toMatchObject({ earned: [1, 0, 1.5], score: 2.5 });
    expect(
      gradeItem(
        mcq("q_1", 3, { free: true }),
        { q: "q_1", p: 1 },
        null,
        "thpt2025",
      ).outcome,
    ).toBe("correct");
  });

  it("keeps the stored mark of a changed question the version no longer has", () => {
    expect(
      regradeAttempt(graded, byId(), new Set(["q_1"]), new Map(), "thpt2025"),
    ).toBeNull();
  });

  it("scores 0 when every question of the attempt is removed", () => {
    const r = regradeAttempt(
      { items: [{ q: "q_1", p: 1 }], answers: ["A"], earned: [1] },
      byId(mcq("q_1", 0, { removed: true })),
      new Set(["q_1"]),
      new Map([["q_1", 0]]),
      "thpt2025",
    );
    expect(r).toMatchObject({ earned: [0], score: 0, maxScore: 0, score10: 0 });
  });

  it("reads missing answers as blank and missing marks as 0", () => {
    const r = regradeAttempt(
      {
        items: [
          { q: "q_1", p: 1 },
          { q: "q_2", p: 1 },
        ],
        answers: [],
        earned: [],
      },
      byId(mcq("q_1", 0, { free: true })),
      new Set(["q_1"]),
      new Map(),
      "thpt2025",
    );
    expect(r).toMatchObject({
      earned: [1, 0],
      score: 1,
      maxScore: 2,
      score10: 5,
    });
  });

  it("re-prices an attempt in progress without grading it", () => {
    const r = regradeAttempt(
      { items, answers: [null, null, null], earned: null },
      byId(mcq("q_3", 0)),
      new Set(["q_3"]),
      new Map([["q_3", 0.5]]),
      "thpt2025",
    );
    expect(r).toEqual({
      items: [items[0], items[1], { q: "q_3", p: 0.5 }],
      earned: null,
      score: null,
      maxScore: 2.5,
      score10: null,
    });
  });
});
