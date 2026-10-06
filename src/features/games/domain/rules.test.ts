import { describe, expect, it } from "vitest";
import {
  defaultRacer,
  generatePin,
  PinSchema,
  RACER_COLORS,
  RACERS,
} from "./rules.ts";

describe("PIN", () => {
  it("is six digits without a leading zero", () => {
    expect(generatePin(() => 100_000)).toBe("100000");
    expect(generatePin((_min, max) => max - 1)).toBe("999999");
    expect(PinSchema.safeParse(" 482913 ").success).toBe(true);
    for (const bad of ["012345", "12345", "1234567", "12a456", ""])
      expect(PinSchema.safeParse(bad).success).toBe(false);
  });
});

describe("defaultRacer", () => {
  it("is stable per user and always a valid choice", () => {
    const ids = [
      "6f1c2a8e-0000-4000-8000-000000000001",
      "6f1c2a8e-0000-4000-8000-000000000002",
      "b1",
      "",
    ];
    for (const id of ids) {
      const look = defaultRacer(id);
      expect(defaultRacer(id)).toEqual(look);
      expect(RACERS).toContain(look.racer);
      expect(look.color).toBeGreaterThanOrEqual(0);
      expect(look.color).toBeLessThan(RACER_COLORS);
    }
  });

  it("spreads users over several racers", () => {
    const racers = new Set(
      Array.from({ length: 40 }, (_, i) => defaultRacer(`user-${i}`).racer),
    );
    expect(racers.size).toBeGreaterThan(3);
  });
});
