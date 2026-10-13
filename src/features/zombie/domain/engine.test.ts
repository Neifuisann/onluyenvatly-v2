import { describe, expect, it } from "vitest";
import type { ZombieState } from "../../../db/schema.ts";
import type { Question } from "../../lessons/schema.ts";
import {
  applyAnswer,
  BREAK_MS,
  begin,
  buildWaves,
  COUNTDOWN_MS,
  EARLY_TIMEOUT_MS,
  initialState,
  isPlayable,
  LATE_GRACE_MS,
  livesLeft,
  shapeOf,
  sharedWaveAt,
  shoot,
  summary,
  timeLeftMs,
  timeout,
  waveKey,
} from "./engine.ts";

const mcq: Question = {
  id: "m",
  type: "mcq",
  stem: "?",
  options: [{ text: "a" }, { text: "b" }, { text: "c" }, { text: "d" }],
  answer: 2,
};
const tf: Question = {
  id: "t",
  type: "tf",
  stem: "?",
  statements: [
    { text: "a", answer: true },
    { text: "b", answer: false },
  ],
};
const short: Question = { id: "s", type: "short", stem: "?", answer: "1" };

/** mcq (4 lanes, key 2) then a tf of two statements (keys 0, 1). */
const KEYS = [2, 0, 1];
const T0 = 1_000_000;

function started(lives: 1 | 3 = 3, sec: number | null = 20): ZombieState {
  const s = initialState({ lives, secondsPerQuestion: sec }, [
    { type: "mcq", options: 4 },
    { type: "tf", statements: 2 },
  ]);
  return begin(s, T0);
}
const AT = T0 + COUNTDOWN_MS;

function step(s: ZombieState, wave: number, lane: number, now = AT + 1000) {
  const r = shoot(s, { wave, lane }, KEYS[wave] as number, now);
  if (!r.ok) throw new Error(r.code);
  return r;
}

describe("shapes and waves", () => {
  it("plays mcq and tf, not short", () => {
    expect(shapeOf(mcq)).toEqual({ type: "mcq", options: 4 });
    expect(shapeOf(tf)).toEqual({ type: "tf", statements: 2 });
    expect(shapeOf(short)).toBeNull();
    expect([mcq, tf, short].map(isPlayable)).toEqual([true, true, false]);
  });

  it("makes one wave per mcq and one per tf statement", () => {
    expect(
      buildWaves([
        { type: "tf", statements: 2 },
        { type: "mcq", options: 3 },
      ]),
    ).toEqual([
      { i: 0, p: 0, n: 2, s: [] },
      { i: 0, p: 1, n: 2, s: [] },
      { i: 1, n: 3, s: [] },
    ]);
  });

  it("finds each wave's key in display terms", () => {
    expect(waveKey(mcq, { q: "m", p: 1 }, {})).toBe(2);
    // Shuffled: original option 2 is shown first.
    expect(waveKey(mcq, { q: "m", o: [2, 0, 1, 3], p: 1 }, {})).toBe(0);
    expect(waveKey(tf, { q: "t", p: 1 }, { p: 0 })).toBe(0);
    expect(waveKey(tf, { q: "t", p: 1 }, { p: 1 })).toBe(1);
  });
});

describe("begin and the clock", () => {
  it("starts the clock once, after the countdown", () => {
    const s = started();
    expect(s.at).toBe(AT);
    expect(begin(s, T0 + 50_000)).toBe(s);
    expect(timeLeftMs(s, AT + 5000)).toBe(15_000);
  });

  it("has no clock when untimed or not started", () => {
    expect(timeLeftMs(started(3, null), AT)).toBeNull();
    const fresh = initialState({ lives: 3, secondsPerQuestion: 20 }, [
      { type: "mcq", options: 4 },
    ]);
    expect(timeLeftMs(fresh, AT)).toBeNull();
    expect(shoot(fresh, { wave: 0, lane: 0 }, 0, AT)).toEqual({
      ok: false,
      code: "NOT_STARTED",
    });
  });
});

describe("shoot", () => {
  it("a right first shot clears the wave, records the answer, costs nothing", () => {
    const r = step(started(), 0, 2);
    expect(r.event).toEqual({ kind: "hit", key: 2 });
    expect(r.answer).toEqual({ item: 0, lane: 2 });
    expect(r.state.wave).toBe(1);
    expect(r.state.misses).toBe(0);
    expect(r.state.at).toBe(AT + 1000 + BREAK_MS);
    expect(r.state.waves[0]).toMatchObject({ s: [2], e: "hit", k: 2 });
  });

  it("a wrong shot costs a life, hides the key, keeps the wave", () => {
    const r = step(started(), 0, 0);
    expect(r.event).toEqual({ kind: "miss", lane: 0, ended: false });
    expect(r.answer).toEqual({ item: 0, lane: 0 });
    expect(r.state.wave).toBe(0);
    expect(livesLeft(r.state)).toBe(2);
    expect(r.state.waves[0]?.k).toBeUndefined();
    // Only the first shot is the answer.
    const again = step(r.state, 0, 2);
    expect(again.answer).toBeUndefined();
    expect(again.event).toEqual({ kind: "hit", key: 2 });
    expect(again.state.misses).toBe(1);
  });

  it("ends the wave when one lane is left", () => {
    let s = started();
    s = step(s, 0, 0).state;
    s = step(s, 0, 1).state;
    const r = step(s, 0, 3);
    expect(r.event).toEqual({ kind: "miss", lane: 3, ended: true, key: 2 });
    expect(r.state.over).toBe("lost");
  });

  it("a tf miss ends the wave and shows the other lane", () => {
    const s = step(started(), 0, 2).state;
    const r = step(s, 1, 1, s.at as number);
    expect(r.event).toEqual({ kind: "miss", lane: 1, ended: true, key: 0 });
    expect(r.answer).toEqual({ item: 1, part: 0, lane: 1 });
    expect(r.state.wave).toBe(2);
  });

  it("one life: the first miss loses and shows the key", () => {
    const r = step(started(1), 0, 1);
    expect(r.event).toEqual({ kind: "miss", lane: 1, ended: true, key: 2 });
    expect(r.state.over).toBe("lost");
    expect(r.state.wave).toBe(0);
  });

  it("clearing the last wave wins", () => {
    let s = started();
    s = step(s, 0, 2).state;
    s = step(s, 1, 0, s.at as number).state;
    const r = step(s, 2, 1, s.at as number);
    expect(r.state.over).toBe("won");
    expect(summary(r.state)).toEqual({
      waves: 3,
      cleared: 3,
      firstShot: 3,
      livesLeft: 3,
    });
  });

  it("treats repeats and old waves as stale", () => {
    const s = step(started(), 0, 0).state;
    expect(shoot(s, { wave: 0, lane: 0 }, 2, AT + 2000)).toMatchObject({
      ok: true,
      event: { kind: "stale" },
      state: s,
    });
    const next = step(s, 0, 2).state;
    expect(shoot(next, { wave: 0, lane: 1 }, 2, AT)).toMatchObject({
      event: { kind: "stale" },
    });
  });

  it("refuses bad lanes, future waves, early shots and finished games", () => {
    const s = started();
    for (const input of [
      { wave: 0, lane: 4 },
      { wave: 0, lane: -1 },
      { wave: 1, lane: 0 },
      { wave: 9, lane: 0 },
      { wave: 0.5, lane: 0 },
    ])
      expect(shoot(s, input, 2, AT)).toEqual({ ok: false, code: "INVALID" });
    expect(
      shoot(s, { wave: 0, lane: 2 }, 2, AT - EARLY_TIMEOUT_MS - 1),
    ).toEqual({ ok: false, code: "INVALID" });
    const lost = step(started(1), 0, 0).state;
    expect(shoot(lost, { wave: 0, lane: 2 }, 2, AT)).toEqual({
      ok: false,
      code: "OVER",
    });
  });

  it("a shot past the clock and its grace is a timeout", () => {
    const r = step(started(), 0, 2, AT + 20_000 + LATE_GRACE_MS + 1);
    expect(r.event).toEqual({ kind: "timeout", key: 2 });
    expect(r.answer).toBeUndefined();
    expect(r.state.misses).toBe(1);
  });

  it("a shot inside the grace still counts", () => {
    const r = step(started(), 0, 2, AT + 20_000 + LATE_GRACE_MS);
    expect(r.event.kind).toBe("hit");
  });
});

describe("timeout", () => {
  it("costs a life, ends the wave, shows the key", () => {
    const r = timeout(started(), 0, 2, AT + 20_000);
    expect(r).toMatchObject({
      ok: true,
      event: { kind: "timeout", key: 2 },
      state: { wave: 1, misses: 1 },
    });
  });

  it("refuses an early timeout or one without a clock", () => {
    expect(timeout(started(), 0, 2, AT + 18_000)).toEqual({
      ok: false,
      code: "INVALID",
    });
    expect(timeout(started(3, null), 0, 2, AT + 99_000)).toEqual({
      ok: false,
      code: "INVALID",
    });
  });

  it("accepts a slightly early timeout and is stale once repeated", () => {
    const s = started();
    const r = timeout(s, 0, 2, AT + 20_000 - EARLY_TIMEOUT_MS);
    if (!r.ok) throw new Error(r.code);
    expect(timeout(r.state, 0, 2, AT + 30_000)).toMatchObject({
      event: { kind: "stale" },
    });
  });
});

describe("applyAnswer", () => {
  it("writes an mcq letter", () => {
    expect(applyAnswer([null, null], { item: 1, lane: 3 }, 0)).toEqual([
      null,
      "D",
    ]);
  });

  it("writes one tf statement and keeps the others", () => {
    const first = applyAnswer([null], { item: 0, part: 1, lane: 0 }, 3);
    expect(first).toEqual([[null, true, null]]);
    expect(applyAnswer(first, { item: 0, part: 2, lane: 1 }, 3)).toEqual([
      [null, true, false],
    ]);
  });

  it("writes null for a lane that has no letter", () => {
    expect(applyAnswer([null], { item: 0, lane: 9 }, 0)).toEqual([null]);
  });
});

describe("the class's clock (B-15)", () => {
  const shared: ZombieState = {
    ...initialState({ lives: 3, secondsPerQuestion: 20 }, [
      { type: "mcq", options: 4 },
    ]),
    clock: 50_000,
  };

  it("wave j starts j full waves and breaks after wave 0", () => {
    expect(sharedWaveAt(shared, 0)).toBe(50_000);
    expect(sharedWaveAt(shared, 2)).toBe(50_000 + 2 * (20_000 + BREAK_MS));
    expect(sharedWaveAt({ sec: 20 }, 1)).toBeNull();
    expect(sharedWaveAt({ clock: 1, sec: null }, 1)).toBeNull();
  });

  it("'Bắt đầu' joins the class's clock", () => {
    expect(begin(shared, 1).at).toBe(50_000);
  });
});
