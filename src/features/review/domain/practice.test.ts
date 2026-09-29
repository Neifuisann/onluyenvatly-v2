import { describe, expect, it } from "vitest";
import { createRng } from "../../attempts/domain/random.ts";
import type { Question } from "../../lessons/schema.ts";
import {
  addChecked,
  BANK_MAX_PAGES,
  canPractice,
  lessonAllowsPractice,
  lockChecked,
  parseReviewParams,
  pickMistakes,
  practiceFeedback,
  REVIEW_POINTS,
  reviewHref,
  reviewItems,
  summarizeBank,
} from "./practice.ts";

const now = new Date("2026-10-20T02:00:00Z");

describe("canPractice", () => {
  it("follows the result page's reveal rule for students", () => {
    expect(canPractice("after_submit", null, now)).toBe(true);
    expect(canPractice("never", null, now)).toBe(false);
    expect(canPractice("after_deadline", null, now)).toBe(false);
    expect(
      canPractice("after_deadline", new Date(now.getTime() - 1), now),
    ).toBe(true);
    expect(
      canPractice("after_deadline", new Date(now.getTime() + 1), now),
    ).toBe(false);
  });

  it("reads a lesson's schedule", () => {
    const schedule = {
      revealAnswers: "after_deadline" as const,
      startsAt: "2026-10-20T00:00:00Z",
      timeLimitSec: 600,
    };
    expect(lessonAllowsPractice(schedule, now)).toBe(true);
    expect(
      lessonAllowsPractice(schedule, new Date("2026-10-20T00:05:00Z")),
    ).toBe(false);
    expect(
      lessonAllowsPractice(
        { revealAnswers: "after_submit", startsAt: null, timeLimitSec: null },
        now,
      ),
    ).toBe(true);
  });
});

describe("pickMistakes", () => {
  const c = (questionId: string, wrongCount: number, day: number) => ({
    lessonId: 1,
    questionId,
    versionId: 1,
    wrongCount,
    updatedAt: new Date(Date.UTC(2026, 9, day)),
  });
  const all = [c("a", 1, 5), c("b", 3, 9), c("c", 3, 2), c("d", 2, 1)];

  it("takes the most missed, then the oldest, in random order", () => {
    const picked = pickMistakes(all, 3, createRng(7));
    expect(picked.map((p) => p.questionId).sort()).toEqual(["b", "c", "d"]);
    expect(pickMistakes(all, 10, createRng(1))).toHaveLength(4);
    expect(pickMistakes(all, 0, createRng(1))).toEqual([]);
    expect(pickMistakes(all, -1, createRng(1))).toEqual([]);
  });

  it("is reproducible for a seed", () => {
    expect(pickMistakes(all, 4, createRng(3))).toEqual(
      pickMistakes(all, 4, createRng(3)),
    );
  });
});

const mcq: Question = {
  id: "q_m",
  type: "mcq",
  stem: "?",
  options: [{ text: "a" }, { text: "b" }, { text: "c" }, { text: "d" }],
  answer: 2,
};
const tf: Question = {
  id: "q_t",
  type: "tf",
  stem: "?",
  statements: [
    { text: "1", answer: true },
    { text: "2", answer: false },
    { text: "3", answer: true },
    { text: "4", answer: true },
  ],
};
const short: Question = { id: "q_s", type: "short", stem: "?", answer: "1.5" };

describe("reviewItems", () => {
  it("keeps each version, shuffles mcq options, one point each", () => {
    const items = reviewItems(
      [
        { question: mcq, versionId: 7 },
        { question: tf, versionId: 8 },
      ],
      createRng(1),
    );
    expect(items[0]).toMatchObject({ q: "q_m", v: 7, p: REVIEW_POINTS });
    expect([...(items[0]?.o ?? [])].sort()).toEqual([0, 1, 2, 3]);
    expect(items[1]).toEqual({ q: "q_t", v: 8, p: REVIEW_POINTS });
  });
});

describe("locking", () => {
  it("keeps checked answers as stored", () => {
    expect(lockChecked(["A", "B", null], ["C", null, "x"], [0, 2])).toEqual([
      "C",
      "B",
      "x",
    ]);
    expect(lockChecked(["A"], [], [0])).toEqual([null]);
    expect(lockChecked(["A", "B"], ["C", "D"], [])).toEqual(["A", "B"]);
  });

  it("adds an index once, ascending", () => {
    expect(addChecked([3, 1], 2)).toEqual([1, 2, 3]);
    expect(addChecked([1], 1)).toEqual([1]);
  });
});

describe("practiceFeedback", () => {
  const item = { q: "q_m", v: 1, o: [2, 0, 1, 3], p: 1 };

  it("grades in display terms and gives the key", () => {
    expect(practiceFeedback(mcq, item, "A")).toEqual({
      outcome: "correct",
      earned: 1,
      max: 1,
      expected: "A",
    });
    expect(practiceFeedback(mcq, item, "B")).toMatchObject({
      outcome: "wrong",
      expected: "A",
    });
  });

  it("scores tf on the exam scale and short answers with a comma", () => {
    expect(
      practiceFeedback(tf, { q: "q_t", p: 1 }, [true, false, true, false]),
    ).toMatchObject({ outcome: "partial", earned: 0.5 });
    expect(practiceFeedback(short, { q: "q_s", p: 1 }, "1,5")).toMatchObject({
      outcome: "correct",
      expected: "1.5",
    });
    expect(practiceFeedback(short, { q: "q_s", p: 1 }, null)).toMatchObject({
      outcome: "blank",
    });
  });
});

describe("summarizeBank", () => {
  const groups = [
    {
      lessonId: 1,
      chapter: "Sóng cơ",
      questionType: "mcq",
      count: 4,
      practicable: true,
    },
    {
      lessonId: 1,
      chapter: "Sóng cơ",
      questionType: "tf",
      count: 2,
      practicable: true,
    },
    {
      lessonId: 2,
      chapter: "Dao động cơ",
      questionType: "mcq",
      count: 3,
      practicable: false,
    },
    {
      lessonId: 3,
      chapter: null,
      questionType: "short",
      count: 1,
      practicable: true,
    },
    {
      lessonId: 4,
      chapter: "Điện",
      questionType: null,
      count: 1,
      practicable: true,
    },
  ] as const;

  it("counts everything without filters", () => {
    expect(summarizeBank(groups, { chapter: null, type: null })).toEqual({
      total: 11,
      chapters: [
        { name: "Dao động cơ", count: 3 },
        { name: "Điện", count: 1 },
        { name: "Sóng cơ", count: 6 },
      ],
      types: { mcq: 7, tf: 2, short: 1 },
      matching: 11,
      practicable: 8,
    });
  });

  it("filters by chapter, then type", () => {
    const s = summarizeBank(groups, { chapter: "Sóng cơ", type: "mcq" });
    expect(s).toMatchObject({
      total: 11,
      types: { mcq: 4, tf: 2, short: 0 },
      matching: 4,
      practicable: 4,
    });
    expect(summarizeBank(groups, { chapter: null, type: "mcq" })).toMatchObject(
      { matching: 7, practicable: 4 },
    );
  });
});

describe("params", () => {
  it("parses valid values and drops the rest", () => {
    expect(
      parseReviewParams({ chapter: " Sóng cơ ", type: "tf", page: "3" }),
    ).toEqual({ chapter: "Sóng cơ", type: "tf", page: 3 });
    expect(
      parseReviewParams({ chapter: ["x", "y"], type: "essay", page: "0" }),
    ).toEqual({ chapter: "x", type: null, page: 1 });
    expect(parseReviewParams({ chapter: "c".repeat(101), page: "99" })).toEqual(
      { chapter: null, type: null, page: BANK_MAX_PAGES },
    );
    expect(parseReviewParams({ page: "1.5" }).page).toBe(1);
  });

  it("builds URLs, resetting the page on a new filter", () => {
    const p = { chapter: "Sóng cơ", type: "mcq" as const, page: 2 };
    expect(reviewHref(p, { type: null })).toBe(
      "/review?chapter=S%C3%B3ng+c%C6%A1",
    );
    expect(reviewHref(p, { page: 3 })).toBe(
      "/review?chapter=S%C3%B3ng+c%C6%A1&type=mcq&page=3",
    );
    expect(reviewHref({ chapter: null, type: null, page: 4 }, {})).toBe(
      "/review",
    );
  });
});
