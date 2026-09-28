import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { attempts, lessons, lessonVersions, users } from "@/db/schema";
import {
  DEFAULT_LESSON_CONFIG,
  type LessonConfig,
  type Question,
} from "@/features/lessons/schema";
import { resetDb, type TestDb } from "@/test/db";
import {
  ATTEMPT_LIMITS,
  DEADLINE_GRACE_MS,
  saveProgress,
  startAttempt,
} from "./service";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
// `"use cache"` is a no-op outside Next; stub the tag helpers.
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
const NOW = new Date("2026-10-20T02:00:00Z");
const ctx = { ip: "203.0.113.9", now: NOW, seed: 1 };

const sampleQuestions: Question[] = [
  {
    id: "q_mcq1",
    type: "mcq",
    stem: "Đơn vị của chu kì?",
    options: [{ text: "s" }, { text: "m" }, { text: "Hz" }, { text: "N" }],
    answer: 0,
    points: 0.25,
  },
  {
    id: "q_tf1",
    type: "tf",
    stem: "Con lắc lò xo",
    statements: [
      { text: "a", answer: true },
      { text: "b", answer: false },
      { text: "c", answer: true },
      { text: "d", answer: false },
    ],
  },
  { id: "q_short1", type: "short", stem: "T = ?", answer: "0.63", points: 0.5 },
];

let student: { id: string; role: "student" };
let admin: { id: string; role: "admin" };

async function addUser(role: "student" | "admin", phone: string) {
  const [u] = await tdb
    .insert(users)
    .values({
      role,
      status: "active",
      fullName: role,
      phone,
      passwordHash: "x",
    })
    .returning({ id: users.id });
  return u?.id ?? "";
}

async function addLesson(
  config: Partial<LessonConfig> | Record<string, unknown> = {},
  {
    status = "published",
    questions = sampleQuestions,
    withVersion = true,
  }: {
    status?: "draft" | "published" | "archived";
    questions?: Question[];
    withVersion?: boolean;
  } = {},
) {
  const [lesson] = await tdb
    .insert(lessons)
    .values({
      title: "Bài",
      status,
      config: { ...DEFAULT_LESSON_CONFIG, ...config },
    })
    .returning({ id: lessons.id });
  const id = lesson?.id ?? 0;
  if (!withVersion) return id;
  const [version] = await tdb
    .insert(lessonVersions)
    .values({ lessonId: id, version: 1, sourceText: "", questions })
    .returning({ id: lessonVersions.id });
  await tdb
    .update(lessons)
    .set({ currentVersionId: version?.id ?? null })
    .where(eq(lessons.id, id));
  return id;
}

const rows = (lessonId: number) =>
  tdb.select().from(attempts).where(eq(attempts.lessonId, lessonId));

beforeEach(async () => {
  await resetDb(tdb);
  student = { id: await addUser("student", "0900000001"), role: "student" };
  admin = { id: await addUser("admin", "0900000002"), role: "admin" };
});

describe("startAttempt", () => {
  it("creates an in-progress attempt with items, blank answers, points and deadline", async () => {
    const lessonId = await addLesson({ timeLimitSec: 600 });
    const result = await startAttempt(student, lessonId, ctx);
    expect(result).toMatchObject({ ok: true, data: { resumed: false } });
    const [row] = await rows(lessonId);
    expect(row).toMatchObject({
      userId: student.id,
      status: "in_progress",
      mode: "test",
      items: [
        { q: "q_mcq1", p: 0.25 },
        { q: "q_tf1", p: 1 },
        { q: "q_short1", p: 0.5 },
      ],
      answers: [null, null, null],
      maxScore: 1.75,
      startedAt: NOW,
      deadlineAt: new Date(NOW.getTime() + 600_000),
      ip: "203.0.113.9",
    });
  });

  it("has no deadline without a time limit and shuffles when configured", async () => {
    const lessonId = await addLesson({
      shuffleOptions: true,
      points: { mode: "per-type-total", mcq: 3 },
    });
    await startAttempt(student, lessonId, ctx);
    const [row] = await rows(lessonId);
    expect(row?.deadlineAt).toBeNull();
    expect(row?.items[0]).toMatchObject({ q: "q_mcq1", p: 3 });
    expect(row?.items[0]?.o).toHaveLength(4);
  });

  it("resumes the attempt in progress instead of starting another", async () => {
    const lessonId = await addLesson();
    const first = await startAttempt(student, lessonId, ctx);
    const again = await startAttempt(student, lessonId, { ...ctx, seed: 2 });
    expect(again).toEqual({
      ok: true,
      data: {
        attemptId: first.ok ? first.data.attemptId : "",
        resumed: true,
      },
    });
    expect(await rows(lessonId)).toHaveLength(1);
  });

  it("converges two parallel starts on one attempt", async () => {
    const lessonId = await addLesson();
    const [a, b] = await Promise.all([
      startAttempt(student, lessonId, { ...ctx, seed: 1 }),
      startAttempt(student, lessonId, { ...ctx, seed: 2 }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.data.attemptId).toBe(b.data.attemptId);
    expect(await rows(lessonId)).toHaveLength(1);
  });

  it("enforces maxAttempts for students, not for admins", async () => {
    const lessonId = await addLesson({ maxAttempts: 1 });
    await startAttempt(student, lessonId, ctx);
    await tdb
      .update(attempts)
      .set({ status: "submitted" })
      .where(eq(attempts.lessonId, lessonId));
    expect(await startAttempt(student, lessonId, ctx)).toMatchObject({
      ok: false,
      code: "ATTEMPT_LIMIT",
    });
    expect(await startAttempt(admin, lessonId, ctx)).toMatchObject({
      ok: true,
    });
  });

  it("hides drafts from students but lets admins try them", async () => {
    const draft = await addLesson({}, { status: "draft" });
    expect(await startAttempt(student, draft, ctx)).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await startAttempt(admin, draft, ctx)).toMatchObject({ ok: true });
  });

  it("refuses missing lessons, lessons without content and empty pools", async () => {
    expect(await startAttempt(student, 999, ctx)).toMatchObject({
      code: "NOT_FOUND",
    });
    const bare = await addLesson({}, { withVersion: false });
    expect(await startAttempt(student, bare, ctx)).toMatchObject({
      code: "NOT_FOUND",
    });
    const noShort = await addLesson(
      { pool: { enabled: true, byType: { short: 2 } } },
      { questions: sampleQuestions.slice(0, 2) },
    );
    expect(await startAttempt(student, noShort, ctx)).toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("fails safely on a corrupt config", async () => {
    const lessonId = await addLesson({ timeLimitSec: "soon" });
    expect(await startAttempt(student, lessonId, ctx)).toMatchObject({
      code: "INTERNAL",
    });
    expect(await rows(lessonId)).toHaveLength(0);
  });

  it("gives each student their own pool from their seed", async () => {
    const many = Array.from(
      { length: 12 },
      (_, i): Question => ({
        id: `q_m${i}`,
        type: "mcq",
        stem: `Câu ${i}`,
        options: [{ text: "a" }, { text: "b" }],
        answer: 0,
      }),
    );
    const lessonId = await addLesson(
      { pool: { enabled: true, size: 4 } },
      { questions: many },
    );
    const other = {
      id: await addUser("student", "0900000003"),
      role: "student" as const,
    };
    await startAttempt(student, lessonId, { ...ctx, seed: 11 });
    await startAttempt(other, lessonId, { ...ctx, seed: 12 });
    const [a, b] = (await rows(lessonId)).map((r) =>
      r.items.map((i) => i.q).join(),
    );
    expect(a?.split(",")).toHaveLength(4);
    expect(a).not.toBe(b);
  });

  it(`rate-limits starts to ${ATTEMPT_LIMITS.startPerUser[0]} per minute`, async () => {
    const lessonId = await addLesson();
    const [max] = ATTEMPT_LIMITS.startPerUser;
    for (let i = 0; i < max; i++)
      expect((await startAttempt(student, lessonId, ctx)).ok).toBe(true);
    expect(await startAttempt(student, lessonId, ctx)).toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});

describe("saveProgress", () => {
  const input = {
    answers: ["B", [true, null, false, null], " 0,63"],
    flagged: [2, 1, 2, 7],
  };

  async function started(config: Partial<LessonConfig> = {}) {
    const lessonId = await addLesson(config);
    const r = await startAttempt(student, lessonId, ctx);
    if (!r.ok) throw new Error("start failed");
    return r.data.attemptId;
  }
  const row = async (id: string) =>
    (await tdb.select().from(attempts).where(eq(attempts.id, id)))[0];

  it("stores answers, cleaned flags and the save time", async () => {
    const id = await started();
    const later = new Date(NOW.getTime() + 60_000);
    expect(await saveProgress(student.id, id, input, later)).toEqual({
      ok: true,
      data: { savedAt: later.toISOString() },
    });
    expect(await row(id)).toMatchObject({
      answers: input.answers,
      flagged: [1, 2],
      lastSavedAt: later,
      status: "in_progress",
    });
  });

  it("hides other students' and unknown attempts", async () => {
    const id = await started();
    const other = await addUser("student", "0900000009");
    expect(await saveProgress(other, id, input, NOW)).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(
      await saveProgress(
        student.id,
        "00000000-0000-4000-8000-000000000000",
        input,
        NOW,
      ),
    ).toMatchObject({ code: "NOT_FOUND" });
    expect((await row(id))?.answers).toEqual([null, null, null]);
  });

  it("accepts saves until deadline + 30 s grace, then refuses", async () => {
    const id = await started({ timeLimitSec: 60 });
    const at = (ms: number) => new Date(NOW.getTime() + ms);
    expect(
      (
        await saveProgress(
          student.id,
          id,
          input,
          at(60_000 + DEADLINE_GRACE_MS),
        )
      ).ok,
    ).toBe(true);
    expect(
      await saveProgress(student.id, id, input, at(60_001 + DEADLINE_GRACE_MS)),
    ).toMatchObject({ code: "DEADLINE_PASSED" });
  });

  it("refuses closed attempts and misaligned answers", async () => {
    const id = await started();
    expect(
      await saveProgress(student.id, id, { ...input, answers: ["A"] }, NOW),
    ).toMatchObject({ code: "VALIDATION" });
    await tdb
      .update(attempts)
      .set({ status: "submitted" })
      .where(eq(attempts.id, id));
    expect(await saveProgress(student.id, id, input, NOW)).toMatchObject({
      code: "ATTEMPT_CLOSED",
    });
  });
});
