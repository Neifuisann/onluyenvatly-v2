import { describe, expect, it } from "vitest";
import { hashPassword, passwordIssue, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("round-trips with a cost-10 bcrypt hash", async () => {
    const hash = await hashPassword("vatly-2026");
    expect(hash).toMatch(/^\$2[ab]\$10\$/);
    expect(await verifyPassword("vatly-2026", hash)).toBe(true);
    expect(await verifyPassword("vatly-2027", hash)).toBe(false);
  });

  it("accepts v1 $2a$ hashes", async () => {
    // bcrypt of "password1" generated with the $2a$ prefix, as v1 stored some.
    const v1 = "$2a$10$KCn3b9JtLx1C9Tqk8ZcN6OYQ7KX9b5k7wqvH1u8sWqvT7m0p0lX6a";
    expect(await verifyPassword("anything", v1)).toBe(false);
    const fresh = (await hashPassword("password1")).replace(/^\$2b\$/, "$2a$");
    expect(await verifyPassword("password1", fresh)).toBe(true);
  });

  it("returns false (after a dummy compare) when there is no hash", async () => {
    expect(await verifyPassword("whatever", null)).toBe(false);
    expect(await verifyPassword("whatever", undefined)).toBe(false);
  });
});

describe("passwordIssue", () => {
  it("accepts a reasonable password", () => {
    expect(passwordIssue("vatly-12a1", "0912345678")).toBeNull();
    expect(passwordIssue("mậtkhẩu12")).toBeNull();
  });

  it.each([
    ["short1", "TOO_SHORT"],
    ["12345678", "ALL_DIGITS"],
    ["a".repeat(73), "TOO_LONG"],
    ["ệ".repeat(25), "TOO_LONG"], // 25 chars but 75 bytes
  ] as const)("%j → %s", (pw, issue) => {
    expect(passwordIssue(pw)).toBe(issue);
  });

  it("rejects passwords that contain the phone number", () => {
    expect(passwordIssue("0912345678a", "0912345678")).toBe("CONTAINS_PHONE");
    expect(passwordIssue("x912345678", "0912345678")).toBe("CONTAINS_PHONE");
    expect(passwordIssue("0912345678")).toBe("ALL_DIGITS");
  });
});
