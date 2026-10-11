import { describe, expect, it } from "vitest";
import {
  AUDIT_COUNT_CAP,
  AUDIT_MAX_PAGE,
  AUDIT_PAGE_SIZE,
  areaPrefixes,
  auditHref,
  auditPages,
  auditTargetHref,
  parseAuditParams,
  shortTargetId,
  summarizeAuditData,
} from "./audit-log";

const UUID = "0b7c6f3e-1d2a-4c5b-8e9f-001122334455";
const words = { yes: "có", no: "không" };

describe("parseAuditParams", () => {
  it("reads the area and page", () => {
    expect(parseAuditParams({ area: "lessons", page: "3" })).toEqual({
      area: "lessons",
      page: 3,
    });
    expect(parseAuditParams({ area: [" settings ", "x"] })).toEqual({
      area: "settings",
      page: 1,
    });
  });

  it("falls back to every area, page 1, on anything invalid", () => {
    expect(parseAuditParams({})).toEqual({ area: null, page: 1 });
    expect(parseAuditParams({ area: "constructor", page: "0" })).toEqual({
      area: null,
      page: 1,
    });
    expect(parseAuditParams({ page: "2.5" }).page).toBe(1);
    expect(parseAuditParams({ page: "abc" }).page).toBe(1);
    expect(parseAuditParams({ page: String(AUDIT_MAX_PAGE + 1) }).page).toBe(1);
    expect(parseAuditParams({ page: String(AUDIT_MAX_PAGE) }).page).toBe(
      AUDIT_MAX_PAGE,
    );
  });
});

describe("auditHref", () => {
  const f = { area: "students" as const, page: 4 };

  it("leaves defaults out", () => {
    expect(auditHref({ area: null, page: 1 })).toBe("/admin/audit");
    expect(auditHref(f, { page: 2 })).toBe("/admin/audit?area=students&page=2");
  });

  it("starts a new area on page 1", () => {
    expect(auditHref(f, { area: "results" })).toBe("/admin/audit?area=results");
    expect(auditHref(f, { area: null })).toBe("/admin/audit");
    expect(auditHref(f)).toBe("/admin/audit?area=students");
  });
});

describe("areaPrefixes", () => {
  it("maps an area to its action prefixes", () => {
    expect(areaPrefixes(null)).toBeNull();
    expect(areaPrefixes("results")).toEqual(["attempt"]);
    expect(areaPrefixes("settings")).toEqual(["settings", "admin", "teacher"]);
    expect(areaPrefixes("classes")).toEqual(["class"]);
  });
});

describe("auditPages", () => {
  it("pages a count", () => {
    expect(auditPages(0, 1)).toEqual({
      total: 0,
      capped: false,
      page: 1,
      pageCount: 1,
      offset: 0,
    });
    expect(auditPages(AUDIT_PAGE_SIZE * 2 + 1, 3)).toEqual({
      total: AUDIT_PAGE_SIZE * 2 + 1,
      capped: false,
      page: 3,
      pageCount: 3,
      offset: AUDIT_PAGE_SIZE * 2,
    });
  });

  it("clamps a stale page to the last one", () => {
    const p = auditPages(AUDIT_PAGE_SIZE + 1, 9);
    expect(p.page).toBe(2);
    expect(p.offset).toBe(AUDIT_PAGE_SIZE);
    expect(auditPages(10, 0).page).toBe(1);
    expect(auditPages(10, Number.NaN).page).toBe(1);
  });

  it("stops at the cap and says so", () => {
    const at = auditPages(AUDIT_COUNT_CAP, 1);
    expect(at).toMatchObject({ capped: false, pageCount: AUDIT_MAX_PAGE });
    const over = auditPages(AUDIT_COUNT_CAP + 1, AUDIT_MAX_PAGE);
    expect(over).toMatchObject({
      total: AUDIT_COUNT_CAP,
      capped: true,
      page: AUDIT_MAX_PAGE,
      pageCount: AUDIT_MAX_PAGE,
    });
    expect(auditPages(-5, 1).total).toBe(0);
  });
});

describe("auditTargetHref", () => {
  const row = (
    action: string,
    targetType: string | null,
    targetId: string | null,
  ) => ({
    action,
    targetType,
    targetId,
  });

  it("opens lessons, students, attempts, games and settings", () => {
    expect(auditTargetHref(row("class.lessons", "class", "7"))).toBe(
      "/admin/classes/7",
    );
    expect(auditTargetHref(row("class.delete", "class", "7"))).toBeNull();
    expect(auditTargetHref(row("lesson.publish", "lesson", "12"))).toBe(
      "/admin/lessons/12/edit",
    );
    expect(auditTargetHref(row("student.approve", "user", UUID))).toBe(
      `/admin/students/${UUID}`,
    );
    expect(auditTargetHref(row("account.update_profile", "user", UUID))).toBe(
      `/admin/students/${UUID}`,
    );
    expect(auditTargetHref(row("attempt.view", "attempt", UUID))).toBe(
      `/attempts/${UUID}/result`,
    );
    expect(auditTargetHref(row("settings.update", "settings", "1"))).toBe(
      "/admin/settings",
    );
    expect(auditTargetHref(row("game.create", "game", UUID))).toBe(
      `/host/${UUID}`,
    );
    expect(auditTargetHref(row("game.create", "game", "12"))).toBeNull();
  });

  it("links nothing that was deleted or has no page", () => {
    expect(auditTargetHref(row("lesson.delete", "lesson", "12"))).toBeNull();
    expect(auditTargetHref(row("student.delete", "user", UUID))).toBeNull();
    expect(auditTargetHref(row("attempt.delete", "attempt", UUID))).toBeNull();
    // An admin account has no student page.
    expect(auditTargetHref(row("admin.create", "user", UUID))).toBeNull();
    expect(
      auditTargetHref(row("explanation.approve", "explanation", "ab12")),
    ).toBeNull();
    expect(auditTargetHref(row("lesson.reorder", null, null))).toBeNull();
    expect(auditTargetHref(row("lesson.cover", "lesson", null))).toBeNull();
  });

  it("refuses ids of the wrong shape", () => {
    expect(auditTargetHref(row("lesson.publish", "lesson", "../x"))).toBeNull();
    expect(auditTargetHref(row("student.approve", "user", "12"))).toBeNull();
    expect(auditTargetHref(row("attempt.x", "attempt", "nope"))).toBeNull();
  });
});

describe("shortTargetId", () => {
  it("shortens ids for a phone row", () => {
    expect(shortTargetId(null)).toBeNull();
    expect(shortTargetId("42")).toBe("#42");
    expect(shortTargetId(UUID)).toBe("0b7c6f3e");
    expect(shortTargetId("abc")).toBe("abc");
  });
});

describe("summarizeAuditData", () => {
  it("shows ids and counts as key: value", () => {
    expect(
      summarizeAuditData(
        {
          changed: ["aiEnabled", "announcement"],
          soft: true,
          rated: false,
          attempts: 1234,
          versionId: null,
          nested: { a: 1 },
          list: [[1, 2]],
        },
        words,
      ),
    ).toEqual([
      { key: "changed", value: "aiEnabled, announcement" },
      { key: "soft", value: "có" },
      { key: "rated", value: "không" },
      { key: "attempts", value: "1234" },
      { key: "versionId", value: "–" },
      { key: "nested", value: '{"a":1}' },
    ]);
    expect(summarizeAuditData({ list: [[1, 2]] }, words)).toEqual([
      { key: "list", value: "[1,2]" },
    ]);
  });

  it("clips long values", () => {
    const [entry] = summarizeAuditData({ q: "x".repeat(100) }, words);
    expect(entry?.value).toHaveLength(60);
    expect(entry?.value.endsWith("…")).toBe(true);
  });

  it("shows nothing for anything but a plain object", () => {
    expect(summarizeAuditData(null, words)).toEqual([]);
    expect(summarizeAuditData("x", words)).toEqual([]);
    expect(summarizeAuditData([1, 2], words)).toEqual([]);
    expect(summarizeAuditData(3, words)).toEqual([]);
  });
});
