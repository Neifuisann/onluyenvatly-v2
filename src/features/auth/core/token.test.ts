import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  hashSessionToken,
  isWellFormedToken,
} from "./token";

describe("generateSessionToken", () => {
  it("returns 32 random bytes as base64url", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 200 }, generateSessionToken));
    expect(seen.size).toBe(200);
  });
});

describe("hashSessionToken", () => {
  it("is a deterministic sha256 hex digest", () => {
    const a = hashSessionToken("token", "pepper");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken("token", "pepper")).toBe(a);
  });

  it("depends on the pepper", () => {
    expect(hashSessionToken("token", "p1")).not.toBe(
      hashSessionToken("token", "p2"),
    );
  });

  it("never equals the raw token", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token, "pepper")).not.toContain(token);
  });
});

describe("isWellFormedToken", () => {
  it("accepts generated tokens", () => {
    expect(isWellFormedToken(generateSessionToken())).toBe(true);
  });

  it.each([
    undefined,
    null,
    42,
    "",
    "short",
    `${"a".repeat(42)}=`,
    "a".repeat(44),
  ])("rejects %j", (value) => {
    expect(isWellFormedToken(value)).toBe(false);
  });
});
