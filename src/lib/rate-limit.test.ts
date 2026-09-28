import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { resetDb, type TestDb } from "@/test/db";
import { rateLimit, rateLimitAll, windowStart } from "./rate-limit";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());

beforeEach(async () => {
  await resetDb(db as unknown as TestDb);
});

const t0 = new Date("2026-10-12T08:03:20Z");
const plus = (sec: number) => new Date(t0.getTime() + sec * 1000);

describe("windowStart", () => {
  it("aligns to fixed UTC windows", () => {
    expect(windowStart(t0, "1m").toISOString()).toBe(
      "2026-10-12T08:03:00.000Z",
    );
    expect(windowStart(t0, "10m").toISOString()).toBe(
      "2026-10-12T08:00:00.000Z",
    );
    expect(windowStart(t0, "1h").toISOString()).toBe(
      "2026-10-12T08:00:00.000Z",
    );
    expect(windowStart(t0, "1d").toISOString()).toBe(
      "2026-10-12T00:00:00.000Z",
    );
  });
});

describe("rateLimit", () => {
  it("allows up to the limit inside one window", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit("k", 3, "1m", t0));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.count)).toEqual([1, 2, 3, 4]);
    expect(results[3]?.retryAfterSec).toBe(40);
  });

  it("resets in the next window", async () => {
    for (let i = 0; i < 3; i++) await rateLimit("k", 2, "1m", t0);
    const next = await rateLimit("k", 2, "1m", plus(60));
    expect(next).toMatchObject({ ok: true, count: 1 });
  });

  it("keeps windows of the same key apart", async () => {
    await rateLimit("k", 1, "1m", t0);
    expect((await rateLimit("k", 1, "1h", t0)).ok).toBe(true);
    expect((await rateLimit("k", 1, "1m", t0)).ok).toBe(false);
  });

  it("is atomic under parallel hits", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => rateLimit("burst", 5, "1m", t0)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(5);
  });
});

describe("rateLimitAll", () => {
  it("fails if any limit is exceeded", async () => {
    const checks = [
      ["a", 5, "1m"],
      ["b", 1, "1m"],
    ] as const;
    expect((await rateLimitAll(checks, t0)).ok).toBe(true);
    const second = await rateLimitAll(checks, t0);
    expect(second).toMatchObject({ ok: false, count: 2 });
  });
});
