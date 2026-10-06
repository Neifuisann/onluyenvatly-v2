import { describe, expect, it } from "vitest";
import { createRng } from "../../attempts/domain/random.ts";
import type { Question } from "../../lessons/schema.ts";
import {
  type BankCandidate,
  countTypes,
  drawBank,
  gradingItem,
  lessonAllowsGame,
  optionCounts,
  playerPlan,
} from "./bank.ts";

const mcq = (id: string, n = 4): Question => ({
  id,
  type: "mcq",
  stem: id,
  options: Array.from({ length: n }, (_, i) => ({ text: `o${i}` })),
  answer: 0,
});
const tf = (id: string): Question => ({
  id,
  type: "tf",
  stem: id,
  statements: [
    { text: "a", answer: true },
    { text: "b", answer: false },
  ],
});
const short = (id: string): Question => ({
  id,
  type: "short",
  stem: id,
  answer: "1.5",
});

const candidates: BankCandidate[] = [
  ...["q_1", "q_2", "q_3"].map((id) => ({
    lessonId: 1,
    versionId: 10,
    question: mcq(id),
  })),
  { lessonId: 1, versionId: 10, question: tf("q_4") },
  { lessonId: 2, versionId: 20, question: short("q_1") },
  { lessonId: 2, versionId: 20, question: mcq("q_9") },
];

describe("drawBank", () => {
  it("samples the allowed types only, across lessons", () => {
    const bank = drawBank(candidates, ["mcq"], 10, createRng(1));
    expect(bank).toHaveLength(4);
    expect(new Set(bank.map((b) => `${b.l}:${b.q}`))).toEqual(
      new Set(["1:q_1", "1:q_2", "1:q_3", "2:q_9"]),
    );
  });

  it("keeps a question id shared by two lessons apart", () => {
    const bank = drawBank(candidates, ["mcq", "short"], 10, createRng(2));
    expect(bank.filter((b) => b.q === "q_1")).toHaveLength(2);
  });

  it("takes exactly count, and is reproducible from the seed", () => {
    const a = drawBank(candidates, ["mcq", "tf", "short"], 3, createRng(7));
    const b = drawBank(candidates, ["mcq", "tf", "short"], 3, createRng(7));
    expect(a).toHaveLength(3);
    expect(a).toEqual(b);
    expect(a[0]).toEqual({
      l: expect.any(Number),
      v: expect.any(Number),
      q: expect.any(String),
    });
  });

  it("returns nothing for a negative count or no matching type", () => {
    expect(drawBank(candidates, ["mcq"], -1, createRng(1))).toEqual([]);
    expect(drawBank(candidates.slice(0, 3), ["tf"], 5, createRng(1))).toEqual(
      [],
    );
  });
});

describe("countTypes", () => {
  it("counts each type", () => {
    expect(countTypes(candidates.map((c) => c.question))).toEqual({
      mcq: 4,
      tf: 1,
      short: 1,
    });
  });
});

describe("playerPlan", () => {
  const counts = optionCounts([
    mcq("q_1"),
    tf("q_2"),
    short("q_3"),
    mcq("q_4", 2),
  ]);

  it("counts options for mcq only", () => {
    expect(counts).toEqual([4, 0, 0, 2]);
  });

  it("is a permutation of the bank with mcq option shuffles", () => {
    const plan = playerPlan(counts, createRng(3));
    expect([...plan.order].sort()).toEqual([0, 1, 2, 3]);
    expect([...(plan.options[0] ?? [])].sort()).toEqual([0, 1, 2, 3]);
    expect(plan.options[1]).toBeUndefined();
    expect(plan.options[2]).toBeUndefined();
    expect([...(plan.options[3] ?? [])].sort()).toEqual([0, 1]);
  });

  it("is the same plan for the same seed, and differs between seeds", () => {
    expect(playerPlan(counts, createRng(5))).toEqual(
      playerPlan(counts, createRng(5)),
    );
    const orders = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((s) =>
        playerPlan(counts, createRng(s)).order.join(),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe("gradingItem", () => {
  it("carries the option order for mcq and none otherwise", () => {
    expect(gradingItem({ l: 1, v: 2, q: "q_1" }, [2, 0, 1])).toEqual({
      q: "q_1",
      o: [2, 0, 1],
      p: 1,
    });
    expect(gradingItem({ l: 1, v: 2, q: "q_1" }, undefined)).toEqual({
      q: "q_1",
      p: 1,
    });
  });
});

describe("lessonAllowsGame", () => {
  const now = new Date("2026-10-06T08:00:00Z");
  const base = {
    startsAt: null,
    timeLimitSec: null,
    revealAnswers: "after_submit" as const,
  };

  it("allows lessons whose answers show after submit", () => {
    expect(lessonAllowsGame(base, now)).toBe(true);
  });

  it("refuses lessons that never reveal answers", () => {
    expect(lessonAllowsGame({ ...base, revealAnswers: "never" }, now)).toBe(
      false,
    );
  });

  it("refuses a scheduled test before it starts, even after submit", () => {
    expect(
      lessonAllowsGame({ ...base, startsAt: "2026-10-06T09:00:00Z" }, now),
    ).toBe(false);
    expect(
      lessonAllowsGame({ ...base, startsAt: "2026-10-06T07:00:00Z" }, now),
    ).toBe(true);
  });

  it("allows an exam window only once its answers are out", () => {
    const exam = {
      startsAt: "2026-10-06T07:30:00Z",
      timeLimitSec: 3600,
      revealAnswers: "after_deadline" as const,
    };
    expect(lessonAllowsGame(exam, now)).toBe(false);
    expect(lessonAllowsGame(exam, new Date("2026-10-06T08:31:00Z"))).toBe(true);
  });
});
