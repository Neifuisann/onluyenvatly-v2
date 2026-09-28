import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const required = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  SESSION_PEPPER: "x".repeat(32),
};

describe("parseEnv", () => {
  it("accepts the required vars and fills defaults", () => {
    const env = parseEnv(required);
    expect(env.NODE_ENV).toBe("development");
    expect(env.AI_DAILY_BUDGET).toBe(0);
  });

  it("fails when a required var is missing", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL[\s\S]*SESSION_PEPPER/);
  });

  it("treats empty strings as unset", () => {
    expect(
      parseEnv({ ...required, DATABASE_URL_DIRECT: "" }).DATABASE_URL_DIRECT,
    ).toBeUndefined();
  });

  it("coerces numbers", () => {
    expect(
      parseEnv({ ...required, AI_DAILY_BUDGET: "20" }).AI_DAILY_BUDGET,
    ).toBe(20);
  });

  it("rejects malformed values with a readable message", () => {
    expect(() =>
      parseEnv({ DATABASE_URL: "not-a-url", SESSION_PEPPER: "short" }),
    ).toThrow(/DATABASE_URL[\s\S]*SESSION_PEPPER/);
  });
});
