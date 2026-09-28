import { describe, expect, it } from "vitest";
import { pgErrorCode } from "./pg-error";

describe("pgErrorCode", () => {
  it("reads the driver code from Drizzle's cause first", () => {
    expect(pgErrorCode({ code: "X", cause: { code: "23503" } })).toBe("23503");
    expect(pgErrorCode({ code: "28P01" })).toBe("28P01");
  });
  it("is null without a string code", () => {
    expect(pgErrorCode(null)).toBeNull();
    expect(pgErrorCode(new Error("x"))).toBeNull();
    expect(pgErrorCode({ code: 5 })).toBeNull();
  });
});
