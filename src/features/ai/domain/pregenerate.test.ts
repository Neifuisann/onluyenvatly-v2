import { describe, expect, it } from "vitest";
import type { Question } from "../../lessons/schema";
import { MAX_EXPLANATION_CHARS, questionHash } from "./explain";
import {
  countPlan,
  ExplanationTextSchema,
  nextMissing,
  PREGEN_INTERVAL_MS,
  PREGEN_PER_MINUTE,
  planRows,
  remainingCount,
} from "./pregenerate";

const mcq = (id: string, stem: string): Question => ({
  id,
  type: "mcq",
  stem,
  options: [{ text: "a" }, { text: "b" }],
  answer: 0,
});

const questions: Question[] = [
  mcq("q_1", "Một"),
  { ...mcq("q_2", "Hai"), explanation: "Giáo viên" },
  mcq("q_3", "Ba"),
  // Same content as q_1: one explanation serves both.
  mcq("q_4", "Một"),
];
const rows = planRows(questions);
const [h1, , h3] = rows.map((r) => r.hash);

describe("planRows", () => {
  it("numbers the questions and hashes those without teacher text", () => {
    expect(rows.map((r) => [r.position, r.question.id])).toEqual([
      [1, "q_1"],
      [2, "q_2"],
      [3, "q_3"],
      [4, "q_4"],
    ]);
    expect(rows[1]?.hash).toBeNull();
    expect(h1).toBe(questionHash(questions[0] as Question));
    expect(rows[3]?.hash).toBe(h1);
  });
});

describe("countPlan", () => {
  it("counts teacher, stored and missing questions", () => {
    expect(countPlan(rows, new Set())).toEqual({
      total: 4,
      teacher: 1,
      stored: 0,
      missing: 3,
    });
    expect(countPlan(rows, new Set([h1 as string]))).toEqual({
      total: 4,
      teacher: 1,
      stored: 2,
      missing: 1,
    });
  });
});

describe("nextMissing / remainingCount", () => {
  it("goes in order and counts distinct questions left", () => {
    expect(nextMissing(rows, new Set(), new Set())?.question.id).toBe("q_1");
    expect(remainingCount(rows, new Set(), new Set())).toBe(2);
    const stored = new Set([h1 as string]);
    expect(nextMissing(rows, stored, new Set())?.question.id).toBe("q_3");
    expect(remainingCount(rows, stored, new Set())).toBe(1);
  });

  it("skips questions that failed in this run, with their duplicates", () => {
    expect(nextMissing(rows, new Set(), new Set(["q_1"]))?.question.id).toBe(
      "q_3",
    );
    expect(remainingCount(rows, new Set(), new Set(["q_1"]))).toBe(1);
    expect(remainingCount(rows, new Set(), new Set(["q_4"]))).toBe(1);
    expect(
      nextMissing(rows, new Set(), new Set(["q_1", "q_3", "q_4"])),
    ).toBeNull();
  });

  it("is done when everything is stored", () => {
    const all = new Set([h1 as string, h3 as string]);
    expect(nextMissing(rows, all, new Set())).toBeNull();
    expect(remainingCount(rows, all, new Set())).toBe(0);
  });
});

describe("pace", () => {
  it("spaces calls to stay under the per-minute budget", () => {
    expect(PREGEN_INTERVAL_MS * PREGEN_PER_MINUTE).toBe(60_000);
  });
});

describe("ExplanationTextSchema", () => {
  it("trims and normalizes line breaks", () => {
    expect(ExplanationTextSchema.parse("  a\r\nb  ")).toBe("a\nb");
  });

  it("refuses empty or overlong text", () => {
    expect(ExplanationTextSchema.safeParse("   ").success).toBe(false);
    expect(
      ExplanationTextSchema.safeParse("x".repeat(MAX_EXPLANATION_CHARS + 1))
        .success,
    ).toBe(false);
  });
});
