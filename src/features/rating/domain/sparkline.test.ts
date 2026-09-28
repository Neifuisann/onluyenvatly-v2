import { describe, expect, it } from "vitest";
import { ratingSeries, sparklinePoints } from "./sparkline";

describe("ratingSeries", () => {
  it("starts from the rating before the first change", () => {
    expect(
      ratingSeries([
        { before: 1500, after: 1530 },
        { before: 1530, after: 1520 },
      ]),
    ).toEqual([1500, 1530, 1520]);
  });

  it("is empty without changes", () => {
    expect(ratingSeries([])).toEqual([]);
  });
});

describe("sparklinePoints", () => {
  it("maps the lowest value to the bottom and the highest to the top", () => {
    expect(sparklinePoints([1500, 1600, 1550], 100, 20, 0)).toBe(
      "0,20 50,0 100,10",
    );
  });

  it("keeps the padding free", () => {
    expect(sparklinePoints([1, 2], 10, 10, 2)).toBe("2,8 8,2");
  });

  it("centres a flat or single-point series", () => {
    expect(sparklinePoints([1500, 1500], 100, 20, 0)).toBe("0,10 100,10");
    expect(sparklinePoints([1500], 100, 20)).toBe("50,10");
    expect(sparklinePoints([], 100, 20)).toBe("");
  });
});
