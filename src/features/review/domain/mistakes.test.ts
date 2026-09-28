import { describe, expect, it } from "vitest";
import type { Outcome } from "../../grading/domain/grade.ts";
import {
  isMistake,
  type MistakeState,
  mistakeChanges,
  nextMistake,
} from "./mistakes.ts";

describe("isMistake", () => {
  it.each([
    ["correct", false],
    ["partial", true],
    ["wrong", true],
    ["blank", true],
  ] as const)("%s → %s", (outcome, expected) => {
    expect(isMistake(outcome)).toBe(expected);
  });
});

describe("mistakeChanges", () => {
  it("splits items by outcome", () => {
    expect(
      mistakeChanges(
        [{ q: "a" }, { q: "b" }, { q: "c" }, { q: "d" }],
        ["correct", "wrong", "partial", "blank"],
      ),
    ).toEqual({ wrong: ["b", "c", "d"], correct: ["a"] });
  });

  it("treats a missing outcome as blank and keeps the worse of duplicates", () => {
    expect(
      mistakeChanges(
        [{ q: "a" }, { q: "a" }, { q: "b" }],
        ["correct", "wrong"],
      ),
    ).toEqual({ wrong: ["a", "b"], correct: [] });
  });

  it("returns nothing for an empty attempt", () => {
    expect(mistakeChanges([], [])).toEqual({ wrong: [], correct: [] });
  });
});

describe("nextMistake", () => {
  const run = (outcomes: Outcome[]) =>
    outcomes.reduce<MistakeState | null>(nextMistake, null);

  it("ignores correct answers with no mistake yet", () => {
    expect(run(["correct", "correct"])).toBeNull();
  });

  it("opens on a wrong answer and resolves after two correct in a row", () => {
    expect(run(["wrong"])).toEqual({
      wrongCount: 1,
      correctStreak: 0,
      status: "open",
    });
    expect(run(["wrong", "correct"])).toMatchObject({
      correctStreak: 1,
      status: "open",
    });
    expect(run(["wrong", "correct", "correct"])).toEqual({
      wrongCount: 1,
      correctStreak: 2,
      status: "resolved",
    });
  });

  it("resets the streak on a wrong answer and reopens resolved mistakes", () => {
    expect(run(["wrong", "correct", "partial", "correct"])).toEqual({
      wrongCount: 2,
      correctStreak: 1,
      status: "open",
    });
    expect(run(["wrong", "correct", "correct", "blank"])).toEqual({
      wrongCount: 2,
      correctStreak: 0,
      status: "open",
    });
  });

  it("leaves resolved mistakes alone on further correct answers", () => {
    const resolved = run(["wrong", "correct", "correct"]);
    expect(nextMistake(resolved, "correct")).toBe(resolved);
  });
});
