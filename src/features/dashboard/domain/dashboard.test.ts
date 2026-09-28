import { describe, expect, it } from "vitest";
import { continueSummary, recommendLessons } from "./dashboard";

describe("recommendLessons", () => {
  const lessons = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id }));

  it("skips finished lessons and keeps the catalog order", () => {
    expect(recommendLessons(lessons, [2, 3, 9]).map((l) => l.id)).toEqual([
      1, 4, 5, 6,
    ]);
  });

  it("returns fewer when most are done, none when all are", () => {
    expect(recommendLessons(lessons, [1, 2, 3, 4, 5, 6])).toEqual([{ id: 7 }]);
    expect(recommendLessons(lessons, [1, 2, 3, 4, 5, 6, 7])).toEqual([]);
  });

  it("honours a custom count", () => {
    expect(recommendLessons(lessons, [], 2)).toHaveLength(2);
  });
});

describe("continueSummary", () => {
  const now = new Date("2026-10-01T08:00:00Z");

  it("counts answered items of every type and the time left", () => {
    expect(
      continueSummary(
        ["A", null, [true, null, null, null], [null, null], " ", "1,5"],
        new Date("2026-10-01T08:21:40.900Z"),
        now,
      ),
    ).toEqual({ answered: 3, total: 6, secondsLeft: 1300 });
  });

  it("has no time left once the deadline passed, none without a limit", () => {
    expect(
      continueSummary([], new Date("2026-10-01T07:59:00Z"), now).secondsLeft,
    ).toBe(0);
    expect(continueSummary(["B"], null, now)).toEqual({
      answered: 1,
      total: 1,
      secondsLeft: null,
    });
  });
});
