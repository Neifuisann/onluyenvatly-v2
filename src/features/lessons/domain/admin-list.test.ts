import { describe, expect, it } from "vitest";
import {
  adminListHref,
  canReorder,
  copyTitle,
  isReorderOf,
  moveItem,
  parseAdminListParams,
  ReorderSchema,
  withPageOrder,
} from "./admin-list";

const none = { q: null, status: null, page: 1 } as const;

describe("parseAdminListParams", () => {
  it("reads q, status and page", () => {
    expect(
      parseAdminListParams({ q: "  dao   động ", status: "draft", page: "3" }),
    ).toEqual({ q: "dao động", status: "draft", page: 3 });
  });

  it("falls back on invalid values", () => {
    expect(
      parseAdminListParams({
        q: "x".repeat(81),
        status: "deleted",
        page: "-2",
      }),
    ).toEqual(none);
    expect(parseAdminListParams({ q: ["a", "b"], status: [] })).toEqual({
      ...none,
      q: "a",
    });
    expect(parseAdminListParams({ page: "abc" })).toEqual(none);
    expect(parseAdminListParams({})).toEqual(none);
  });
});

describe("adminListHref", () => {
  it("leaves defaults out", () => {
    expect(adminListHref(none)).toBe("/admin/lessons");
    expect(adminListHref({ ...none, q: "sóng" }, { status: "archived" })).toBe(
      "/admin/lessons?q=s%C3%B3ng&status=archived",
    );
  });

  it("keeps the page only when asked; a new filter starts on page 1", () => {
    const f = { ...none, status: "draft", page: 3 } as const;
    expect(adminListHref(f, { page: 4 })).toBe(
      "/admin/lessons?status=draft&page=4",
    );
    expect(adminListHref(f, { status: null })).toBe("/admin/lessons");
    expect(adminListHref(f, { page: 1 })).toBe("/admin/lessons?status=draft");
  });
});

describe("withPageOrder", () => {
  it("replaces one page's slice of the full order", () => {
    expect(withPageOrder([1, 2, 3, 4, 5, 6], 2, [4, 3])).toEqual([
      1, 2, 4, 3, 5, 6,
    ]);
    expect(withPageOrder([1, 2, 3, 4, 5], 4, [5])).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("canReorder", () => {
  it("only on the unfiltered list", () => {
    expect(canReorder(none)).toBe(true);
    expect(canReorder({ ...none, q: "a" })).toBe(false);
    expect(canReorder({ ...none, status: "draft" })).toBe(false);
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
