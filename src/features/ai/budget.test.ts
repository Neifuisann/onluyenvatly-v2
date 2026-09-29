import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { resetDb, type TestDb } from "@/test/db";
import { getAiUsageToday, reserveAiCall } from "./budget";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
// `"use cache"` is a no-op outside Next: every call reads the settings row.
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
// 23:30 on 1 Oct in Vietnam, then 00:30 on 2 Oct.
const LATE = new Date("2026-10-01T16:30:00Z");
const NEXT_DAY = new Date("2026-10-01T17:30:00Z");

async function setBudget(aiDailyBudget: number, aiEnabled = true) {
  await tdb.update(settings).set({ aiDailyBudget, aiEnabled });
}

beforeEach(async () => {
  await resetDb(tdb);
});

describe("reserveAiCall", () => {
  it("counts generations up to the budget, then refuses without counting", async () => {
    await setBudget(2);
    expect(await reserveAiCall(LATE)).toEqual({ ok: true });
    expect(await reserveAiCall(LATE)).toEqual({ ok: true });
    expect(await reserveAiCall(LATE)).toEqual({
      ok: false,
      code: "AI_QUOTA",
      reason: "budget",
    });
    expect(await getAiUsageToday(LATE)).toEqual({
      used: 2,
      budget: 2,
      enabled: true,
    });
  });

  it("starts a new count on the next Vietnam day", async () => {
    await setBudget(1);
    expect((await reserveAiCall(LATE)).ok).toBe(true);
    expect((await reserveAiCall(LATE)).ok).toBe(false);
    expect((await reserveAiCall(NEXT_DAY)).ok).toBe(true);
    expect((await getAiUsageToday(NEXT_DAY)).used).toBe(1);
  });

  it("refuses when AI is switched off, without counting", async () => {
    await setBudget(5, false);
    expect(await reserveAiCall(LATE)).toEqual({
      ok: false,
      code: "AI_UNAVAILABLE",
      reason: "disabled",
    });
    expect(await getAiUsageToday(LATE)).toEqual({
      used: 0,
      budget: 5,
      enabled: false,
    });
  });

  it("refuses everything with a zero budget", async () => {
    await setBudget(0);
    expect(await reserveAiCall(LATE)).toMatchObject({ code: "AI_QUOTA" });
  });

  it("never passes the budget under parallel calls", async () => {
    await setBudget(3);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => reserveAiCall(LATE)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect((await getAiUsageToday(LATE)).used).toBe(3);
  });
});
