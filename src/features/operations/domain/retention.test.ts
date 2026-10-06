import { expect, it } from "vitest";
import { retentionCutoffs } from "./retention";

it("uses UTC durations across month and year boundaries without mutating now", () => {
  const now = new Date("2026-01-01T00:30:00Z");
  expect(retentionCutoffs(now)).toEqual({
    expiry: new Date("2025-12-31T23:30:00Z"),
    rateLimits: new Date("2025-12-30T00:30:00Z"),
    privateData: new Date("2025-07-05T00:30:00Z"),
    staleLobbies: new Date("2025-12-31T00:30:00Z"),
    gameRooms: new Date("2025-12-02T00:30:00Z"),
  });
  expect(now.toISOString()).toBe("2026-01-01T00:30:00.000Z");
});
