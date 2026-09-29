import { describe, expect, it } from "vitest";
import { barLayout } from "./chart";
import {
  fillDays,
  formatDayMonth,
  type HardQuestionRow,
  rankHardest,
  sumLastDays,
  vnDayKey,
  vnWindow,
} from "./overview";

describe("Vietnam days", () => {
  it("keys an instant by its Vietnam date", () => {
    expect(vnDayKey(new Date("2026-09-28T16:59:59Z"))).toBe("2026-09-28");
    expect(vnDayKey(new Date("2026-09-28T17:00:00Z"))).toBe("2026-09-29");
  });

  it("windows end today and start at Vietnam midnight", () => {
    // 01:30 on 29/09 in Vietnam.
    const w = vnWindow(new Date("2026-09-28T18:30:00Z"), 3);
    expect(w.keys).toEqual(["2026-09-27", "2026-09-28", "2026-09-29"]);
    expect(w.since.toISOString()).toBe("2026-09-26T17:00:00.000Z");
    // 23:30 on 30/09 in Vietnam: still that day.
    const m = vnWindow(new Date("2026-09-30T16:30:00Z"), 2);
    expect(m.keys).toEqual(["2026-09-29", "2026-09-30"]);
    expect(vnWindow(new Date("2026-10-01T00:00:00Z"), 30).keys).toHaveLength(
      30,
    );
  });

  it("zero-fills and sums days", () => {
    const days = fillDays(["2026-09-27", "2026-09-28", "2026-09-29"], {
      "2026-09-27": 4,
      "2026-09-29": 2,
      "2026-09-01": 99,
    });
    expect(days).toEqual([
      { day: "2026-09-27", count: 4 },
      { day: "2026-09-28", count: 0 },
      { day: "2026-09-29", count: 2 },
    ]);
    expect(sumLastDays(days, 2)).toBe(2);
    expect(sumLastDays(days, 7)).toBe(6);
    expect(formatDayMonth("2026-09-05")).toBe("05/09");
  });
});

describe("rankHardest", () => {
  const row = (
    lessonId: number,
    questionId: string,
    answers: number,
    fullMarks: number,
  ): HardQuestionRow => ({
    lessonId,
    lessonTitle: `L${lessonId}`,
    questionId,
    versionId: lessonId * 10,
    position: 1,
    answers,
    fullMarks,
  });

  it("puts the lowest full-marks rate first, top 5, enough answers only", () => {
    const ranked = rankHardest([
      row(1, "q_a", 10, 5), // 0.5
      row(1, "q_b", 4, 0), // too few answers
      row(2, "q_a", 5, 1), // 0.2
      row(2, "q_c", 10, 2), // 0.2, more answers first
      row(3, "q_b", 6, 0), // 0
      row(3, "q_a", 6, 0), // 0, same answers: lesson then id
      row(4, "q_z", 8, 8), // 1
      row(5, "q_y", 9, 9), // 1, out of the top 5
    ]);
    expect(ranked.map((r) => `${r.lessonId}:${r.questionId}`)).toEqual([
      "3:q_a",
      "3:q_b",
      "2:q_c",
      "2:q_a",
      "1:q_a",
    ]);
    expect(ranked[2]?.fullMarksRate).toBe(0.2);
    expect(rankHardest([row(9, "q", 5, 5), row(9, "q", 5, 5)])).toHaveLength(2);
  });
});

describe("barLayout", () => {
  it("scales bars to the tallest, keeps small ones visible and zero flat", () => {
    expect(barLayout([0, 1, 4], 100, 40, 5)).toEqual([
      { x: 0, y: 40, width: 30, height: 0 },
      { x: 35, y: 30, width: 30, height: 10 },
      { x: 70, y: 0, width: 30, height: 40 },
    ]);
    expect(barLayout([1, 1000], 10, 100, 0, 2)[0]?.height).toBe(2);
    expect(barLayout([0, 0], 10, 10)).toEqual([
      { x: 0, y: 10, width: 4, height: 0 },
      { x: 6, y: 10, width: 4, height: 0 },
    ]);
    expect(barLayout([], 10, 10)).toEqual([]);
  });
});
