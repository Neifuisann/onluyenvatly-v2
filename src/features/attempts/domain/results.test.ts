import { describe, expect, it } from "vitest";
import {
  exportHref,
  hasFilters,
  isCalendarDay,
  nameTerms,
  parseResultsParams,
  RESULTS_MAX_PAGE,
  type ResultsFilters,
  resultsHref,
  submittedRange,
  vnDayStart,
} from "./results";

const none: ResultsFilters = {
  lessonId: null,
  q: null,
  from: null,
  to: null,
  page: 1,
};

describe("parseResultsParams", () => {
  it("reads every filter", () => {
    expect(
      parseResultsParams({
        lesson: "12",
        q: "  nguyen   an ",
        from: "2026-09-01",
        to: "2026-09-30",
        page: "3",
      }),
    ).toEqual({
      lessonId: 12,
      q: "nguyen an",
      from: "2026-09-01",
      to: "2026-09-30",
      page: 3,
    });
  });

  it("falls back per field and never throws", () => {
    expect(parseResultsParams({})).toEqual(none);
    expect(
      parseResultsParams({
        lesson: ["abc", "3"],
        q: "x".repeat(81),
        from: "2026-02-30",
        to: "30/09/2026",
        page: String(RESULTS_MAX_PAGE + 1),
      }),
    ).toEqual(none);
    expect(parseResultsParams({ lesson: "-1", page: "0" })).toEqual(none);
    expect(parseResultsParams({ lesson: "1.5", page: "2.5" })).toEqual(none);
    expect(parseResultsParams({ lesson: ["7", "8"] }).lessonId).toBe(7);
  });

  it("swaps a reversed date range", () => {
    expect(
      parseResultsParams({ from: "2026-10-05", to: "2026-10-01" }),
    ).toMatchObject({ from: "2026-10-01", to: "2026-10-05" });
  });
});

describe("isCalendarDay", () => {
  it("accepts real days only", () => {
    expect(isCalendarDay("2028-02-29")).toBe(true);
    expect(isCalendarDay("2026-02-29")).toBe(false);
    expect(isCalendarDay("2026-13-01")).toBe(false);
    expect(isCalendarDay("1999-12-31")).toBe(false);
    expect(isCalendarDay("2026-1-01")).toBe(false);
  });
});

describe("resultsHref / exportHref", () => {
  const f: ResultsFilters = {
    lessonId: 4,
    q: "Bình An",
    from: "2026-09-01",
    to: null,
    page: 2,
  };

  it("leaves defaults out", () => {
    expect(resultsHref(none)).toBe("/admin/results");
    expect(exportHref(none)).toBe("/admin/results/export");
  });

  it("keeps the filters; the export has no page", () => {
    expect(resultsHref(f)).toBe(
      "/admin/results?lesson=4&q=B%C3%ACnh+An&from=2026-09-01&page=2",
    );
    expect(exportHref(f)).toBe(
      "/admin/results/export?lesson=4&q=B%C3%ACnh+An&from=2026-09-01",
    );
  });

  it("goes back to the first page when a filter changes", () => {
    expect(resultsHref(f, { page: 3 })).toContain("page=3");
    expect(resultsHref(f, { lessonId: null })).toBe(
      "/admin/results?q=B%C3%ACnh+An&from=2026-09-01",
    );
  });

  it("knows when something is filtered", () => {
    expect(hasFilters(none)).toBe(false);
    expect(hasFilters({ ...none, page: 3 })).toBe(false);
    expect(hasFilters({ ...none, to: "2026-01-01" })).toBe(true);
  });
});

describe("submittedRange", () => {
  it("turns Vietnam days into instants, the end day included", () => {
    expect(vnDayStart("2026-10-01").toISOString()).toBe(
      "2026-09-30T17:00:00.000Z",
    );
    expect(submittedRange({ from: "2026-10-01", to: "2026-10-01" })).toEqual({
      since: new Date("2026-09-30T17:00:00Z"),
      before: new Date("2026-10-01T17:00:00Z"),
    });
    expect(submittedRange({ from: null, to: null })).toEqual({
      since: null,
      before: null,
    });
  });
});

describe("nameTerms", () => {
  it("splits words, escapes LIKE and keeps at most 5", () => {
    expect(nameTerms(null)).toEqual([]);
    expect(nameTerms("an 50% a_b c\\d")).toEqual([
      "an",
      "50\\%",
      "a\\_b",
      "c\\\\d",
    ]);
    expect(nameTerms("a b c d e f g")).toHaveLength(5);
  });
});
