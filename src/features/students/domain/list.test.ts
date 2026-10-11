import { describe, expect, it } from "vitest";
import {
  MAX_PAGE,
  parseSearch,
  parseStudentListParams,
  type StudentListFilters,
  studentsHref,
} from "./list";

const defaults: StudentListFilters = {
  q: null,
  status: null,
  grade: null,
  page: 1,
};

describe("parseStudentListParams", () => {
  it("defaults to every student with no filter", () => {
    expect(parseStudentListParams({})).toEqual(defaults);
  });

  it("reads every filter, normalizing the search text", () => {
    expect(
      parseStudentListParams({
        q: "  Nguyễn   An ",
        status: "active",
        grade: "11",
        page: "3",
      }),
    ).toEqual({
      q: "Nguyễn An",
      status: "active",
      grade: 11,
      page: 3,
    });
  });

  it("takes the first of repeated params", () => {
    expect(
      parseStudentListParams({ status: ["active", "disabled"] }).status,
    ).toBe("active");
  });

  it("falls back to defaults for anything invalid", () => {
    expect(
      parseStudentListParams({
        status: "banned",
        grade: "9",
        page: "0",
        q: "x".repeat(200),
      }),
    ).toEqual(defaults);
    expect(parseStudentListParams({ page: String(MAX_PAGE + 1) }).page).toBe(1);
    expect(parseStudentListParams({ page: "abc" }).page).toBe(1);
  });
});

describe("studentsHref", () => {
  it("leaves defaults out", () => {
    expect(studentsHref(defaults)).toBe("/admin/students");
  });

  it("keeps every filter", () => {
    expect(
      studentsHref({
        ...defaults,
        q: "an",
        status: "active",
        grade: 12,
        page: 2,
      }),
    ).toBe("/admin/students?q=an&status=active&grade=12&page=2");
  });

  it("starts from page 1 when a filter changes, unless a page is given", () => {
    const f = { ...defaults, q: "an", page: 4 };
    expect(studentsHref(f, { status: "disabled" })).toBe(
      "/admin/students?q=an&status=disabled",
    );
    expect(studentsHref(f, { page: 5 })).toBe("/admin/students?q=an&page=5");
  });
});

describe("parseSearch", () => {
  it("has nothing to search for without text", () => {
    expect(parseSearch(null)).toBeNull();
    expect(parseSearch("")).toBeNull();
  });

  it("reads digits as a phone prefix in any format", () => {
    expect(parseSearch("0912 345")).toEqual({
      kind: "phone",
      prefix: "0912345",
    });
    expect(parseSearch("+84 912 345")).toEqual({
      kind: "phone",
      prefix: "0912345",
    });
    expect(parseSearch("84912345")).toEqual({
      kind: "phone",
      prefix: "0912345",
    });
    expect(parseSearch("0912.345.678")).toEqual({
      kind: "phone",
      prefix: "0912345678",
    });
  });

  it("treats a too-short number as name text", () => {
    expect(parseSearch("12")).toEqual({ kind: "name", terms: ["12"] });
  });

  it("splits names into at most 5 escaped words", () => {
    expect(parseSearch("nguyen van an")).toEqual({
      kind: "name",
      terms: ["nguyen", "van", "an"],
    });
    expect(parseSearch("100% a_b")).toEqual({
      kind: "name",
      terms: ["100\\%", "a\\_b"],
    });
    const many = parseSearch("a b c d e f g");
    expect(many?.kind === "name" && many.terms).toHaveLength(5);
  });

  it("returns null when only whitespace is left", () => {
    expect(parseSearch(" ")).toBeNull();
  });
});
