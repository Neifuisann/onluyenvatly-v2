import { describe, expect, it } from "vitest";
import { formatClock, formatDateTime, formatScore } from "./dates";

describe("formatDateTime", () => {
  it("shows Vietnam time as dd/mm/yyyy hh:mm", () => {
    expect(formatDateTime(new Date("2026-09-28T14:30:00Z"))).toBe(
      "28/09/2026 21:30",
    );
    expect(formatDateTime(new Date("2026-12-31T17:05:00Z"))).toBe(
      "01/01/2027 00:05",
    );
  });
});

describe("formatScore", () => {
  it("uses a comma and at most two decimals", () => {
    expect(formatScore(7.75)).toBe("7,75");
    expect(formatScore(8)).toBe("8");
    expect(formatScore(0.5)).toBe("0,5");
    expect(formatScore(6.666)).toBe("6,67");
  });
});

describe("formatClock", () => {
  it("counts down in mm:ss, adding hours when needed", () => {
    expect(formatClock(1935)).toBe("32:15");
    expect(formatClock(59.9)).toBe("00:59");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-3)).toBe("00:00");
  });
});
