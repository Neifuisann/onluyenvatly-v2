import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEADERBOARD,
  initials,
  type LeaderboardEntry,
  leaderboardHref,
  leaderboardView,
  parseLeaderboardParams,
  publicName,
  withRanks,
} from "./leaderboard";

const entry = (
  userId: string,
  rating: number,
  weekDelta = 0,
): LeaderboardEntry => ({
  userId,
  fullName: `Học Sinh ${userId}`,
  className: null,
  rating,
  weekDelta,
});

describe("withRanks", () => {
  it("gives equal ratings the same rank and skips after a tie", () => {
    const rows = [
      entry("a", 1900),
      entry("b", 1700),
      entry("c", 1700),
      entry("d", 1650),
      entry("e", 1650),
      entry("f", 1650),
      entry("g", 1500),
    ];
    expect(withRanks(rows, "all").map((r) => r.rank)).toEqual([
      1, 2, 2, 4, 4, 4, 7,
    ]);
  });

  it("ranks the weekly board by the 7-day change, not the rating", () => {
    const rows = [
      entry("a", 1500, 80),
      entry("b", 2000, 80),
      entry("c", 1900, -5),
    ];
    expect(withRanks(rows, "week").map((r) => r.rank)).toEqual([1, 1, 3]);
    expect(withRanks(rows, "all").map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("handles an empty board", () => {
    expect(withRanks([], "all")).toEqual([]);
  });
});

describe("leaderboardView", () => {
  const ranked = withRanks(
    ["a", "b", "c", "d", "e"].map((id, i) => entry(id, 2000 - i * 10)),
    "all",
  );

  it("marks me in place when I'm among the shown rows", () => {
    const view = leaderboardView(ranked, "b", 3);
    expect(view.shown.map((r) => r.userId)).toEqual(["a", "b", "c"]);
    expect(view.me).toMatchObject({ userId: "b", rank: 2 });
    expect(view.meBelow).toBe(false);
  });

  it("keeps my row after the shown ones when I'm further down", () => {
    const view = leaderboardView(ranked, "e", 3);
    expect(view.shown).toHaveLength(3);
    expect(view.me).toMatchObject({ userId: "e", rank: 5 });
    expect(view.meBelow).toBe(true);
  });

  it("has no row for a student without a rating", () => {
    const view = leaderboardView(ranked, "zzz");
    expect(view).toMatchObject({ me: null, meBelow: false });
    expect(view.shown).toHaveLength(5);
  });
});

describe("initials", () => {
  it.each([
    ["Nguyễn Văn Huy", "NH"],
    ["  Trần   thị   ánh  ", "TÁ"],
    ["Đặng", "Đ"],
    // Decomposed input still gives one letter.
    ["Ô Uyên", "ÔU"],
    ["", "?"],
    ["   ", "?"],
  ])("%j → %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe("publicName", () => {
  it("keeps the full name unless the student chose initials", () => {
    expect(publicName("Nguyễn Văn Huy", false)).toBe("Nguyễn Văn Huy");
    expect(publicName("  Nguyễn   văn huy ", true)).toBe("N. V. H.");
    expect(publicName("Đặng", true)).toBe("Đ.");
    expect(publicName("  ", true)).toBe("?");
  });
});

describe("leaderboardHref", () => {
  it("omits defaults", () => {
    expect(leaderboardHref(DEFAULT_LEADERBOARD)).toBe("/leaderboard");
  });

  it("applies a patch over the current filters", () => {
    const f = { classId: 7, period: "week" } as const;
    expect(leaderboardHref(f)).toBe("/leaderboard?class=7&period=week");
    expect(leaderboardHref(f, { classId: null })).toBe(
      "/leaderboard?period=week",
    );
    expect(leaderboardHref(f, { period: "all" })).toBe("/leaderboard?class=7");
  });
});

describe("parseLeaderboardParams", () => {
  it("reads valid params", () => {
    expect(parseLeaderboardParams({ class: "11", period: "week" })).toEqual({
      classId: 11,
      period: "week",
    });
    expect(parseLeaderboardParams({ class: ["10", "12"] })).toEqual({
      classId: 10,
      period: "all",
    });
  });

  it.each([
    {},
    { class: "0", period: "month" },
    { class: "abc", period: "" },
    { class: "", period: ["x"] },
    { class: "12.5" },
    { class: "-3" },
  ])("falls back to defaults for %j", (params) => {
    const parsed = parseLeaderboardParams(params);
    expect(parsed.period).toBe("all");
    expect(parsed.classId).toBeNull();
  });
});
