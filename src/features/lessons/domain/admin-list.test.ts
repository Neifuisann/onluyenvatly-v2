import { describe, expect, it } from "vitest";
import {
  adminListHref,
  canReorder,
  copyTitle,
  isReorderOf,
  moveItem,
  parseAdminListParams,
  ReorderSchema,
} from "./admin-list";

describe("parseAdminListParams", () => {
  it("reads q and status", () => {
    expect(
      parseAdminListParams({ q: "  dao   động ", status: "draft" }),
    ).toEqual({ q: "dao động", status: "draft" });
  });

  it("falls back on invalid values", () => {
    expect(
      parseAdminListParams({ q: "x".repeat(81), status: "deleted" }),
    ).toEqual({ q: null, status: null });
    expect(parseAdminListParams({ q: ["a", "b"], status: [] })).toEqual({
      q: "a",
      status: null,
    });
    expect(parseAdminListParams({})).toEqual({ q: null, status: null });
  });
});

describe("adminListHref", () => {
  it("leaves defaults out", () => {
    expect(adminListHref({ q: null, status: null })).toBe("/admin/lessons");
    expect(
      adminListHref({ q: "sóng", status: null }, { status: "archived" }),
    ).toBe("/admin/lessons?q=s%C3%B3ng&status=archived");
  });
});

describe("canReorder", () => {
  it("only on the unfiltered list", () => {
    expect(canReorder({ q: null, status: null })).toBe(true);
    expect(canReorder({ q: "a", status: null })).toBe(false);
    expect(canReorder({ q: null, status: "draft" })).toBe(false);
  });
});

describe("moveItem", () => {
  it("moves down and up", () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
  });

  it("clamps the target and ignores a bad source", () => {
    expect(moveItem([1, 2, 3], 0, 99)).toEqual([2, 3, 1]);
    expect(moveItem([1, 2, 3], 2, -5)).toEqual([3, 1, 2]);
    expect(moveItem([1, 2, 3], 5, 0)).toEqual([1, 2, 3]);
  });

  it("does not mutate its input", () => {
    const list = [1, 2, 3];
    moveItem(list, 0, 1);
    expect(list).toEqual([1, 2, 3]);
  });
});

describe("isReorderOf", () => {
  it("accepts a permutation", () => {
    expect(isReorderOf([1, 2, 3], [3, 1, 2])).toBe(true);
  });

  it("rejects missing, extra or repeated ids", () => {
    expect(isReorderOf([1, 2, 3], [1, 2])).toBe(false);
    expect(isReorderOf([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(isReorderOf([1, 2, 3], [1, 1, 2])).toBe(false);
  });
});

describe("copyTitle / ReorderSchema", () => {
  it("marks the copy", () => {
    expect(copyTitle("Đề ôn GK1")).toBe("Đề ôn GK1 (bản sao)");
  });

  it("validates reorder input", () => {
    expect(ReorderSchema.safeParse({ ids: [3, 1, 2] }).success).toBe(true);
    expect(ReorderSchema.safeParse({ ids: ["3", 1] }).data).toEqual({
      ids: [3, 1],
    });
    expect(ReorderSchema.safeParse({ ids: [1, 1] }).success).toBe(false);
    expect(ReorderSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(ReorderSchema.safeParse({ ids: [0] }).success).toBe(false);
    expect(ReorderSchema.safeParse({ ids: [1], x: 1 }).success).toBe(false);
  });
});
