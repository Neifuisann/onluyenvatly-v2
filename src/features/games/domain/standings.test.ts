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
  ...extra,
});

describe("rankPlayers", () => {
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
