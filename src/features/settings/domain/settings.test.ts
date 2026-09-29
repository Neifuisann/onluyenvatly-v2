import { describe, expect, it } from "vitest";
import {
  changedKeys,
  DEFAULT_SETTINGS,
  normalizeAnnouncement,
  SettingsPatchSchema,
} from "./settings";

describe("normalizeAnnouncement", () => {
  it("keeps plain text on one line and trims it", () => {
    expect(normalizeAnnouncement("  Thi thử\n\tthứ Bảy  ")).toBe(
      "Thi thử thứ Bảy",
    );
    const lineSeparator = String.fromCharCode(0x2028);
    expect(normalizeAnnouncement(`a\u0000b${lineSeparator}c 2028`)).toBe(
      "a b c 2028",
    );
  });

  it("turns blank text into no announcement", () => {
    expect(normalizeAnnouncement("")).toBeNull();
    expect(normalizeAnnouncement(" \n ")).toBeNull();
  });

  it("composes accents (NFC)", () => {
    const decomposed = "Thông báo".normalize("NFD");
    expect(normalizeAnnouncement(decomposed)).toBe(
      "Thông báo".normalize("NFC"),
    );
  });
});

describe("SettingsPatchSchema", () => {
  const parse = (input: unknown) => SettingsPatchSchema.safeParse(input);

  it("accepts a full form and a partial patch", () => {
    expect(
      parse({
        registrationOpen: false,
        singleSession: true,
        aiEnabled: false,
        aiDailyBudget: 5000,
        announcement: " Nghỉ học ",
      }),
    ).toMatchObject({ success: true, data: { announcement: "Nghỉ học" } });
    expect(parse({ aiDailyBudget: 0 })).toMatchObject({
      success: true,
      data: { aiDailyBudget: 0 },
    });
    expect(parse({ announcement: "   " })).toMatchObject({
      success: true,
      data: { announcement: null },
    });
    expect(parse({ announcement: null }).success).toBe(true);
  });

  it("refuses an empty patch, unknown keys and wrong types", () => {
    expect(parse({}).success).toBe(false);
    expect(parse({ deviceLimit: 1 }).success).toBe(false);
    expect(parse({ ratingFormula: "v1" }).success).toBe(false);
    expect(parse({ registrationOpen: "true" }).success).toBe(false);
    expect(parse(null).success).toBe(false);
  });

  it("bounds the AI budget to whole numbers 0–5000", () => {
    for (const bad of [-1, 5001, 1.5, Number.NaN, "10"]) {
      const r = parse({ aiDailyBudget: bad });
      expect(r.success, String(bad)).toBe(false);
      if (!r.success)
        expect(r.error.issues[0]?.path).toEqual(["aiDailyBudget"]);
    }
  });

  it("limits the announcement to 300 characters after cleaning", () => {
    expect(parse({ announcement: "a".repeat(300) }).success).toBe(true);
    expect(parse({ announcement: `${"a".repeat(300)}   ` }).success).toBe(true);
    const r = parse({ announcement: "a".repeat(301) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["announcement"]);
    expect(parse({ announcement: "a".repeat(1201) }).success).toBe(false);
  });
});

describe("changedKeys", () => {
  it("lists only the keys whose value changes, in form order", () => {
    expect(
      changedKeys(DEFAULT_SETTINGS, {
        announcement: "Mới",
        registrationOpen: true,
        singleSession: false,
      }),
    ).toEqual(["singleSession", "announcement"]);
  });

  it("is empty when nothing changes", () => {
    expect(changedKeys(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS })).toEqual([]);
    expect(
      changedKeys(
        { ...DEFAULT_SETTINGS, announcement: "Có" },
        { announcement: "Có" },
      ),
    ).toEqual([]);
  });

  it("sees clearing an announcement as a change", () => {
    expect(
      changedKeys(
        { ...DEFAULT_SETTINGS, announcement: "Có" },
        { announcement: null },
      ),
    ).toEqual(["announcement"]);
  });
});
