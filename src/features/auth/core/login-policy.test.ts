import { describe, expect, it } from "vitest";
import {
  homePath,
  isValidUsername,
  landingPath,
  parseIdentifier,
  postLoginPath,
  statusError,
} from "./login-policy";

describe("parseIdentifier", () => {
  it("reads phone numbers in any common format", () => {
    expect(parseIdentifier("+84 912 345 678")).toEqual({
      kind: "phone",
      value: "0912345678",
    });
  });

  it("reads usernames case-insensitively", () => {
    expect(parseIdentifier("  Admin ")).toEqual({
      kind: "username",
      value: "admin",
    });
    expect(parseIdentifier("co.giao_ly-1")).toEqual({
      kind: "username",
      value: "co.giao_ly-1",
    });
  });

  it.each([
    "",
    "ab",
    "1admin",
    "a b c",
    "admin@x",
    "x".repeat(40),
  ])("rejects %j", (raw) => {
    expect(parseIdentifier(raw)).toBeNull();
  });
});

describe("isValidUsername", () => {
  it("matches the login rule", () => {
    expect(isValidUsername("admin")).toBe(true);
    expect(isValidUsername("Admin")).toBe(false);
  });
});

describe("statusError", () => {
  it.each([
    ["active", null],
    ["pending", "ACCOUNT_PENDING"],
    ["rejected", "ACCOUNT_REJECTED"],
    ["disabled", "ACCOUNT_REJECTED"],
  ] as const)("%s → %s", (status, expected) => {
    expect(statusError(status)).toBe(expected);
  });
});

describe("landingPath", () => {
  it("sends each role home by default", () => {
    expect(homePath("admin")).toBe("/admin");
    expect(landingPath("admin", null)).toBe("/admin");
    expect(homePath("teacher")).toBe("/admin");
    expect(landingPath("teacher", "/admin/classes")).toBe("/admin/classes");
    expect(landingPath("student", null)).toBe("/dashboard");
  });

  it("honours next", () => {
    expect(landingPath("student", "/lessons/3")).toBe("/lessons/3");
    expect(landingPath("admin", "/admin/students")).toBe("/admin/students");
    expect(landingPath("admin", "/lessons")).toBe("/lessons");
  });

  it("never sends a student to /admin", () => {
    expect(landingPath("student", "/admin")).toBe("/dashboard");
    expect(landingPath("student", "/admin/settings")).toBe("/dashboard");
    expect(landingPath("student", "/administrator")).toBe("/administrator");
  });
});

describe("postLoginPath", () => {
  it("is the landing path when nothing must change", () => {
    expect(postLoginPath("student", false, null)).toBe("/dashboard");
    expect(postLoginPath("admin", false, "/admin/students")).toBe(
      "/admin/students",
    );
  });

  it("goes to change-password first after an admin reset", () => {
    expect(postLoginPath("student", true, null)).toBe("/change-password");
    expect(postLoginPath("student", true, "/lessons/3?tab=1")).toBe(
      "/change-password?next=%2Flessons%2F3%3Ftab%3D1",
    );
    // A student's /admin target is already replaced by the landing rule.
    expect(postLoginPath("student", true, "/admin")).toBe("/change-password");
  });
});
