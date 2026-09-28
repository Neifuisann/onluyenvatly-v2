import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  attempts,
  lessons,
  lessonVersions,
  ratingEvents,
  ratings,
  users,
} from "@/db/schema";
import type { TestDb } from "@/test/db";
import { HISTORY_PAGE_SIZE } from "./domain/profile";
import {
  getAccuracy,
  getMyHistory,
  getProfileSummary,
  getRatingHistory,
} from "./queries";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());

const tdb = db as unknown as TestDb;
let me = "";
let fresh = "";

async function student(phone: string) {
  const [u] = await tdb
    .insert(users)
    .values({
      status: "active",
      fullName: "HS",
      phone,
      className: "12A1",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  if (!u) throw new Error("seed");
  return u.id;
}

async function lessonWith(chapter: string, questions: object[][]) {
  const [l] = await tdb
    .insert(lessons)
    .values({
      title: `Bài ${chapter}`,
      chapter,
      status: "published",
      config: {},
    })
    .returning({ id: lessons.id });
  if (!l) throw new Error("seed");
  const versionIds: number[] = [];
  for (const [i, qs] of questions.entries()) {
    const [v] = await tdb
      .insert(lessonVersions)
      .values({ lessonId: l.id, version: i + 1, sourceText: "", questions: qs })
      .returning({ id: lessonVersions.id });
    if (!v) throw new Error("seed");
    versionIds.push(v.id);
  }
  return { lessonId: l.id, versionIds };
}

const q = (id: string, type: string) => ({ id, type, answer: "SECRET" });

beforeAll(async () => {
  me = await student("0900000001");
  fresh = await student("0900000002");
  const waves = await lessonWith("Sóng cơ", [
    [q("a", "mcq"), q("b", "tf")],
    // v2 renamed b's type: an item pinned to v1 keeps v1's type.
    [q("a", "mcq"), q("b", "short")],
  ]);
  const osc = await lessonWith("Dao động cơ", [[q("x", "short")]]);
  const [w1, w2] = waves.versionIds as [number, number];
  const [o1] = osc.versionIds as [number];

  const [first, second] = await tdb
    .insert(attempts)
    .values([
      {
        userId: me,
        lessonId: waves.lessonId,
        lessonVersionId: w2,
        status: "submitted",
        items: [
          { q: "a", p: 1 },
          { q: "b", v: w1, p: 1 },
        ],
        answers: ["A", [true]],
        earned: [1, 0.5],
        maxScore: 2,
        score: 1.5,
        score10: 7.5,
        startedAt: new Date("2026-09-30T00:00:00Z"),
        submittedAt: new Date("2026-09-30T01:00:00Z"),
        timeTakenSec: 600,
      },
      {
        userId: me,
        lessonId: osc.lessonId,
        lessonVersionId: o1,
        status: "submitted",
        items: [{ q: "x", p: 2 }],
        answers: ["3"],
        earned: [0],
        maxScore: 2,
        score: 0,
        score10: 0,
        // 23:30 in Vietnam on 1 Oct.
        submittedAt: new Date("2026-10-01T16:30:00Z"),
      },
      // In progress: not in history, accuracy or averages.
      {
        userId: me,
        lessonId: osc.lessonId,
        lessonVersionId: o1,
        items: [{ q: "x", p: 2 }],
        answers: [null],
        maxScore: 2,
      },
    ])
    .returning({ id: attempts.id });
  if (!first || !second) throw new Error("seed");

  await tdb.insert(ratings).values({ userId: me, rating: 1520, peak: 1540 });
  await tdb.insert(ratingEvents).values([
    {
      userId: me,
      attemptId: first.id,
      before: 1500,
      delta: 40,
      after: 1540,
      formula: "v2",
      createdAt: new Date("2026-09-30T01:00:00Z"),
    },
    {
      userId: me,
      attemptId: second.id,
      before: 1540,
      delta: -20,
      after: 1520,
      formula: "v2",
      createdAt: new Date("2026-10-01T16:30:00Z"),
    },
  ]);
});

describe("getProfileSummary", () => {
  it("reads rating, peak, test count, average and active days", async () => {
    expect(await getProfileSummary(me)).toEqual({
      className: "12A1",
      rating: 1520,
      peak: 1540,
      tests: 2,
      average: 3.75,
      activeDays: ["2026-10-01", "2026-09-30"],
    });
  });

  it("is empty for a new student", async () => {
    expect(await getProfileSummary(fresh)).toEqual({
      className: "12A1",
      rating: null,
      peak: null,
      tests: 0,
      average: null,
      activeDays: [],
    });
  });
});

describe("getRatingHistory", () => {
  it("lists ratings oldest first", async () => {
    expect(await getRatingHistory(me)).toEqual([
      { at: new Date("2026-09-30T01:00:00Z"), rating: 1540 },
      { at: new Date("2026-10-01T16:30:00Z"), rating: 1520 },
    ]);
  });
});

describe("getAccuracy", () => {
  it("groups marks by the question's type in its own version, and chapter", async () => {
    const rows = await getAccuracy(me);
    const sorted = [...rows].sort((a, b) =>
      `${a.type}${a.chapter}`.localeCompare(`${b.type}${b.chapter}`),
    );
    expect(sorted).toEqual([
      { type: "mcq", chapter: "Sóng cơ", questions: 1, earned: 1, points: 1 },
      {
        type: "short",
        chapter: "Dao động cơ",
        questions: 1,
        earned: 0,
        points: 2,
      },
      { type: "tf", chapter: "Sóng cơ", questions: 1, earned: 0.5, points: 1 },
    ]);
    expect(JSON.stringify(rows)).not.toContain("SECRET");
  });

  it("is empty without submitted tests", async () => {
    expect(await getAccuracy(fresh)).toEqual([]);
  });
});

describe("getMyHistory", () => {
  it("lists submitted tests newest first with their rating change", async () => {
    const { items, hasMore } = await getMyHistory(me, 1);
    expect(hasMore).toBe(false);
    expect(items.map((i) => [i.lessonTitle, i.score10, i.delta])).toEqual([
      ["Bài Dao động cơ", 0, -20],
      ["Bài Sóng cơ", 7.5, 40],
    ]);
  });

  it("pages by HISTORY_PAGE_SIZE", async () => {
    const [l] = await tdb
      .insert(lessons)
      .values({ title: "Nhiều", status: "published", config: {} })
      .returning({ id: lessons.id });
    const base = {
      userId: fresh,
      lessonId: l?.id,
      status: "submitted" as const,
      items: [{ q: "z", p: 1 }],
      answers: [null],
      earned: [0],
      maxScore: 1,
      score10: 0,
    };
    await tdb.insert(attempts).values(
      Array.from({ length: HISTORY_PAGE_SIZE + 1 }, (_, i) => ({
        ...base,
        submittedAt: new Date(Date.UTC(2026, 8, 1, 0, i)),
      })),
    );
    const one = await getMyHistory(fresh, 1);
    expect(one.items).toHaveLength(HISTORY_PAGE_SIZE);
    expect(one.hasMore).toBe(true);
    const two = await getMyHistory(fresh, 2);
    expect(two.items).toHaveLength(HISTORY_PAGE_SIZE + 1);
    expect(two.hasMore).toBe(false);
  });
});
