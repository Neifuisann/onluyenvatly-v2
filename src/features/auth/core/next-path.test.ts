import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/lessons?grade=12&q=dao%20dong", "/lessons?grade=12&q=dao%20dong"],
    ["/lessons/12#top", "/lessons/12#top"],
    ["/admin/students", "/admin/students"],
    ["/a/../dashboard", "/dashboard"],
  ])("keeps %j", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    undefined,
    null,
    42,
    "",
    "dashboard",
    "https://evil.example/x",
    "//evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    "/\tevil",
    "/\n/evil.example",
    "javascript:alert(1)",
    "/login",
    "/login?next=/x",
    "/register/pending",
    `/${"a".repeat(600)}`,
  ])("rejects %j", (input) => {
    expect(safeNextPath(input)).toBeNull();
  });

  it("keeps an encoded newline as data, not a new origin", () => {
    // %0a stays encoded in the pathname, so the origin is still ours.
    expect(safeNextPath("/%0a/evil")).toBe("/%0a/evil");
  });
});
