import { describe, expect, it } from "vitest";
import {
  GUARD_DEDUPE_SEC,
  guardSecond,
  MAX_GUARD_BATCH,
  pushGuard,
} from "./guard";

describe("guardSecond", () => {
  it("counts whole seconds from the start, never negative", () => {
    expect(guardSecond(1_000, 133_400)).toBe(132);
    expect(guardSecond(5_000, 1_000)).toBe(0);
  });
});

describe("pushGuard", () => {
  it("appends events in order", () => {
    const a = pushGuard([], { t: 3, k: "blur" });
    expect(pushGuard(a, { t: 3, k: "hidden" })).toEqual([
      { t: 3, k: "blur" },
      { t: 3, k: "hidden" },
    ]);
  });

  it("merges repeats of one kind within the dedupe window", () => {
    const a = pushGuard([], { t: 10, k: "copy" });
    const b = pushGuard(a, { t: 10 + GUARD_DEDUPE_SEC - 1, k: "copy" });
    expect(b).toBe(a);
    expect(pushGuard(b, { t: 10 + GUARD_DEDUPE_SEC, k: "copy" })).toHaveLength(
      2,
    );
  });

  it("stops at the batch cap", () => {
    let pending = pushGuard([], { t: 0, k: "blur" });
    for (let i = 1; i < MAX_GUARD_BATCH + 5; i++)
      pending = pushGuard(pending, { t: i * 10, k: "blur" });
    expect(pending).toHaveLength(MAX_GUARD_BATCH);
  });
});
