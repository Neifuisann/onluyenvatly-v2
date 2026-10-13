import { describe, expect, it } from "vitest";
import {
  hardestQuestions,
  playerView,
  questionStats,
  rankPlayers,
  type StandingInput,
} from "./standings.ts";

const row = (
  id: number,
  score: number,
  extra: Partial<StandingInput> = {},
): StandingInput => ({
  id,
  name: `P${id}`,
  racer: "car",
  color: 0,
  score,
  answered: 3,
  correct: 0,
  bestStreak: 0,
  finishedAt: null,
  eliminatedAt: null,
  lives: null,
  ...extra,
});

describe("rankPlayers", () => {
  it("ranks knocked-out players below everyone still in (B-12)", () => {
    const out = new Date("2026-10-11T10:00:00Z");
    const ranked = rankPlayers([
      row(1, 2000, { eliminatedAt: out }),
      row(2, 500),
      row(3, 900, { eliminatedAt: out }),
      row(4, 500),
    ]);
    expect(ranked.map((r) => [r.id, r.rank, r.eliminated])).toEqual([
      [2, 1, false],
      [4, 1, false],
      [1, 3, true],
      [3, 4, true],
    ]);
  });

  it("keeps an eliminated tie apart from a surviving one", () => {
    const out = new Date("2026-10-11T10:00:00Z");
    const ranked = rankPlayers([
      row(1, 500, { eliminatedAt: out }),
      row(2, 500),
    ]);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      [2, 1],
      [1, 2],
    ]);
  });

  it("orders by score with shared ranks for ties", () => {
    const ranked = rankPlayers([
      row(1, 500),
      row(2, 900),
      row(3, 500),
      row(4, 100),
    ]);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      [2, 1],
      [1, 2],
      [3, 2],
      [4, 4],
    ]);
  });

  it("lists more correct, then earlier finish, first inside a tie", () => {
    const ranked = rankPlayers([
      row(1, 500, { correct: 1 }),
      row(2, 500, { correct: 2, finishedAt: new Date(5000) }),
      row(3, 500, { correct: 2, finishedAt: new Date(3000) }),
      row(4, 500, { correct: 2 }),
    ]);
    expect(ranked.map((r) => r.id)).toEqual([3, 2, 4, 1]);
    expect(ranked.every((r) => r.rank === 1)).toBe(true);
    expect(ranked.map((r) => r.finished)).toEqual([true, true, false, false]);
    expect(ranked[0]).not.toHaveProperty("finishedAt");
  });
});

describe("rankPlayers with survival (zombie rooms, B-14)", () => {
  const out = new Date("2026-10-13T10:00:00Z");

  it("ranks by waves survived first, whatever the points", () => {
    const ranked = rankPlayers(
      [
        row(1, 5000, { answered: 3, eliminatedAt: out }),
        row(2, 900, { answered: 8, eliminatedAt: out }),
        row(3, 2000, { answered: 5 }),
      ],
      true,
    );
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      [2, 1],
      [3, 2],
      [1, 3],
    ]);
  });

  it("on the same wave, still standing beats knocked out, then points", () => {
    const ranked = rankPlayers(
      [
        row(1, 3000, { answered: 4, eliminatedAt: out }),
        row(2, 1000, { answered: 4 }),
        row(3, 1500, { answered: 4 }),
        row(4, 1500, { answered: 4, correct: 2 }),
      ],
      true,
    );
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      [4, 1],
      [3, 1],
      [2, 3],
      [1, 4],
    ]);
  });

  it("a race ignores waves (no survival flag)", () => {
    const ranked = rankPlayers([
      row(1, 100, { answered: 9 }),
      row(2, 200, { answered: 1 }),
    ]);
    expect(ranked.map((r) => r.id)).toEqual([2, 1]);
  });
});

describe("playerView", () => {
  const ranked = rankPlayers(
    [900, 800, 700, 600, 500, 400, 300].map((s, i) => row(i + 1, s)),
  );

  it("shows the top five, me and the gap to the player ahead", () => {
    const view = playerView(ranked, 7);
    expect(view.top.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
    expect(view.me?.rank).toBe(7);
    expect(view.ahead).toEqual({ name: "P6", gap: 100 });
    expect(view.total).toBe(7);
    expect(view.alive).toBe(7);
  });

  it("counts the players still standing", () => {
    const out = new Date("2026-10-13T10:00:00Z");
    const view = playerView(
      rankPlayers([row(1, 0), row(2, 0, { eliminatedAt: out }), row(3, 0)]),
      1,
    );
    expect(view.alive).toBe(2);
  });

  it("the leader has nobody ahead; a stranger has no row", () => {
    expect(playerView(ranked, 1).ahead).toBeNull();
    expect(playerView(ranked, 99)).toMatchObject({ me: null, ahead: null });
  });

  it("no gap when tied with the player listed ahead", () => {
    const tied = rankPlayers([row(1, 500), row(2, 500)]);
    expect(playerView(tied, 2).ahead).toBeNull();
  });
});

describe("questionStats", () => {
  const marks = [
    [{ k: "correct", s: 900 }, { k: "wrong", s: 0 }, null],
    [{ k: "correct", s: 700 }, { k: "partial", s: 300 }, null],
    [{ k: "timeout", s: 0 }, null, null],
  ] as const;

  it("counts outcomes per bank question", () => {
    const stats = questionStats(3, marks);
    expect(stats[0]).toEqual({
      index: 0,
      answered: 3,
      counts: { correct: 2, partial: 0, wrong: 0, blank: 0, timeout: 1 },
      accuracy: 2 / 3,
    });
    expect(stats[1]?.accuracy).toBe(0);
    expect(stats[2]).toMatchObject({ answered: 0, accuracy: null });
  });

  it("hardest: lowest accuracy among reached questions", () => {
    const stats = questionStats(3, marks);
    expect(hardestQuestions(stats).map((s) => s.index)).toEqual([1, 0]);
    expect(hardestQuestions(stats, 1).map((s) => s.index)).toEqual([1]);
  });

  it("breaks accuracy ties by more answers, then bank order", () => {
    const stats = questionStats(3, [
      [
        { k: "wrong", s: 0 },
        { k: "wrong", s: 0 },
        { k: "wrong", s: 0 },
      ],
      [null, { k: "wrong", s: 0 }, { k: "wrong", s: 0 }],
    ]);
    expect(hardestQuestions(stats).map((s) => s.index)).toEqual([1, 2, 0]);
  });
});
