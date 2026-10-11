import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { attempts, lessons, lessonVersions, users } from "@/db/schema";
import { resetDb, type TestDb } from "@/test/db";
import {
  STATS_LESSON,
  statsAttempts,
  statsQuestionsV1,
  statsQuestionsV2,
  statsStudents,
} from "../../../tests/e2e/fixtures/stats";
import { DEFAULT_LESSON_CONFIG } from "./schema";
import {
  getLessonStats,
  getStatsLesson,
  getStatsVersions,
} from "./stats-queries";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
// `"use cache"` is a no-op outside Next; stub the tag helpers.
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
const hour = 60 * 60 * 1000;
let lessonId = 0;
let v1 = 0;
let v2 = 0;
const owner = { id: "", role: "teacher" as const };

beforeAll(async () => {
  await resetDb(tdb);
  const [teacher] = await tdb
    .insert(users)
    .values({
      role: "teacher",
      status: "active",
      fullName: "Cô giáo",
      username: "teacher",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  owner.id = teacher?.id ?? "";
  const [lesson] = await tdb
    .insert(lessons)
    .values({
      title: STATS_LESSON.title,
      status: "published",
      config: DEFAULT_LESSON_CONFIG,
      ownerId: owner.id,
    })
    .returning({ id: lessons.id });
  lessonId = lesson?.id ?? 0;
  const versions = await tdb
    .insert(lessonVersions)
    .values([
      { lessonId, version: 1, sourceText: "", questions: statsQuestionsV1 },
      { lessonId, version: 2, sourceText: "", questions: statsQuestionsV2 },
    ])
    .returning({ id: lessonVersions.id });
  v1 = versions[0]?.id ?? 0;
  v2 = versions[1]?.id ?? 0;
  await tdb
    .update(lessons)
    .set({ currentVersionId: v2 })
    .where(eq(lessons.id, lessonId));
  const students = await tdb
    .insert(users)
    .values(
      statsStudents.map((s) => ({
        role: "student" as const,
        status: "active" as const,
        fullName: s.fullName,
        phone: s.phone,
        passwordHash: "x",
      })),
    )
    .returning({ id: users.id });
  const [admin] = await tdb
    .insert(users)
    .values({
      role: "admin",
      status: "active",
      fullName: "Quản Trị",
      username: "qt",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  const now = Date.now();
  const row = (a: (typeof statsAttempts)[number], userId: string) => ({
    userId,
    lessonId,
    lessonVersionId: a.version === 1 ? v1 : v2,
    status: "submitted" as const,
    items: a.items,
    answers: a.answers,
    earned: a.earned,
    score: a.earned.reduce((s, x) => s + x, 0),
    maxScore: a.items.length,
    score10: a.score10,
    submittedAt: new Date(now - a.hoursAgo * hour),
  });
  await tdb
    .insert(attempts)
    .values(statsAttempts.map((a) => row(a, students[a.student]?.id ?? "")));
  const perfect = statsAttempts[0];
  if (!perfect || !admin) throw new Error("fixture");
  // Neither an admin's try nor an unfinished attempt counts.
  await tdb.insert(attempts).values([
    row(perfect, admin.id),
    {
      ...row(perfect, students[1]?.id ?? ""),
      status: "in_progress",
      submittedAt: null,
    },
  ]);
});

describe("lesson stats queries", () => {
  it("reads the header with the current version", async () => {
    expect(await getStatsLesson(owner, lessonId)).toMatchObject({
      id: lessonId,
      title: STATS_LESSON.title,
      tfScoring: "thpt2025",
      current: { id: v2, version: 2 },
    });
    expect(await getStatsLesson(owner, lessonId + 999)).toBeNull();
    // Another teacher's lesson is not theirs to read (B-03).
    expect(
      await getStatsLesson(
        { id: "00000000-0000-4000-8000-000000000009", role: "teacher" },
        lessonId,
      ),
    ).toBeNull();
  });

  it("lists versions with students' submitted attempts, newest first", async () => {
    const list = await getStatsVersions(lessonId);
    expect(list.map((v) => [v.id, v.version, v.attempts])).toEqual([
      [v2, 2, 5],
      [v1, 1, 1],
    ]);
  });

  it("matches the hand-computed fixture", async () => {
    const data = await getLessonStats(lessonId, v2, "thpt2025");
    expect(data?.capped).toBe(false);
    expect(data?.stats).toMatchObject({
      attempts: 5,
      students: 5,
      average: 4.56,
      median: 3.33,
      distribution: [2, 0, 0, 1, 0, 0, 0, 0, 1, 1],
    });
    expect(data?.stats.questions.map((q) => q.fullMarksRate)).toEqual([
      0.4, 0.2, 0.6,
    ]);
    expect(data?.questions.map((q) => q.id)).toEqual([
      "q_st_mcq",
      "q_st_tf",
      "q_st_short",
    ]);
    const old = await getLessonStats(lessonId, v1, "thpt2025");
    expect(old?.stats.attempts).toBe(1);
    expect(await getLessonStats(lessonId, v2 + 999, "thpt2025")).toBeNull();
  });
});
