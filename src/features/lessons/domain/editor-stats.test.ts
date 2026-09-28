import { describe, expect, it } from "vitest";
import type { Question } from "../schema";
import { editorStats } from "./editor-stats";

const mcq = (id: string, points?: number): Question => ({
  id,
  type: "mcq",
  stem: "?",
  options: [{ text: "a" }, { text: "b" }],
  answer: 0,
  ...(points !== undefined && { points }),
});
const tf = (id: string): Question => ({
  id,
  type: "tf",
  stem: "?",
  statements: [
    { text: "a", answer: true },
    { text: "b", answer: false },
  ],
});
const short = (id: string, points?: number): Question => ({
  id,
  type: "short",
  stem: "?",
  answer: "1",
  ...(points !== undefined && { points }),
});

const qs = [
  mcq("q_1", 0.25),
  mcq("q_2", 0.25),
  mcq("q_3", 0.25),
  tf("q_4"),
  short("q_5", 0.5),
];

describe("editorStats", () => {
  it("counts types and sums per-question points without float noise", () => {
    expect(
      editorStats(qs, {
        pool: { enabled: false },
        points: { mode: "per-question" },
      }),
    ).toEqual({
      counts: { mcq: 3, tf: 1, short: 1 },
      total: 5,
      points: 2.25,
      perAttempt: null,
    });
  });

  it("uses per-type totals, falling back to own points", () => {
    const s = editorStats(qs, {
      pool: { enabled: false },
      points: { mode: "per-type-total", mcq: 1, tf: 4 },
    });
    expect(s.points).toBe(5.5);
  });

  it("reports what one attempt gets from the pool", () => {
    expect(
      editorStats(qs, {
        pool: { enabled: true, byType: { mcq: 2, short: 1 } },
        points: { mode: "per-question" },
      }).perAttempt,
    ).toEqual({ counts: { mcq: 2, tf: 0, short: 1 }, total: 3, points: 1 });
    expect(
      editorStats(qs, {
        pool: { enabled: true, byType: { mcq: 1 } },
        points: { mode: "per-type-total", mcq: 3 },
      }).perAttempt?.points,
    ).toBe(3);
  });

  it("leaves the attempt's points open when they depend on the draw", () => {
    const mixed = [mcq("q_1", 1), mcq("q_2", 2), tf("q_3")];
    expect(
      editorStats(mixed, {
        pool: { enabled: true, size: 2 },
        points: { mode: "per-question" },
      }).perAttempt,
    ).toMatchObject({ total: 2, points: null });
  });

  it("handles an empty lesson", () => {
    expect(
      editorStats([], {
        pool: { enabled: true, size: 5 },
        points: { mode: "per-question" },
      }),
    ).toEqual({
      counts: { mcq: 0, tf: 0, short: 0 },
      total: 0,
      points: 0,
      perAttempt: { counts: { mcq: 0, tf: 0, short: 0 }, total: 0, points: 0 },
    });
  });
});
