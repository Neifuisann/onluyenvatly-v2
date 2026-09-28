import { describe, expect, it } from "vitest";
import {
  chooseOption,
  goTo,
  isAnswered,
  type RunnerState,
  restoreAnswers,
  restoreFlagged,
  setStatement,
  setText,
  summarize,
  toggleFlag,
} from "./runner-state";

const blank = (n: number): RunnerState => ({
  answers: Array(n).fill(null),
  flagged: [],
  current: 0,
});

describe("answers", () => {
  it("chooses an mcq letter and clears it on a second tap", () => {
    let s = chooseOption(blank(2), 0, "B");
    expect(s.answers).toEqual(["B", null]);
    s = chooseOption(s, 0, "C");
    expect(s.answers[0]).toBe("C");
    expect(chooseOption(s, 0, "C").answers[0]).toBeNull();
  });

  it("sets tf statements one by one, clearing back to blank", () => {
    let s = setStatement(blank(1), 0, 1, true, 4);
    expect(s.answers[0]).toEqual([null, true, null, null]);
    s = setStatement(s, 0, 3, false, 4);
    expect(s.answers[0]).toEqual([null, true, null, false]);
    s = setStatement(s, 0, 1, false, 4);
    expect(s.answers[0]).toEqual([null, false, null, false]);
    s = setStatement(setStatement(s, 0, 1, false, 4), 0, 3, false, 4);
    expect(s.answers[0]).toBeNull();
    expect(setStatement(s, 0, 4, true, 4)).toBe(s);
  });

  it("keeps short answers as typed, capped, empty → blank", () => {
    expect(setText(blank(1), 0, " 1,5").answers[0]).toBe(" 1,5");
    expect(setText(blank(1), 0, "").answers[0]).toBeNull();
    expect(setText(blank(1), 0, "9".repeat(200)).answers[0]).toHaveLength(100);
  });

  it("ignores out-of-range items", () => {
    const s = blank(1);
    expect(chooseOption(s, 3, "A")).toBe(s);
    expect(toggleFlag(s, -1)).toBe(s);
  });
});

describe("flags and navigation", () => {
  it("toggles flags and keeps them sorted", () => {
    let s = toggleFlag(blank(5), 3);
    s = toggleFlag(s, 1);
    expect(s.flagged).toEqual([1, 3]);
    expect(toggleFlag(s, 3).flagged).toEqual([1]);
  });

  it("clamps navigation to the test", () => {
    const s = blank(3);
    expect(goTo(s, 2).current).toBe(2);
    expect(goTo(s, 9).current).toBe(2);
    expect(goTo(s, -1).current).toBe(0);
    expect(goTo(s, 0)).toBe(s);
  });
});

describe("summarize", () => {
  it("counts answered items and lists unanswered and flagged ones", () => {
    const s: RunnerState = {
      answers: ["A", null, [null, null], [true, null], "  ", "2"],
      flagged: [2],
      current: 0,
    };
    expect(summarize(s)).toEqual({
      answered: 3,
      total: 6,
      unanswered: [1, 2, 4],
      flagged: [2],
    });
    expect(isAnswered(undefined)).toBe(false);
  });
});

describe("restore", () => {
  it("aligns saved answers and drops odd values", () => {
    expect(restoreAnswers(["A", [true, null], 5, { x: 1 }, ["y"]], 6)).toEqual([
      "A",
      [true, null],
      null,
      null,
      null,
      null,
    ]);
    expect(restoreAnswers("junk", 2)).toEqual([null, null]);
    expect(restoreAnswers(["A", "B", "C"], 2)).toEqual(["A", "B"]);
  });

  it("keeps valid, unique flag indexes only", () => {
    expect(restoreFlagged([3, 1, 1, -1, 9, 1.5, "2"], 5)).toEqual([1, 3]);
    expect(restoreFlagged(null, 5)).toEqual([]);
  });
});
