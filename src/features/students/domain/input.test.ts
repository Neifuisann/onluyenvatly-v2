import { describe, expect, it } from "vitest";
import {
  BulkIdsSchema,
  CreateAdminSchema,
  DeleteStudentSchema,
  GrantAttemptsSchema,
  namesMatch,
  SetStatusSchema,
} from "./input";

const A = "3f2b8c1e-6a4d-4e0b-9c57-1d2e3f4a5b6c";
const B = "8a1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";

describe("BulkIdsSchema", () => {
  it("takes 1–200 distinct uuids", () => {
    expect(BulkIdsSchema.safeParse({ ids: [A, B] }).success).toBe(true);
    expect(BulkIdsSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(BulkIdsSchema.safeParse({ ids: [A, A] }).success).toBe(false);
    expect(BulkIdsSchema.safeParse({ ids: ["1; drop table"] }).success).toBe(
      false,
    );
    expect(BulkIdsSchema.safeParse({ ids: [A], extra: 1 }).success).toBe(false);
    const many = Array.from(
      { length: 201 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    expect(BulkIdsSchema.safeParse({ ids: many }).success).toBe(false);
    expect(BulkIdsSchema.safeParse({ ids: many.slice(0, 200) }).success).toBe(
      true,
    );
  });
});

describe("SetStatusSchema", () => {
  it("only accepts active and disabled", () => {
    expect(
      SetStatusSchema.safeParse({ id: A, status: "disabled" }).success,
    ).toBe(true);
    expect(
      SetStatusSchema.safeParse({ id: A, status: "pending" }).success,
    ).toBe(false);
  });
});

describe("DeleteStudentSchema", () => {
  it("needs an id and the typed name", () => {
    expect(
      DeleteStudentSchema.safeParse({ id: A, confirmName: "An" }).success,
    ).toBe(true);
    expect(DeleteStudentSchema.safeParse({ id: A }).success).toBe(false);
  });
});

describe("GrantAttemptsSchema", () => {
  it("takes 0 (remove) to 100 whole extra tries on a lesson id", () => {
    const ok = (extra: number, lessonId = 5) =>
      GrantAttemptsSchema.safeParse({ userId: A, lessonId, extra }).success;
    expect(ok(0)).toBe(true);
    expect(ok(100)).toBe(true);
    expect(ok(101)).toBe(false);
    expect(ok(-1)).toBe(false);
    expect(ok(1.5)).toBe(false);
    expect(ok(1, 0)).toBe(false);
  });
});

describe("CreateAdminSchema", () => {
  const valid = {
    fullName: "  Trần   Thị  Hoa ",
    username: " Co.Hoa ",
    password: "vatly-2026",
  };

  it("normalizes the name and lowercases the username", () => {
    const parsed = CreateAdminSchema.parse(valid);
    expect(parsed.fullName).toBe("Trần Thị Hoa");
    expect(parsed.username).toBe("co.hoa");
  });

  it("refuses a bad username, name or password", () => {
    const bad = (patch: object) =>
      CreateAdminSchema.safeParse({ ...valid, ...patch }).success;
    expect(bad({ username: "1abc" })).toBe(false);
    expect(bad({ username: "ab" })).toBe(false);
    expect(bad({ username: "0912345678" })).toBe(false);
    expect(bad({ fullName: "A" })).toBe(false);
    expect(bad({ password: "short" })).toBe(false);
    expect(bad({ password: "12345678" })).toBe(false);
    expect(bad({ extra: true })).toBe(false);
  });
});

describe("namesMatch", () => {
  it("ignores case, extra spaces and accent composition", () => {
    expect(namesMatch("  học   sinh  một ", "Học Sinh Một")).toBe(true);
    // NFD "ộ" typed on some keyboards equals the composed one.
    expect(namesMatch("Hộc".normalize("NFD"), "Hộc")).toBe(true);
    expect(namesMatch("Học Sinh", "Học Sinh Một")).toBe(false);
    expect(namesMatch("", "An")).toBe(false);
  });
});
