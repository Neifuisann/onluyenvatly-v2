import { describe, expect, it } from "vitest";
import {
  catalogHref,
  DEFAULT_FILTERS,
  hasFilters,
  searchTerms,
} from "./catalog";
import { parseCatalogParams } from "./catalog-params";

describe("parseCatalogParams", () => {
  it("returns defaults for no params", () => {
    expect(parseCatalogParams({})).toEqual(DEFAULT_FILTERS);
  });

  it("parses and normalizes valid params", () => {
    expect(
      parseCatalogParams({
        q: "  dao   động ",
        grade: "12",
        chapter: "Dao động cơ",
        tag: ["giữa kì", "ignored"],
        sort: "newest",
        page: "3",
      }),
    ).toEqual({
      q: "dao động",
      grade: 12,
      chapter: "Dao động cơ",
      tag: "giữa kì",
      sort: "newest",
      page: 3,
    });
  });

  it("falls back per field on invalid input instead of throwing", () => {
    expect(
      parseCatalogParams({
        q: "x".repeat(81),
        grade: "9",
        chapter: "",
        sort: "drop table",
        page: "999",
      }),
    ).toEqual(DEFAULT_FILTERS);
    expect(parseCatalogParams({ page: "-1", grade: "abc" })).toEqual(
      DEFAULT_FILTERS,
    );
  });
});

describe("catalogHref", () => {
  it("omits defaults and encodes values", () => {
    expect(catalogHref(DEFAULT_FILTERS)).toBe("/lessons");
    expect(
      catalogHref(DEFAULT_FILTERS, { q: "dao động", grade: 11, page: 2 }),
    ).toBe("/lessons?q=dao+%C4%91%E1%BB%99ng&grade=11&page=2");
  });

  it("round-trips through the parser", () => {
    const f = {
      ...DEFAULT_FILTERS,
      q: "sóng & âm",
      chapter: "Sóng cơ",
      tag: "Lớp 12",
      sort: "title" as const,
      page: 2,
    };
    const params = Object.fromEntries(
      new URLSearchParams(catalogHref(f).split("?")[1]),
    );
    expect(parseCatalogParams(params)).toEqual(f);
  });
});

describe("hasFilters / searchTerms", () => {
  it("detects filters, ignoring sort and page", () => {
    expect(hasFilters({ ...DEFAULT_FILTERS, sort: "title", page: 3 })).toBe(
      false,
    );
    expect(hasFilters({ ...DEFAULT_FILTERS, tag: "x" })).toBe(true);
  });

  it("splits words, caps at 5 and escapes LIKE wildcards", () => {
    expect(searchTerms(null)).toEqual([]);
    expect(searchTerms("a b c d e f")).toEqual(["a", "b", "c", "d", "e"]);
    expect(searchTerms("100% _x_ a\\b")).toEqual([
      "100\\%",
      "\\_x\\_",
      "a\\\\b",
    ]);
  });
});
