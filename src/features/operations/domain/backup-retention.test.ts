import { describe, expect, it } from "vitest";
import { backupsToPrune } from "./backup-retention";

describe("backup retention", () => {
  it("keeps 30 daily and 12 monthly copies independently", () => {
    const daily = Array.from(
      { length: 31 },
      (_, i) =>
        `ovl-v2/daily/2026-10-${String(i + 1).padStart(2, "0")}.dump.age`,
    );
    const monthly = Array.from(
      { length: 13 },
      (_, i) =>
        `ovl-v2/monthly/${i === 0 ? "2025-12" : `2026-${String(i).padStart(2, "0")}`}.dump.age`,
    );
    expect(backupsToPrune([...daily.reverse(), ...monthly.reverse()])).toEqual([
      "ovl-v2/daily/2026-10-01.dump.age",
      "ovl-v2/monthly/2025-12.dump.age",
    ]);
  });
  it("never deletes unrelated objects, malformed keys, or duplicates", () => {
    expect(
      backupsToPrune([
        "other/daily/2026-10-01.dump.age",
        "ovl-v2/daily/latest.dump.age",
        ...Array(40).fill("ovl-v2/daily/2026-10-01.dump.age"),
      ]),
    ).toEqual([]);
  });
});
