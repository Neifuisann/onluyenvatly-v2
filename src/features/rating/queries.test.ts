import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { ratingEvents, ratings, users } from "@/db/schema";
import type { TestDb } from "@/test/db";
import { getLeaderboard } from "./queries";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
// `"use cache"` is a no-op outside Next; stub the tag helpers.
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

type Seed = {
  name: string;
  rating: number;
  grade?: number;
  status?: "active" | "pending" | "disabled";
  role?: "student" | "admin";
  /** [delta, days ago] */
  events?: [number, number][];
};

const seeds: Seed[] = [
  {
    name: "An",
    rating: 1800,
    grade: 12,
    events: [
      [20, 1],
      [-5, 2],
    ],
  },
  { name: "Bình", rating: 1700, grade: 11, events: [[60, 3]] },
  // Same rating as Bình: shares rank 2; "Bảo" sorts first within the tie.
  { name: "Bảo", rating: 1700, grade: 12, events: [[5, 10]] },
  { name: "Cường", rating: 1500, grade: 10 },
  { name: "Chờ Duyệt", rating: 2400, grade: 12, status: "pending" },
  { name: "Đã Khoá", rating: 2300, grade: 12, status: "disabled" },
  { name: "Giáo Viên", rating: 2200, role: "admin", events: [[90, 1]] },
];

const ids = new Map<string, string>();

beforeAll(async () => {
  for (const [i, s] of seeds.entries()) {
    const [u] = await tdb
      .insert(users)
      .values({
        role: s.role ?? "student",
        status: s.status ?? "active",
        fullName: `Học Sinh ${s.name}`,
        phone: `09000000${String(i).padStart(2, "0")}`,
        grade: s.grade ?? null,
        className: s.grade ? `${s.grade}A1` : null,
        passwordHash: "x",
      })
      .returning({ id: users.id });
    if (!u) throw new Error("seed");
    ids.set(s.name, u.id);
    await tdb
      .insert(ratings)
      .values({ userId: u.id, rating: s.rating, peak: s.rating });
    for (const [delta, ago] of s.events ?? [])
      await tdb.insert(ratingEvents).values({
        userId: u.id,
        before: s.rating - delta,
        delta,
        after: s.rating,
        formula: "v2",
        createdAt: daysAgo(ago),
      });
  }
  // A student who never did a rated test has no `ratings` row.
  await tdb.insert(users).values({
    status: "active",
    fullName: "Học Sinh Mới",
    phone: "0900000099",
    grade: 12,
    passwordHash: "x",
  });
});

const names = (rows: { fullName: string }[]) =>
  rows.map((r) => r.fullName.replace("Học Sinh ", ""));

describe("getLeaderboard", () => {
  it("ranks active students by rating, ties sharing a rank", async () => {
    const rows = await getLeaderboard({ grade: null, period: "all" });
    expect(names(rows)).toEqual(["An", "Bảo", "Bình", "Cường"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
    expect(rows[0]).toEqual({
      userId: ids.get("An"),
      fullName: "Học Sinh An",
      className: "12A1",
      rating: 1800,
      weekDelta: 15,
      rank: 1,
    });
    // Only events from the last 7 days count.
    expect(rows.find((r) => r.fullName.endsWith("Bảo"))?.weekDelta).toBe(0);
  });

  it("never exposes contact details", async () => {
    const [row] = await getLeaderboard({ grade: null, period: "all" });
    expect(Object.keys(row ?? {}).sort()).toEqual([
      "className",
      "fullName",
      "rank",
      "rating",
      "userId",
      "weekDelta",
    ]);
  });

  it("filters by grade and ranks within it", async () => {
    const rows = await getLeaderboard({ grade: 12, period: "all" });
    expect(names(rows)).toEqual(["An", "Bảo"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(await getLeaderboard({ grade: 11, period: "all" })).toHaveLength(1);
  });

  it("lists the most improved of the last 7 days", async () => {
    const rows = await getLeaderboard({ grade: null, period: "week" });
    expect(names(rows)).toEqual(["Bình", "An"]);
    expect(rows.map((r) => [r.weekDelta, r.rank])).toEqual([
      [60, 1],
      [15, 2],
    ]);
    expect(await getLeaderboard({ grade: 10, period: "week" })).toEqual([]);
  });
});
