import { describe, expect, it } from "vitest";
import type { VideoState } from "../../../db/schema";
import {
  answerCue,
  buildCues,
  CLOCK_SLACK_SEC,
  canFinish,
  checkPlayback,
  cueItems,
  cueOfItem,
  initialVideoState,
  isComplete,
  nextCue,
  progressTo,
  SKIP_TOLERANCE_SEC,
  seekTarget,
} from "./engine";

const cues = buildCues([30, 90, 90, null, null]);
const state = (patch: Partial<VideoState> = {}): VideoState => ({
  ...initialVideoState(cues, false),
  ...patch,
});

describe("cues", () => {
  it("groups consecutive items asked at the same time", () => {
    expect(cues).toEqual([
      { at: 30, n: 1 },
      { at: 90, n: 2 },
      { at: null, n: 2 },
    ]);
    expect(buildCues([])).toEqual([]);
  });

  it("maps cues to items and back", () => {
    expect(cues.map((_, k) => cueItems(cues, k))).toEqual([
      { from: 0, to: 1 },
      { from: 1, to: 3 },
      { from: 3, to: 5 },
    ]);
    expect(cueItems(cues, 9)).toEqual({ from: 5, to: 5 });
    expect([0, 1, 2, 3, 4, 5].map((i) => cueOfItem(cues, i))).toEqual([
      0, 1, 1, 2, 2, -1,
    ]);
  });

  it("starts at the beginning with nothing answered", () => {
    expect(initialVideoState(cues, true)).toEqual({
      cues,
      done: 0,
      seek: true,
      pos: 0,
      max: 0,
    });
    expect(nextCue(state())).toEqual({ at: 30, n: 1 });
    expect(nextCue(state({ done: 3 }))).toBeNull();
  });
});

describe("answerCue", () => {
  it("takes the next cue once the clock has reached it", () => {
    expect(answerCue(state(), 0, 30, null)).toEqual({
      ok: true,
      state: state({ done: 1, pos: 30, max: 30 }),
    });
    // A few seconds early is within the slack.
    expect(answerCue(state(), 0, 30 - CLOCK_SLACK_SEC, null).ok).toBe(true);
  });

  it("refuses a cue the video can't have reached yet", () => {
    expect(answerCue(state(), 0, 20, null)).toEqual({
      ok: false,
      code: "TOO_EARLY",
    });
    // Seeking lessons skip the clock check.
    expect(answerCue(state({ seek: true }), 0, 1, null).ok).toBe(true);
  });

  it("asks cues in order, and reads a repeat as answered", () => {
    expect(answerCue(state(), 1, 999, null)).toEqual({
      ok: false,
      code: "ORDER",
    });
    expect(answerCue(state({ done: 3 }), 3, 999, null)).toEqual({
      ok: false,
      code: "ORDER",
    });
    expect(answerCue(state({ done: 2 }), 0, 999, null)).toEqual({
      ok: false,
      code: "ANSWERED",
    });
  });

  it("asks the end cue after the whole video when its length is known", () => {
    const s = state({ done: 2, pos: 95, max: 95 });
    expect(answerCue(s, 2, 100, 600)).toEqual({
      ok: false,
      code: "TOO_EARLY",
    });
    expect(answerCue(s, 2, 600, 600)).toEqual({
      ok: true,
      state: { ...s, done: 3 },
    });
    // Unknown length: nothing to wait for.
    expect(answerCue(s, 2, 100, null).ok).toBe(true);
  });
});

describe("canFinish", () => {
  it("needs every cue and, when known, the whole video", () => {
    expect(canFinish(state({ done: 2 }), 999, null)).toEqual({
      ok: false,
      code: "UNANSWERED",
    });
    expect(canFinish(state({ done: 3 }), 100, 600)).toEqual({
      ok: false,
      code: "TOO_EARLY",
    });
    expect(canFinish(state({ done: 3 }), 600, 600)).toEqual({ ok: true });
    expect(canFinish(state({ done: 3 }), 100, null)).toEqual({ ok: true });
    expect(canFinish(state({ done: 3, seek: true }), 1, 600)).toEqual({
      ok: true,
    });
  });
});

describe("progressTo", () => {
  it("bounds the position by the clock without seek; max only grows", () => {
    expect(progressTo(state({ max: 40 }), 61.26, 60)).toEqual({
      pos: 61.3,
      max: 61.3,
    });
    expect(progressTo(state({ max: 40 }), 500, 60)).toEqual({
      pos: 60 + CLOCK_SLACK_SEC,
      max: 60 + CLOCK_SLACK_SEC,
    });
    expect(progressTo(state({ max: 40 }), 12, 60)).toEqual({
      pos: 12,
      max: 40,
    });
    expect(progressTo(state({ seek: true }), 500, 60)).toEqual({
      pos: 500,
      max: 500,
    });
    expect(progressTo(state(), -3, 60)).toEqual({ pos: 0, max: 0 });
  });
});

describe("checkPlayback", () => {
  const view = { max: 50, seek: false, cueAt: 90 };

  it("plays on and moves the furthest point", () => {
    expect(checkPlayback(51, view)).toEqual({ kind: "play", max: 51 });
    expect(checkPlayback(20, view)).toEqual({ kind: "play", max: 50 });
    expect(checkPlayback(50 + SKIP_TOLERANCE_SEC, view)).toEqual({
      kind: "play",
      max: 50 + SKIP_TOLERANCE_SEC,
    });
  });

  it("undoes a skip ahead without seek", () => {
    expect(checkPlayback(70, view)).toEqual({ kind: "rewind", to: 50 });
    expect(checkPlayback(70, { ...view, seek: true })).toEqual({
      kind: "play",
      max: 70,
    });
  });

  it("stops at the next cue, also after a jump past it", () => {
    expect(checkPlayback(90, view)).toEqual({ kind: "cue", at: 90 });
    expect(checkPlayback(300, { ...view, seek: true })).toEqual({
      kind: "cue",
      at: 90,
    });
    expect(checkPlayback(300, { ...view, cueAt: null, seek: true })).toEqual({
      kind: "play",
      max: 300,
    });
  });
});

describe("seekTarget", () => {
  it("clamps to the video and, without seek, to the furthest point", () => {
    const view = { max: 50, seek: false, duration: 600 };
    expect(seekTarget(30, view)).toBe(30);
    expect(seekTarget(200, view)).toBe(50);
    expect(seekTarget(-5, view)).toBe(0);
    expect(seekTarget(200, { ...view, seek: true })).toBe(200);
    expect(seekTarget(900, { ...view, seek: true })).toBe(600);
    // Length not known yet.
    expect(seekTarget(900, { ...view, seek: true, duration: 0 })).toBe(900);
  });
});

describe("isComplete", () => {
  it("needs a letter, text or every statement", () => {
    const mcq = { type: "mcq", statements: 0 } as const;
    const short = { type: "short", statements: 0 } as const;
    const tf = { type: "tf", statements: 2 } as const;
    expect(isComplete("A", mcq)).toBe(true);
    expect(isComplete(null, mcq)).toBe(false);
    expect(isComplete(undefined, mcq)).toBe(false);
    expect(isComplete(" 1,5 ", short)).toBe(true);
    expect(isComplete("  ", short)).toBe(false);
    expect(isComplete([true, false], tf)).toBe(true);
    expect(isComplete([true, null], tf)).toBe(false);
    expect(isComplete([true], tf)).toBe(false);
    expect(isComplete("A", tf)).toBe(false);
  });
});
