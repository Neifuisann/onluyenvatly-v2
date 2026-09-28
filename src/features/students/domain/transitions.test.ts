import { describe, expect, it } from "vitest";
import { canSetStatus } from "./transitions";

describe("canSetStatus", () => {
  it("disables only active accounts", () => {
    expect(canSetStatus("active", "disabled")).toBe(true);
    for (const from of ["pending", "rejected", "disabled"] as const)
      expect(canSetStatus(from, "disabled")).toBe(false);
  });

  it("re-enables disabled and rejected accounts, never pending ones", () => {
    expect(canSetStatus("disabled", "active")).toBe(true);
    expect(canSetStatus("rejected", "active")).toBe(true);
    expect(canSetStatus("pending", "active")).toBe(false);
    expect(canSetStatus("active", "active")).toBe(false);
  });
});
