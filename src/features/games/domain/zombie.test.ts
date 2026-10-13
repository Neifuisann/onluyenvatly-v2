import { describe, expect, it } from "vitest";
import type { ZombieState, ZombieWave } from "../../../db/schema.ts";
import type { Question } from "../../lessons/schema.ts";
import {
  BREAK_MS,
  begin,
  COUNTDOWN_MS,
  LATE_GRACE_MS,
  shoot,
  timeout,
} from "../../zombie/domain/engine.ts";
import { MAX_POINTS, STALE_AFTER_MS } from "./rules.ts";
import {
  catchUp,
  countWaves,
  questionMark,
  roomStartState,
  SHARED_LEAD_MS,
  scoreWave,
  tallyMove,
  UNTIMED_SCORE_MS,
  UNTIMED_WAVE_MS,
  wavesSurvived,
  zombieHardEnd,
} from "./zombie.ts";

const mcq: Question = {
  id: "q_m",
  type: "mcq",
  stem: "?",
  options: [{ text: "a" }, { text: "b" }, { text: "c" }, { text: "d" }],
  answer: 0,
};
const tf: Question = {
  id: "q_t",
  type: "tf",
  stem: "?",
  statements: [
    { text: "a", answer: true },
    { text: "b", answer: false },
  ],
};
const short: Question = { id: "q_s", type: "short", stem: "?", answer: "1" };

const wave = (patch: Partial<ZombieWave>): ZombieWave => ({
  i: 0,
  n: 4,
  s: [],
  ...patch,
});

describe("countWaves and roomStartState", () => {
  it("one wave per mcq, one per tf statement, none for short", () => {
    expect(countWaves([mcq, tf, short, mcq])).toBe(4);
  });

  it("builds the player's waves in their order, not started", () => {
    const s = roomStartState({ lives: 3, seconds: 20 }, [tf, mcq]);
    expect(s).toMatchObject({ lives: 3, sec: 20, at: null, wave: 0 });
    expect(s.waves.map((w) => [w.i, w.p, w.n])).toEqual([
      [0, 0, 2],
      [0, 1, 2],
      [1, undefined, 4],
    ]);
  });
});

describe("scoreWave", () => {
  it("a first-shot hit scores speed points plus the streak bonus", () => {
    const w = wave({ s: [2], e: "hit", k: 2 });
    expect(scoreWave(w, 0, 20, 0)).toEqual({ points: MAX_POINTS, streak: 1 });
    // Half the clock gone, third in a row: 750 + 40.
    expect(scoreWave(w, 10_000, 20, 2)).toEqual({ points: 790, streak: 3 });
  });

  it("untimed rooms run speed against UNTIMED_SCORE_MS", () => {
    const w = wave({ s: [0], e: "hit", k: 0 });
    expect(scoreWave(w, UNTIMED_SCORE_MS, null, 0).points).toBe(500);
  });

  it("a miss first, a timeout or an open wave score nothing", () => {
    expect(scoreWave(wave({ s: [1, 0], e: "hit", k: 0 }), 0, 20, 4)).toEqual({
      points: 0,
      streak: 0,
    });
    expect(scoreWave(wave({ e: "timeout", k: 0 }), 0, 20, 4).points).toBe(0);
    expect(scoreWave(wave({ s: [0] }), 0, 20, 4).points).toBe(0);
  });
});

describe("questionMark", () => {
  const state = (waves: ZombieWave[]) => ({ waves });

  it("correct, partial or wrong from the first shots of its waves", () => {
    const hit = (p: number) => wave({ i: 0, p, n: 2, s: [0], e: "hit", k: 0 });
    const missed = (p: number) =>
      wave({ i: 0, p, n: 2, s: [1], e: "miss", k: 0 });
    expect(questionMark(state([hit(0), hit(1)]), 0, 9).k).toBe("correct");
    expect(questionMark(state([hit(0), missed(1)]), 0, 9).k).toBe("partial");
    expect(questionMark(state([missed(0), missed(1)]), 0, 0).k).toBe("wrong");
  });

  it("timeout when the zombies reached the barricade every time", () => {
    const m = questionMark(state([wave({ e: "timeout", k: 1 })]), 0, 0);
    expect(m).toEqual({ k: "timeout", s: 0 });
  });
});

describe("tallyMove", () => {
  const T = 1_000_000;
  const started = (s: ZombieState) => begin(s, T);
  const fresh = () => ({
    score: 0,
    streak: 0,
    bestStreak: 0,
    marks: [null, null],
  });

  it("scores the wave that ended and marks its bank question", () => {
    // Position 0 is bank question 1, position 1 is bank question 0.
    const order = [1, 0];
    const s0 = started(roomStartState({ lives: 3, seconds: 20 }, [mcq, mcq]));
    const at = (s0.at as number) + 5_000;
    const r = shoot(s0, { wave: 0, lane: 0 }, 0, at);
    if (!r.ok) throw new Error(r.code);
    const t = tallyMove(s0, r.state, fresh(), order, at);
    expect(t).toMatchObject({
      score: 875,
      streak: 1,
      bestStreak: 1,
      answered: 1,
      correct: 1,
      misses: 0,
    });
    expect(t.marks).toEqual([null, { k: "correct", s: 875 }]);
  });

  it("a miss that leaves the wave open changes lives only", () => {
    const s0 = started(roomStartState({ lives: 3, seconds: 20 }, [mcq]));
    const at = s0.at as number;
    const r = shoot(s0, { wave: 0, lane: 2 }, 0, at);
    if (!r.ok) throw new Error(r.code);
    const t = tallyMove(s0, r.state, { ...fresh(), streak: 3 }, [0], at);
    expect(t).toMatchObject({ score: 0, streak: 3, answered: 0, misses: 1 });
    expect(t.marks).toEqual([null, null]);
  });

  it("the wave that takes the last life is not survived", () => {
    const s0 = started(roomStartState({ lives: 1, seconds: 20 }, [mcq, mcq]));
    const at = (s0.at as number) + 21_000;
    const r = timeout(s0, 0, 0, at);
    if (!r.ok) throw new Error(r.code);
    expect(r.state.over).toBe("lost");
    const t = tallyMove(s0, r.state, fresh(), [0, 1], at);
    expect(t).toMatchObject({ answered: 0, misses: 1, score: 0 });
    expect(t.marks).toEqual([{ k: "timeout", s: 0 }, null]);
  });
});

describe("wavesSurvived", () => {
  it("counts ended waves, less the fatal one", () => {
    const waves = [wave({ e: "hit", k: 0 }), wave({ e: "miss", k: 0 })];
    expect(wavesSurvived({ waves, over: null })).toBe(2);
    expect(wavesSurvived({ waves, over: "lost" })).toBe(1);
    expect(wavesSurvived({ waves: [], over: "lost" })).toBe(0);
  });
});

describe("zombieHardEnd", () => {
  const start = new Date("2026-10-13T02:00:00Z");
  const base = start.getTime() + COUNTDOWN_MS + STALE_AFTER_MS;

  it("every wave at full time plus its break, then the stale margin", () => {
    const end = zombieHardEnd(start, 10, 20).getTime();
    expect(end - base).toBeGreaterThanOrEqual(10 * (20_000 + BREAK_MS));
    expect(end - base).toBeLessThan(10 * (20_000 + BREAK_MS) + 5_000);
  });

  it("untimed waves count UNTIMED_WAVE_MS each", () => {
    const end = zombieHardEnd(start, 3, null).getTime();
    expect(end - base).toBeGreaterThanOrEqual(3 * UNTIMED_WAVE_MS);
  });
});

describe("same-question rooms (B-15)", () => {
  const startedAt = new Date(1_000_000);
  const clock = startedAt.getTime() + SHARED_LEAD_MS;
  const STEP = 20_000 + BREAK_MS;
  const shared = (lives: 1 | 3 = 3) =>
    roomStartState({ lives, seconds: 20, shared: { startedAt } }, [
      mcq,
      mcq,
      mcq,
    ]);
  /** Every key is lane 0. */
  const key = () => 0;

  it("puts everyone on the class's clock, only with a clock per wave", () => {
    expect(shared().clock).toBe(clock);
    expect(begin(shared(), startedAt.getTime() + 1).at).toBe(clock);
    expect(
      roomStartState({ lives: 3, seconds: null, shared: { startedAt } }, [mcq])
        .clock,
    ).toBeUndefined();
  });

  it("an early hit waits for the next wave's start", () => {
    const s = begin(shared(), startedAt.getTime());
    const r = shoot(s, { wave: 0, lane: 0 }, 0, clock + 3000);
    expect(r.ok && r.state.at).toBe(clock + STEP);
  });

  it("waves let pass are timeouts; those closed before joining are skipped", () => {
    const s = begin(shared(), clock);
    const closes = (w: number) => clock + w * STEP + 20_000 + LATE_GRACE_MS;
    // Still open: nothing changes.
    expect(catchUp(s, closes(0), 0, key)).toBe(s);
    const missed = catchUp(s, closes(1) + 1, 0, key);
    expect(missed).toMatchObject({ wave: 2, misses: 2, at: clock + 2 * STEP });
    expect(missed.waves.map((w) => w.e)).toEqual([
      "timeout",
      "timeout",
      undefined,
    ]);
    // Joined after wave 0 closed: only wave 1 counts.
    const late = catchUp(s, closes(1) + 1, closes(0) + 1, key);
    expect(late).toMatchObject({ wave: 2, misses: 1 });
    expect(late.waves[0]?.e).toBeUndefined();
  });

  it("the last life lost to the clock ends the game", () => {
    const s = begin(shared(1), clock);
    expect(catchUp(s, clock + 3 * STEP, 0, key)).toMatchObject({
      over: "lost",
      misses: 1,
    });
  });

  it("not before 'Bắt đầu', nor on a player's own clock", () => {
    expect(catchUp(shared(), clock + 9 * STEP, 0, key).wave).toBe(0);
    const own = begin(
      roomStartState({ lives: 3, seconds: 20 }, [mcq, mcq]),
      clock,
    );
    expect(catchUp(own, clock + 9 * STEP, 0, key)).toBe(own);
  });

  it("the hard end leaves room for the lead", () => {
    expect(
      zombieHardEnd(startedAt, 3, 20, true).getTime() -
        zombieHardEnd(startedAt, 3, 20).getTime(),
    ).toBe(SHARED_LEAD_MS - COUNTDOWN_MS);
  });
});
