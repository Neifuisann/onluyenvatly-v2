import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  attempts,
  lessons,
  lessonVersions,
  mistakes,
  ratingEvents,
  ratings,
  users,
} from "@/db/schema";
import type { TestDb } from "@/test/db";
import { getContinueAttempt, getDashboardStats } from "./queries";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());

const tdb = db as unknown as TestDb;
let me = "";
let other = "";
let fresh = "";
const lessonIds: number[] = [];

async function student(phone: string) {
  const [u] = await tdb
    .insert(users)
    .values({ status: "active", fullName: "HS", phone, passwordHash: "x" })
    .returning({ id: users.id });
  if (!u) throw new Error("seed");
  return u.id;
}

const item = { q: "q1", p: 1 };

beforeAll(async () => {
  me = await student("0900000001");
  other = await student("0900000002");
  fresh = await student("0900000003");
  for (const title of ["Một", "Hai", "Ba"]) {
    const [l] = await tdb
      .insert(lessons)
      .values({ title, status: "published", config: {} })
      .returning({ id: lessons.id });
    if (!l) throw new Error("seed");
    lessonIds.push(l.id);
  }
  const [l1, l2, l3] = lessonIds as [number, number, number];
  const [v] = await tdb
    .insert(lessonVersions)
    .values({ lessonId: l1, version: 1, sourceText: "", questions: [] })
    .returning({ id: lessonVersions.id });
  if (!v) throw new Error("seed");

  const base = { items: [item, item], maxScore: 2 };
  await tdb.insert(attempts).values([
    // Two submitted attempts on lesson 1 count once.
    {
      ...base,
      userId: me,
      lessonId: l1,
      status: "submitted",
      answers: ["A", "B"],
    },
    {
      ...base,
      userId: me,
      lessonId: l1,
      status: "submitted",
      answers: ["A", "B"],
    },
    {
      ...base,
      userId: me,
      lessonId: l2,
      status: "submitted",
      answers: ["A", "B"],
    },
    // Older in-progress attempt, then the one I saved last.
    {
      ...base,
      userId: me,
      lessonId: l2,
      status: "in_progress",
      answers: ["A", null],
      startedAt: new Date("2026-09-01T08:00:00Z"),
    },
    {
      ...base,
      userId: me,
      lessonId: l3,
      status: "in_progress",
      answers: [null, [true, null]],
      startedAt: new Date("2026-08-01T08:00:00Z"),
      lastSavedAt: new Date("2026-09-02T08:00:00Z"),
      deadlineAt: new Date("2026-09-02T09:00:00Z"),
    },
    // Another student's attempt never shows up.
    {
      ...base,
      userId: other,
      lessonId: l3,
      status: "submitted",
      answers: ["A", "B"],
    },
  ]);

  await tdb.insert(mistakes).values([
    { userId: me, lessonId: l1, questionId: "q1", lessonVersionId: v.id },
    { userId: me, lessonId: l1, questionId: "q2", lessonVersionId: v.id },
    {
      userId: me,
      lessonId: l1,
      questionId: "q3",
      lessonVersionId: v.id,
      status: "resolved",
    },
    { userId: other, lessonId: l1, questionId: "q1", lessonVersionId: v.id },
  ]);

  await tdb.insert(ratings).values({ userId: me, rating: 1530, peak: 1530 });
  // 9 changes: the dashboard keeps the latest 7, oldest first.
  let r = 1500;
  for (let i = 0; i < 9; i++) {
    const delta = i % 2 === 0 ? 10 : -5;
    await tdb.insert(ratingEvents).values({
      userId: me,
      before: r,
      delta,
      after: r + delta,
      formula: "v2",
      createdAt: new Date(Date.UTC(2026, 8, 1 + i)),
    });
    r += delta;
  }
});

describe("getDashboardStats", () => {
  it("reads rating, open mistakes, finished lessons and the last 7 changes", async () => {
    const stats = await getDashboardStats(me);
    expect(stats.rating).toBe(1530);
    expect(stats.openMistakes).toBe(2);
    expect(stats.doneLessonIds.sort()).toEqual(lessonIds.slice(0, 2).sort());
    expect(stats.recent).toHaveLength(7);
    expect(stats.recent[0]).toEqual({ before: 1505, after: 1515, delta: 10 });
    expect(stats.recent.at(-1)).toEqual({
      before: 1520,
      after: 1530,
      delta: 10,
    });
  });

  it("has empty stats for a new student", async () => {
    expect(await getDashboardStats(fresh)).toEqual({
      rating: null,
      openMistakes: 0,
      doneLessonIds: [],
      recent: [],
    });
  });
});

describe("getContinueAttempt", () => {
  it("returns the test I saved most recently, with its lesson title", async () => {
    const row = await getContinueAttempt(me);
    expect(row).toMatchObject({
      lessonTitle: "Ba",
      answers: [null, [true, null]],
      deadlineAt: new Date("2026-09-02T09:00:00Z"),
    });
  });

  it("is null without a test in progress", async () => {
    expect(await getContinueAttempt(other)).toBeNull();
  });
});
