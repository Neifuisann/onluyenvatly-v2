import { describe, expect, it } from "vitest";
import { maskPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["0912345678", "0912345678"],
    [" 0912 345 678 ", "0912345678"],
    ["0912.345.678", "0912345678"],
    ["0912-345-678", "0912345678"],
    ["(091) 2345678", "0912345678"],
    ["+84912345678", "0912345678"],
    ["+84 912 345 678", "0912345678"],
    ["84912345678", "0912345678"],
    ["912345678", "0912345678"],
    ["0356789012", "0356789012"],
    ["0701234567", "0701234567"],
    ["0581234567", "0581234567"],
    ["0861234567", "0861234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    "",
    "abc",
    "091234567", // 9 digits starting with 0
    "09123456789", // 11 digits
    "0212345678", // landline prefix
    "0112345678",
    "+1 912 345 678",
    "0912a45678",
    "84 212 345 678",
    "admin",
  ])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("maskPhone", () => {
  it("keeps only the prefix and the last 3 digits", () => {
    expect(maskPhone("0912345678")).toBe("09xx…678");
  });

  it("hides very short values completely", () => {
    expect(maskPhone("0912")).toBe("xx…");
  });
});
