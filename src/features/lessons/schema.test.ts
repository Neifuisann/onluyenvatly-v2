import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { questionArb, questionsArb } from "@/test/arbitraries";
import {
  DEFAULT_LESSON_CONFIG,
  LessonConfigSchema,
  type Question,
  QuestionSchema,
  QuestionsSchema,
} from "./schema";

const mcq: Question = {
  id: "q_ab12cd34",
  type: "mcq",
  stem: "Biên độ là",
  options: [{ text: "2 cm" }, { text: "5 cm" }],
  answer: 1,
};

describe("QuestionSchema", () => {
  it("accepts every generated question", () => {
    fc.assert(
      fc.property(questionArb, (q) => {
        expect(QuestionSchema.safeParse(q).success).toBe(true);
      }),
    );
  });

  it.each([
    ["mcq answer out of range", { ...mcq, answer: 2 }],
    ["mcq with one option", { ...mcq, options: [{ text: "x" }], answer: 0 }],
    ["blank stem", { ...mcq, stem: "   " }],
    [
      "blank tf stem without image",
      {
        id: "q_1",
        type: "tf",
        stem: "",
        statements: [
          { text: "x", answer: true },
          { text: "y", answer: false },
        ],
      },
    ],
    ["unknown keys", { ...mcq, correct: "B" }],
    ["bad id", { ...mcq, id: "123" }],
    [
      "media path with a scheme",
      { ...mcq, image: { path: "https://x/y.png" } },
    ],
    ["media path with ..", { ...mcq, image: { path: "a/../b.webp" } }],
    [
      "tf with one statement",
      {
        id: "q_1",
        type: "tf",
        stem: "S",
        statements: [{ text: "a", answer: true }],
      },
    ],
    [
      "short without answer",
      { id: "q_1", type: "short", stem: "S", answer: " " },
    ],
    ["negative points", { ...mcq, points: -1 }],
    ["points above 100", { ...mcq, points: 101 }],
  ])("rejects %s", (_, value) => {
    expect(QuestionSchema.safeParse(value).success).toBe(false);
  });

  it("allows an image-only stem", () => {
    expect(
      QuestionSchema.safeParse({ ...mcq, stem: "", image: { path: "a.webp" } })
        .success,
    ).toBe(true);
  });

  it("allows an image-only option", () => {
    const q = {
      ...mcq,
      options: [{ text: "", image: { path: "a.webp" } }, { text: "x" }],
    };
    expect(QuestionSchema.safeParse(q).success).toBe(true);
  });
});

describe("QuestionsSchema", () => {
  it("accepts generated lessons", () => {
    fc.assert(
      fc.property(questionsArb, (qs) => {
        expect(QuestionsSchema.safeParse(qs).success).toBe(true);
      }),
    );
  });

  it("rejects duplicate ids and empty lessons", () => {
    expect(QuestionsSchema.safeParse([mcq, mcq]).success).toBe(false);
    expect(QuestionsSchema.safeParse([]).success).toBe(false);
  });
});

describe("LessonConfigSchema", () => {
  it("accepts the defaults", () => {
    expect(LessonConfigSchema.parse(DEFAULT_LESSON_CONFIG)).toEqual(
      DEFAULT_LESSON_CONFIG,
    );
  });

  it("accepts a THPT-style pool with per-type totals", () => {
    const config = {
      ...DEFAULT_LESSON_CONFIG,
      timeLimitSec: 50 * 60,
      pool: { enabled: true, byType: { mcq: 18, tf: 4, short: 6 } },
      points: { mode: "per-type-total", mcq: 4.5, tf: 4, short: 1.5 },
    };
    expect(LessonConfigSchema.safeParse(config).success).toBe(true);
  });

  it.each([
    ["an enabled pool with no size", { pool: { enabled: true } }],
    [
      "an enabled pool with zero counts",
      { pool: { enabled: true, byType: { mcq: 0 } } },
    ],
    ["a 10-second limit", { timeLimitSec: 10 }],
    ["zero max attempts", { maxAttempts: 0 }],
    ["an unknown reveal policy", { revealAnswers: "later" }],
    ["unknown keys", { shuffleAnswers: true }],
  ])("rejects %s", (_, patch) => {
    expect(
      LessonConfigSchema.safeParse({ ...DEFAULT_LESSON_CONFIG, ...patch })
        .success,
    ).toBe(false);
  });
});
