import { describe, expect, it } from "vitest";
import { DEADLINE_GRACE_MS, isPastGrace, timeTakenSec } from "./deadline";

const t0 = new Date("2026-10-20T02:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("isPastGrace", () => {
  it("allows the whole grace period, then closes", () => {
    const deadline = at(60_000);
    expect(isPastGrace(deadline, at(60_000 + DEADLINE_GRACE_MS))).toBe(false);
    expect(isPastGrace(deadline, at(60_001 + DEADLINE_GRACE_MS))).toBe(true);
    expect(isPastGrace(null, at(1e12))).toBe(false);
  });
});

describe("timeTakenSec", () => {
  it("counts to now, capped at the deadline", () => {
    expect(timeTakenSec(t0, null, at(125_400))).toBe(125);
    expect(timeTakenSec(t0, at(60_000), at(45_000))).toBe(45);
    expect(timeTakenSec(t0, at(60_000), at(80_000))).toBe(60);
    expect(timeTakenSec(t0, null, at(-5_000))).toBe(0);
  });
});
