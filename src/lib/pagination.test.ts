import { describe, expect, it } from "vitest";
import { pageWindow, paginate } from "./pagination";

describe("paginate", () => {
  const list = Array.from({ length: 45 }, (_, i) => i + 1);

  it("slices the requested page", () => {
    const p = paginate(list, 2, 20);
    expect(p.items).toEqual(list.slice(20, 40));
    expect(p).toMatchObject({ page: 2, pageCount: 3, offset: 20, total: 45 });
  });

  it("clamps out-of-range and invalid pages", () => {
    expect(paginate(list, 9, 20).page).toBe(3);
    expect(paginate(list, 9, 20).items).toEqual([41, 42, 43, 44, 45]);
    expect(paginate(list, 0, 20).page).toBe(1);
    expect(paginate(list, Number.NaN, 20).page).toBe(1);
  });

  it("has one empty page for an empty list", () => {
    expect(paginate([], 3, 20)).toEqual({
      items: [],
      page: 1,
      pageCount: 1,
      offset: 0,
      total: 0,
    });
  });
});

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("skips runs with null, never a single page", () => {
    expect(pageWindow(1, 12)).toEqual([1, 2, 3, 4, 5, null, 12]);
    expect(pageWindow(4, 12)).toEqual([1, 2, 3, 4, 5, null, 12]);
    expect(pageWindow(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(pageWindow(9, 12)).toEqual([1, null, 8, 9, 10, 11, 12]);
    expect(pageWindow(12, 12)).toEqual([1, null, 8, 9, 10, 11, 12]);
  });

  it("always has at most 7 slots and includes the current page", () => {
    for (let count = 1; count <= 30; count++)
      for (let current = 1; current <= count; current++) {
        const w = pageWindow(current, count);
        expect(w.length).toBeLessThanOrEqual(7);
        expect(w).toContain(current);
        expect(w[0]).toBe(1);
        expect(w.at(-1)).toBe(count);
      }
  });
});
