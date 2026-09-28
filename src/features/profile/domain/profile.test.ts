import { describe, expect, it } from "vitest";
import {
  type AccuracyRow,
  accuracyBreakdown,
  activeStreak,
  MAX_HISTORY_PAGE,
  parseHistoryPage,
} from "./profile";

const row = (
  type: string | null,
  chapter: string | null,
  questions: number,
  earned: number,
  points: number,
): AccuracyRow => ({ type, chapter, questions, earned, points });

describe("accuracyBreakdown", () => {
  const rows = [
    row("short", "Sóng cơ", 2, 0.5, 1),
    row("mcq", "Dao động cơ", 10, 2, 2.5),
    row("mcq", "Sóng cơ", 4, 0.5, 1),
    row("tf", "Dao động cơ", 3, 0.25, 1),
    // Unknown type (deleted question) and no chapter are left out of their group.
    row(null, "Điện trường", 1, 1, 1),
    row("mcq", null, 2, 0.5, 0.5),
  ];

  it("sums per type in the fixed mcq, tf, short order", () => {
    expect(accuracyBreakdown(rows).byType).toEqual([
      { key: "mcq", questions: 16, accuracy: 3 / 4 },
      { key: "tf", questions: 3, accuracy: 0.25 },
      { key: "short", questions: 2, accuracy: 0.5 },
    ]);
  });

  it("lists chapters weakest first, ties in Vietnamese order", () => {
    const { byChapter } = accuracyBreakdown([
      ...rows,
      row("mcq", "Cơ học", 1, 0, 1),
      row("mcq", "Âm học", 1, 0, 1),
    ]);
    expect(byChapter.map((c) => [c.key, c.accuracy])).toEqual([
      ["Âm học", 0],
      ["Cơ học", 0],
      ["Sóng cơ", 0.5],
      ["Dao động cơ", 2.25 / 3.5],
      ["Điện trường", 1],
    ]);
  });

  it("guards zero-point groups and clamps", () => {
    const { byType } = accuracyBreakdown([
      row("mcq", null, 1, 0, 0),
      row("tf", null, 1, 3, 1),
    ]);
    expect(byType.map((t) => t.accuracy)).toEqual([0, 1]);
    expect(accuracyBreakdown([])).toEqual({ byType: [], byChapter: [] });
  });
});

describe("activeStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(
      activeStreak(
        ["2026-10-03", "2026-10-01", "2026-10-02", "2026-09-29"],
        "2026-10-03",
      ),
    ).toBe(3);
  });

  it("still counts yesterday's streak before today's first test", () => {
    expect(activeStreak(["2026-10-02", "2026-10-01"], "2026-10-03")).toBe(2);
  });

  it("is 0 after a missed day, across month ends too", () => {
    expect(activeStreak(["2026-10-01"], "2026-10-03")).toBe(0);
    expect(activeStreak(["2026-10-01", "2026-09-30"], "2026-10-01")).toBe(2);
    expect(activeStreak([], "2026-10-01")).toBe(0);
  });
});

describe("parseHistoryPage", () => {
  it.each([
    [{}, 1],
    [{ page: "3" }, 3],
    [{ page: ["2", "9"] }, 2],
    [{ page: "0" }, 1],
    [{ page: "x" }, 1],
    [{ page: "1.5" }, 1],
    [{ page: String(MAX_HISTORY_PAGE + 1) }, 1],
  ])("%j → %i", (params, page) => {
    expect(parseHistoryPage(params)).toBe(page);
  });
});
