import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("accepts an empty environment while features are not built yet", () => {
    const env = parseEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.AI_DAILY_BUDGET).toBe(0);
  });

  it("treats empty strings as unset", () => {
    expect(parseEnv({ DATABASE_URL: "" }).DATABASE_URL).toBeUndefined();
  });

  it("coerces numbers", () => {
    expect(parseEnv({ AI_DAILY_BUDGET: "20" }).AI_DAILY_BUDGET).toBe(20);
  });

  it("rejects malformed values with a readable message", () => {
    expect(() =>
      parseEnv({ DATABASE_URL: "not-a-url", SESSION_PEPPER: "short" }),
    ).toThrow(/DATABASE_URL[\s\S]*SESSION_PEPPER/);
  });
});
