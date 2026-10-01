import { expect, it } from "vitest";
import { quotaWarnings } from "./quotas";

it("warns exactly at 60%, including over-budget metrics", () => {
  const values = [59, 60, 101].map((used) => ({
    name: String(used),
    used,
    limit: 100,
  }));
  expect(quotaWarnings(values)).toEqual(values.slice(1));
  expect(quotaWarnings([])).toEqual([]);
});
it("rejects missing, negative, infinite or zero budgets", () => {
  for (const [used, limit] of [
    [-1, 1],
    [NaN, 1],
    [Infinity, 1],
    [1, 0],
    [1, Infinity],
  ])
    expect(() =>
      quotaWarnings([{ name: "test", used: used ?? 0, limit: limit ?? 0 }]),
    ).toThrow();
});
