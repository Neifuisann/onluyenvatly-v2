import { describe, expect, it } from "vitest";
import {
  adminListHref,
  canReorder,
  copyTitle,
  isReorderOf,
  moveItem,
  parseAdminListParams,
  ReorderSchema,
  sortAdminRows,
  sortHref,
  withPageOrder,
} from "./admin-list";

const none = {
  q: null,
  status: null,
  sort: "updated",
  dir: "desc",
  page: 1,
} as const;
const manual = { ...none, sort: "manual", dir: "asc" } as const;

describe("parseAdminListParams", () => {
  it("reads q, status and page", () => {
    expect(
      parseAdminListParams({ q: "  dao   động ", status: "draft", page: "3" }),
    ).toEqual({ ...none, q: "dao động", status: "draft", page: 3 });
  });

  it("reads the sort and its direction, defaulting to the newest change", () => {
    expect(parseAdminListParams({ sort: "title" })).toMatchObject({
      sort: "title",
      dir: "asc",
    });
    expect(parseAdminListParams({ sort: "created", dir: "asc" })).toMatchObject(
      { sort: "created", dir: "asc" },
    );
    expect(parseAdminListParams({ sort: "manual", dir: "desc" })).toMatchObject(
      { sort: "manual", dir: "asc" },
    );
    expect(parseAdminListParams({ sort: "x", dir: "up" })).toMatchObject({
      sort: "updated",
      dir: "desc",
    });
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

  it("keeps a non-default sort and direction", () => {
    expect(adminListHref({ ...none, sort: "title", dir: "asc" })).toBe(
      "/admin/lessons?sort=title",
    );
    expect(adminListHref({ ...none, dir: "asc" })).toBe(
      "/admin/lessons?dir=asc",
    );
    expect(adminListHref(manual, { status: "draft" })).toBe(
      "/admin/lessons?status=draft&sort=manual",
    );
  });
});

describe("sortHref", () => {
  it("flips the current column and starts another in its natural direction", () => {
    expect(sortHref(none, "updated")).toBe("/admin/lessons?dir=asc");
    expect(sortHref({ ...none, dir: "asc" }, "updated")).toBe("/admin/lessons");
    expect(sortHref(none, "title")).toBe("/admin/lessons?sort=title");
    expect(sortHref({ ...none, sort: "title", dir: "asc" }, "title")).toBe(
      "/admin/lessons?sort=title&dir=desc",
    );
    expect(sortHref({ ...none, page: 4 }, "created")).toBe(
      "/admin/lessons?sort=created",
    );
    expect(sortHref(manual, "manual")).toBe("/admin/lessons?sort=manual");
  });
});

describe("sortAdminRows", () => {
  const day = (d: number) => new Date(Date.UTC(2026, 0, d));
  const rows = [
    { id: 1, title: "Sóng cơ", createdAt: day(1), updatedAt: day(9) },
    { id: 2, title: "Ánh sáng", createdAt: day(3), updatedAt: day(5) },
    { id: 3, title: "bài 10", createdAt: day(2), updatedAt: day(9) },
    { id: 4, title: "Bài 9", createdAt: day(2), updatedAt: day(1) },
  ];
  const ids = (r: typeof rows) => r.map((x) => x.id);

  it("keeps the manual order as read", () => {
    expect(ids(sortAdminRows(rows, "manual", "asc"))).toEqual([1, 2, 3, 4]);
  });

  it("sorts by dates, ties by id", () => {
    expect(ids(sortAdminRows(rows, "updated", "desc"))).toEqual([3, 1, 2, 4]);
    expect(ids(sortAdminRows(rows, "created", "asc"))).toEqual([1, 3, 4, 2]);
  });

  it("sorts titles the Vietnamese way, numbers by value, case-blind", () => {
    expect(ids(sortAdminRows(rows, "title", "asc"))).toEqual([2, 4, 3, 1]);
    expect(ids(sortAdminRows(rows, "title", "desc"))).toEqual([1, 3, 4, 2]);
  });

  it("does not mutate its input", () => {
    sortAdminRows(rows, "title", "asc");
    expect(ids(rows)).toEqual([1, 2, 3, 4]);
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
  it("only on the unfiltered list in the manual order", () => {
    expect(canReorder(manual)).toBe(true);
    expect(canReorder(none)).toBe(false);
    expect(canReorder({ ...manual, q: "a" })).toBe(false);
    expect(canReorder({ ...manual, status: "draft" })).toBe(false);
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
