import { describe, expect, it } from "vitest";
import {
  effectiveStatus,
  limitMs,
  questionShownAt,
  raceHardEnd,
  scoreAnswer,
  speedPoints,
  streakBonus,
  trackProgress,
} from "./scoring.ts";

const at = (s: number) => new Date(Date.UTC(2026, 9, 6, 8, 0, s));

describe("limitMs", () => {
  it("depends on pace and type", () => {
    expect(limitMs("mcq", "normal")).toBe(20_000);
    expect(limitMs("tf", "fast")).toBe(30_000);
    expect(limitMs("short", "relaxed")).toBe(75_000);
  });
});

describe("questionShownAt", () => {
  it("first question: race start + countdown", () => {
    expect(
      questionShownAt({
        raceStartedAt: at(10),
        joinedAt: at(0),
        lastAnsweredAt: null,
      }),
    ).toEqual(at(14));
  });

  it("a late joiner gets their own countdown", () => {
    expect(
      questionShownAt({
        raceStartedAt: at(10),
        joinedAt: at(40),
        lastAnsweredAt: null,
      }),
    ).toEqual(at(44));
  });

  it("next questions: previous answer + feedback card", () => {
    expect(
      questionShownAt({
        raceStartedAt: at(10),
        joinedAt: at(0),
        lastAnsweredAt: at(30),
      }),
    ).toEqual(at(33));
  });
});

describe("speedPoints", () => {
  it("runs from 1000 to 500 and clamps", () => {
    expect(speedPoints(0, 20_000)).toBe(1000);
    expect(speedPoints(10_000, 20_000)).toBe(750);
    expect(speedPoints(20_000, 20_000)).toBe(500);
    expect(speedPoints(25_000, 20_000)).toBe(500);
    expect(speedPoints(-500, 20_000)).toBe(1000);
  });
});

describe("streakBonus", () => {
  it("starts at the second in a row and caps at 100", () => {
    expect([0, 1, 2, 3, 6, 7, 20].map(streakBonus)).toEqual([
      0, 0, 20, 40, 100, 100, 100,
    ]);
  });
});

describe("scoreAnswer", () => {
  const base = {
    share: 1,
    blank: false,
    elapsedMs: 0,
    limitMs: 20_000,
    streakBefore: 0,
  };

  it("correct: speed points plus streak bonus", () => {
    expect(scoreAnswer(base)).toEqual({ k: "correct", s: 1000, streak: 1 });
    expect(
      scoreAnswer({ ...base, elapsedMs: 10_000, streakBefore: 2 }),
    ).toEqual({ k: "correct", s: 790, streak: 3 });
  });

  it("partial tf: share of the speed points, streak broken", () => {
    expect(
      scoreAnswer({ ...base, share: 0.5, elapsedMs: 10_000, streakBefore: 4 }),
    ).toEqual({ k: "partial", s: 375, streak: 0 });
  });

  it("wrong and blank: nothing, streak broken", () => {
    expect(scoreAnswer({ ...base, share: 0, streakBefore: 3 })).toEqual({
      k: "wrong",
      s: 0,
      streak: 0,
    });
    expect(scoreAnswer({ ...base, share: 0, blank: true })).toEqual({
      k: "blank",
      s: 0,
      streak: 0,
    });
  });

  it("allows the network grace, then times out even a right answer", () => {
    expect(scoreAnswer({ ...base, elapsedMs: 21_900 }).k).toBe("correct");
    expect(
      scoreAnswer({ ...base, elapsedMs: 22_001, streakBefore: 5 }),
    ).toEqual({ k: "timeout", s: 0, streak: 0 });
  });
});

describe("raceHardEnd and effectiveStatus", () => {
  it("adds every question's time and feedback, then the stale margin", () => {
    // countdown 4 s + (20+3) + (40+3) + grace 2 s + 300 s.
    expect(raceHardEnd(at(0), ["mcq", "tf"], "normal")).toEqual(
      new Date(at(0).getTime() + 372_000),
    );
  });

  it("a running room past its hard end reads as finished", () => {
    const room = { status: "running" as const, hardEndAt: at(30) };
    expect(effectiveStatus(room, at(29))).toBe("running");
    expect(effectiveStatus(room, at(30))).toBe("finished");
    expect(effectiveStatus({ status: "lobby", hardEndAt: null }, at(99))).toBe(
      "lobby",
    );
    expect(
      effectiveStatus({ status: "running", hardEndAt: null }, at(99)),
    ).toBe("running");
  });
});

describe("trackProgress", () => {
  it("is points over a perfect instant race, clamped", () => {
    expect(trackProgress(5000, 10)).toBe(0.5);
    expect(trackProgress(12_000, 10)).toBe(1);
    expect(trackProgress(-1, 10)).toBe(0);
    expect(trackProgress(100, 0)).toBe(0);
  });
});
