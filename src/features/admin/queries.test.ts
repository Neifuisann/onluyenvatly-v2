import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { attempts, lessons, lessonVersions, users } from "@/db/schema";
import { DEFAULT_LESSON_CONFIG } from "@/features/lessons/schema";
import { resetDb, type TestDb } from "@/test/db";
import { loadAdminOverview } from "./queries";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
// 12:00 on 29/09 in Vietnam; the week starts 23/09 00:00 (22/09 17:00 UTC).
const NOW = new Date("2026-09-29T05:00:00Z");

let lessonId = 0;
let versionId = 0;
let ownerId = "";

beforeAll(async () => {
  await resetDb(tdb);
  const students = await tdb
    .insert(users)
    .values(
      [1, 2, 3, 4, 5, 6].map((i) => ({
        role: "student" as const,
        status: "active" as const,
        fullName: `HS ${i}`,
        phone: `090000010${i}`,
        passwordHash: "x",
      })),
    )
    .returning({ id: users.id });
  const [admin] = await tdb
    .insert(users)
    .values({
      role: "admin",
      status: "active",
      fullName: "QT",
      username: "qt",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  ownerId = admin?.id ?? "";
  const ls = await tdb
    .insert(lessons)
    .values([
      {
        title: "Dòng điện",
        status: "published",
        config: DEFAULT_LESSON_CONFIG,
        ownerId: admin?.id ?? null,
      },
      {
        title: "Từ trường",
        status: "published",
        config: DEFAULT_LESSON_CONFIG,
        ownerId: admin?.id ?? null,
      },
    ])
    .returning({ id: lessons.id });
  lessonId = ls[0]?.id ?? 0;
  const other = ls[1]?.id ?? 0;
  const vs = await tdb
    .insert(lessonVersions)
    .values([
      {
        lessonId,
        version: 1,
        sourceText: "",
        questions: [{ id: "q_1" }, { id: "q_2" }, { id: "q_3" }],
      },
      {
        lessonId: other,
        version: 1,
        sourceText: "",
        questions: [{ id: "q_9" }],
      },
    ])
    .returning({ id: lessonVersions.id });
  versionId = vs[0]?.id ?? 0;
  const s = (i: number) => students[i - 1]?.id ?? "";
  const items = [
    { q: "q_1", p: 1 },
    { q: "q_2", p: 1 },
    { q: "q_3", p: 0 },
  ];
  const onLesson = (userId: string, at: string, earned: number[]) => ({
    userId,
    lessonId,
    lessonVersionId: versionId,
    status: "submitted" as const,
    items,
    answers: [null, null, null],
    earned,
    maxScore: 2,
    submittedAt: new Date(at),
  });
  await tdb.insert(attempts).values([
    onLesson(s(1), "2026-09-28T18:00:00Z", [1, 0, 0]), // today 01:00
    onLesson(s(2), "2026-09-28T03:00:00Z", [1, 0, 0]),
    onLesson(s(3), "2026-09-27T03:00:00Z", [0, 1, 0]),
    onLesson(s(4), "2026-09-25T03:00:00Z", [0, 0, 0]),
    onLesson(s(5), "2026-09-23T03:00:00Z", [1, 0, 0]),
    // 22/09 23:59 in Vietnam: in the chart, not in the week.
    onLesson(s(1), "2026-09-22T16:59:00Z", [0, 0, 0]),
    // Outside the 30 days.
    onLesson(s(6), "2026-08-20T03:00:00Z", [0, 0, 0]),
    // An admin's try and an unfinished attempt never count.
    onLesson(admin?.id ?? "", "2026-09-29T02:00:00Z", [0, 0, 0]),
    {
      ...onLesson(s(4), "2026-09-29T02:00:00Z", [0, 0, 0]),
      status: "in_progress" as const,
      submittedAt: null,
      earned: null,
    },
    // Personalized practice: the student's own, not on a teacher's lesson
    // (B-03), so it counts nowhere.
    {
      userId: s(2),
      lessonId: null,
      lessonVersionId: versionId,
      mode: "review" as const,
      status: "submitted" as const,
      items: [{ q: "q_2", p: 1 }],
      answers: [null],
      earned: [0],
      maxScore: 1,
      submittedAt: new Date("2026-09-28T04:00:00Z"),
    },
    // Another lesson's question with a single answer: not ranked.
    {
      userId: s(3),
      lessonId: other,
      lessonVersionId: vs[1]?.id ?? 0,
      status: "submitted" as const,
      items: [{ q: "q_9", p: 1 }],
      answers: [null],
      earned: [0],
      maxScore: 1,
      submittedAt: new Date("2026-09-28T05:00:00Z"),
    },
  ]);
});

describe("loadAdminOverview", () => {
  it("counts students' submitted attempts on the teacher's lessons in Vietnam days", async () => {
    const o = await loadAdminOverview(NOW, ownerId);
    expect(o.activeStudents).toBe(5);
    expect(o.attemptsToday).toBe(1);
    expect(o.attemptsWeek).toBe(6);
    expect(o.perDay).toHaveLength(30);
    expect(o.perDay.at(-1)).toEqual({ day: "2026-09-29", count: 1 });
    expect(o.perDay.filter((d) => d.count > 0)).toEqual([
      { day: "2026-09-22", count: 1 },
      { day: "2026-09-23", count: 1 },
      { day: "2026-09-25", count: 1 },
      { day: "2026-09-27", count: 1 },
      { day: "2026-09-28", count: 2 },
      { day: "2026-09-29", count: 1 },
    ]);
  });

  it("ranks this week's hardest questions with their position", async () => {
    const { hardest } = await loadAdminOverview(NOW, ownerId);
    expect(hardest).toEqual([
      {
        lessonId,
        lessonTitle: "Dòng điện",
        questionId: "q_2",
        versionId,
        position: 2,
        answers: 5,
        fullMarks: 1,
        fullMarksRate: 0.2,
      },
      {
        lessonId,
        lessonTitle: "Dòng điện",
        questionId: "q_1",
        versionId,
        position: 1,
        answers: 5,
        fullMarks: 3,
        fullMarksRate: 0.6,
      },
    ]);
  });

  it("is empty for another teacher (B-03)", async () => {
    const o = await loadAdminOverview(
      NOW,
      "00000000-0000-4000-8000-000000000009",
    );
    expect(o).toMatchObject({
      activeStudents: 0,
      attemptsWeek: 0,
      hardest: [],
    });
  });

  it("is empty on a quiet month", async () => {
    const o = await loadAdminOverview(
      new Date("2027-06-01T00:00:00Z"),
      ownerId,
    );
    expect(o).toMatchObject({
      activeStudents: 0,
      attemptsToday: 0,
      attemptsWeek: 0,
      hardest: [],
    });
    expect(o.perDay.every((d) => d.count === 0)).toBe(true);
  });
});
