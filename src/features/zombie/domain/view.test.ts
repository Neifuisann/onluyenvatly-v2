import { describe, expect, it } from "vitest";
import type { ZombieState } from "../../../db/schema.ts";
import {
  downLanes,
  ENTER_MS,
  laneForKey,
  laneLetter,
  statementLetter,
  UNTIMED_STOP,
  walkProgress,
} from "./view.ts";

const state = (patch: Partial<ZombieState>): ZombieState => ({
  lives: 3,
  sec: 20,
  at: 10_000,
  wave: 0,
  misses: 0,
  over: null,
  waves: [{ i: 0, n: 4, s: [] }],
  ...patch,
});

describe("walkProgress", () => {
  it("stands still before the start", () => {
    expect(walkProgress(state({ at: null }), 5)).toBe(0);
  });

  it("walks in during the break, then toward the barricade", () => {
    const s = state({});
    expect(walkProgress(s, 10_000 - ENTER_MS * 2)).toBe(-1);
    expect(walkProgress(s, 10_000 - ENTER_MS / 2)).toBe(-0.5);
    expect(walkProgress(s, 10_000)).toBe(0);
    expect(walkProgress(s, 20_000)).toBe(0.5);
    expect(walkProgress(s, 99_000)).toBe(1);
  });

  it("stops early when there is no clock", () => {
    const s = state({ sec: null });
    expect(walkProgress(s, 12_000)).toBeCloseTo(UNTIMED_STOP / 2);
    expect(walkProgress(s, 99_000)).toBe(UNTIMED_STOP);
  });
});

describe("lanes", () => {
  it("knocks out wrong shots only", () => {
    expect(downLanes({ i: 0, n: 4, s: [0, 3] })).toEqual([0, 3]);
    expect(downLanes({ i: 0, n: 4, s: [0, 2], e: "hit", k: 2 })).toEqual([0]);
  });

  it("labels mcq and tf lanes", () => {
    expect(laneLetter({}, 2)).toBe("C");
    expect(laneLetter({}, 9)).toBe("?");
    expect(laneLetter({ p: 1 }, 0)).toBe("Đ");
    expect(laneLetter({ p: 1 }, 1)).toBe("S");
    expect(statementLetter(2)).toBe("c");
  });

  it("maps keys to lanes", () => {
    const mcq = { n: 4 };
    expect(
      ["a", "B", "4", "e", "5", "0", "x", "Enter"].map((k) =>
        laneForKey(mcq, k),
      ),
    ).toEqual([0, 1, 3, null, null, null, null, null]);
    const tf = { n: 2, p: 0 };
    expect(
      ["Đ", "d", "1", "s", "2", "a"].map((k) => laneForKey(tf, k)),
    ).toEqual([0, 0, 0, 1, 1, null]);
  });
});
