import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  type AttemptAnswer,
  attempts,
  auditLog,
  lessons,
  lessonVersions,
  mistakes,
  ratingEvents,
  ratings,
  users,
} from "@/db/schema";
import {
  DEFAULT_LESSON_CONFIG,
  type LessonConfig,
  type Question,
} from "@/features/lessons/schema";
import { enrol, shareLesson } from "@/test/classes";
import { resetDb, type TestDb } from "@/test/db";
import {
  getResultLessons,
  getResults,
  getResultsForExport,
} from "./admin-queries";
import { deleteAttempt } from "./admin-service";
import type { GuardKind } from "./domain/guard";
import { parseResultsParams } from "./domain/results";
import { startAttempt, submitAttempt } from "./service";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
// `"use cache"` is a no-op outside Next; stub the tag helpers.
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
const T0 = new Date("2026-10-20T02:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

const questions: Question[] = [
  {
    id: "q_mcq",
    type: "mcq",
    stem: "Đơn vị của chu kì?",
    options: [{ text: "s" }, { text: "m" }],
    answer: 0,
    points: 0.25,
  },
  {
    id: "q_tf",
    type: "tf",
    stem: "Con lắc lò xo",
    statements: [
      { text: "a", answer: true },
      { text: "b", answer: false },
      { text: "c", answer: true },
      { text: "d", answer: false },
    ],
  },
  { id: "q_short", type: "short", stem: "T = ?", answer: "0.63", points: 0.5 },
];

/** Performance 1, 0 and 0.5 / 1.75. */
const PERFECT: AttemptAnswer[] = ["A", [true, false, true, false], "0.63"];
const POOR: AttemptAnswer[] = ["B", [false, true, false, true], "1"];
const PARTIAL: AttemptAnswer[] = ["A", [true, false, null, null], null];

let admin: { id: string; role: "admin" };
let phoneSeq = 0;

async function addUser(
  role: "student" | "admin" = "student",
  values: Partial<typeof users.$inferInsert> = {},
) {
  const [u] = await tdb
    .insert(users)
    .values({
      role,
      status: "active",
      fullName: role === "admin" ? "Quản Trị" : "Học Sinh",
      phone: `09${String(++phoneSeq).padStart(8, "0")}`,
      passwordHash: "x",
      ...values,
    })
    .returning({ id: users.id });
  return u?.id ?? "";
}

async function addLesson(
  config: Partial<LessonConfig> = {},
  title = "Dao động",
) {
  const [lesson] = await tdb
    .insert(lessons)
    .values({
      title,
      status: "published",
      config: { ...DEFAULT_LESSON_CONFIG, ...config },
      ownerId: admin.id,
    })
    .returning({ id: lessons.id });
  const id = lesson?.id ?? 0;
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

/** Start at `minute`, submit one minute later; returns the attempt id. */
async function take(
  userId: string,
  lessonId: number,
  answers: AttemptAnswer[] | null,
  minute: number,
  guardEvents: { t: number; k: GuardKind }[] = [],
) {
  // B-03: through the admin's class (the admin's own try too, as a member).
  await shareLesson(tdb, lessonId, admin.id);
  await enrol(tdb, userId);
  const started = await startAttempt(
    { id: userId, role: "student" },
    lessonId,
    {
      ip: null,
      now: at(minute),
      seed: 1,
    },
  );
  if (!started.ok) throw new Error(started.code);
  const id = started.data.attemptId;
  if (answers) {
    const submitted = await submitAttempt(
      userId,
      id,
      { answers, flagged: [], guardEvents, clientSubmitId: randomUUID() },
      at(minute + 1),
    );
    if (!submitted.ok) throw new Error(submitted.code);
  }
  return id;
}

const ratingOf = async (userId: string) =>
  (
    await tdb
      .select({
        rating: ratings.rating,
        peak: ratings.peak,
        rated: ratings.ratedAttempts,
      })
      .from(ratings)
      .where(eq(ratings.userId, userId))
  )[0] ?? null;

const eventsOf = (userId: string) =>
  tdb
    .select({
      before: ratingEvents.before,
      delta: ratingEvents.delta,
      after: ratingEvents.after,
      performance: ratingEvents.performance,
      timeBonus: ratingEvents.timeBonus,
    })
    .from(ratingEvents)
    .where(eq(ratingEvents.userId, userId))
    .orderBy(asc(ratingEvents.createdAt), asc(ratingEvents.id));

const attemptCount = async (lessonId: number) =>
  (
    await tdb
      .select({ n: lessons.attemptCount })
      .from(lessons)
      .where(eq(lessons.id, lessonId))
  )[0]?.n;

beforeEach(async () => {
  await resetDb(tdb);
  admin = { id: await addUser("admin"), role: "admin" };
});

describe("deleteAttempt: replay equals a fresh computation", () => {
  it("deleting the middle of three rated attempts", async () => {
    const lessonId = await addLesson();
    const student = await addUser();
    const twin = await addUser();
    await take(student, lessonId, PERFECT, 0);
    const middle = await take(student, lessonId, POOR, 10);
    await take(student, lessonId, PARTIAL, 20);
    // The same tests without the middle one, computed from scratch.
    await take(twin, lessonId, PERFECT, 0);
    await take(twin, lessonId, PARTIAL, 20);
    const beforeDelete = await eventsOf(student);
    expect(await attemptCount(lessonId)).toBe(5);

    const result = await deleteAttempt(admin, middle, at(30));
    expect(result).toEqual({
      ok: true,
      data: { userId: student, lessonId, status: "submitted", rated: true },
    });

    const fresh = await eventsOf(twin);
    const replayed = await eventsOf(student);
    expect(replayed).toEqual(fresh);
    expect(await ratingOf(student)).toEqual(await ratingOf(twin));
    expect(await ratingOf(student)).toMatchObject({ rated: 2 });
    // The last event really was rewritten, and the first one kept.
    expect(replayed[1]).not.toEqual(beforeDelete[2]);
    expect(replayed[0]).toEqual(beforeDelete[0]);
    expect(
      await tdb.select().from(attempts).where(eq(attempts.id, middle)),
    ).toHaveLength(0);
    expect(await attemptCount(lessonId)).toBe(4);
  });

  it("deleting the first rated attempt rewrites every later one", async () => {
    const lessonId = await addLesson();
    const student = await addUser();
    const twin = await addUser();
    const first = await take(student, lessonId, PERFECT, 0);
    await take(student, lessonId, POOR, 10);
    await take(student, lessonId, PARTIAL, 20);
    await take(twin, lessonId, POOR, 10);
    await take(twin, lessonId, PARTIAL, 20);

    await deleteAttempt(admin, first, at(30));
    expect(await eventsOf(student)).toEqual(await eventsOf(twin));
    expect(await ratingOf(student)).toEqual(await ratingOf(twin));
  });

  it("deleting the last rated attempt removes the rating", async () => {
    const lessonId = await addLesson();
    const student = await addUser();
    const only = await take(student, lessonId, PERFECT, 0);
    expect(await ratingOf(student)).not.toBeNull();

    const result = await deleteAttempt(admin, only, at(30));
    expect(result).toMatchObject({ ok: true, data: { rated: true } });
    expect(await ratingOf(student)).toBeNull();
    expect(await eventsOf(student)).toEqual([]);
    expect(await attemptCount(lessonId)).toBe(0);
  });
});

describe("deleteAttempt: attempts without a rating event", () => {
  it("an in-progress attempt: rating and count untouched", async () => {
    const lessonId = await addLesson();
    const student = await addUser();
    await take(student, lessonId, PERFECT, 0);
    const rating = await ratingOf(student);
    const events = await eventsOf(student);
    const open = await take(student, lessonId, null, 10);

    const result = await deleteAttempt(admin, open, at(30));
    expect(result).toEqual({
      ok: true,
      data: { userId: student, lessonId, status: "in_progress", rated: false },
    });
    expect(await ratingOf(student)).toEqual(rating);
    expect(await eventsOf(student)).toEqual(events);
    expect(await attemptCount(lessonId)).toBe(1);
    // The student can start that lesson again.
    expect((await take(student, lessonId, PARTIAL, 40)).length).toBe(36);
  });

  it("a submitted attempt that did not count for rating", async () => {
    const rated = await addLesson();
    const practice = await addLesson({ countsForRating: false }, "Luyện tập");
    const student = await addUser();
    await take(student, rated, PARTIAL, 0);
    const rating = await ratingOf(student);
    const unrated = await take(student, practice, POOR, 10);

    const result = await deleteAttempt(admin, unrated, at(30));
    expect(result).toMatchObject({
      ok: true,
      data: { status: "submitted", rated: false, lessonId: practice },
    });
    expect(await ratingOf(student)).toEqual(rating);
    expect(await attemptCount(practice)).toBe(0);
    expect(await attemptCount(rated)).toBe(1);
  });

  it("never takes attempt_count below 0", async () => {
    const lessonId = await addLesson();
    const student = await addUser();
    const id = await take(student, lessonId, PERFECT, 0);
    await tdb.update(lessons).set({ attemptCount: 0 });
    await deleteAttempt(admin, id, at(30));
    expect(await attemptCount(lessonId)).toBe(0);
  });
});

describe("deleteAttempt: bookkeeping", () => {
  it("audits ids only and leaves the mistakes bank as it is", async () => {
    const lessonId = await addLesson();
    const student = await addUser("student", { fullName: "Nguyễn Bí Mật" });
    const id = await take(student, lessonId, POOR, 0);
    const bank = await tdb
      .select()
      .from(mistakes)
      .where(eq(mistakes.userId, student));
    expect(bank.length).toBeGreaterThan(0);

    await deleteAttempt(admin, id, at(30));
    const [audit] = await tdb.select().from(auditLog);
    expect(audit).toMatchObject({
      actorId: admin.id,
      action: "attempt.delete",
      targetType: "attempt",
      targetId: id,
      data: { userId: student, lessonId, status: "submitted", rated: true },
    });
    expect(JSON.stringify(audit)).not.toContain("Bí Mật");
    const after = await tdb
      .select()
      .from(mistakes)
      .where(eq(mistakes.userId, student));
    expect(after).toEqual(bank.map((m) => ({ ...m, lastAttemptId: null })));
  });

  it("returns NOT_FOUND for an unknown attempt and writes nothing", async () => {
    expect(await deleteAttempt(admin, randomUUID())).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(await tdb.select().from(auditLog)).toHaveLength(0);
  });
});

describe("results queries", () => {
  async function seedResults() {
    const dao = await addLesson({}, "Dao động");
    const song = await addLesson({}, "Sóng cơ");
    const an = await addUser("student", {
      fullName: "Nguyễn Văn An",
      className: "12A1",
      grade: 12,
    });
    const binh = await addUser("student", { fullName: "Trần Thị Bình" });
    const teacher = await addUser("admin", { fullName: "An Giáo Viên" });
    // 2026-10-20 09:01 in Vietnam, then 10 and 20 minutes later.
    const a1 = await take(an, dao, PERFECT, 0, [
      { t: 3, k: "blur" },
      { t: 9, k: "copy" },
    ]);
    const a2 = await take(binh, song, POOR, 10);
    const a3 = await take(an, song, PARTIAL, 20);
    await take(binh, dao, null, 30);
    await take(teacher, dao, PERFECT, 40);
    return { dao, song, an, binh, a1, a2, a3 };
  }
  const f = (params: Record<string, string>) => parseResultsParams(params);

  it("lists students' submitted attempts, newest first, with details", async () => {
    const s = await seedResults();
    const { rows, hasMore } = await getResults(admin, f({}));
    expect(rows.map((r) => r.id)).toEqual([s.a3, s.a2, s.a1]);
    expect(hasMore).toBe(false);
    expect(rows[2]).toEqual({
      id: s.a1,
      userId: s.an,
      fullName: "Nguyễn Văn An",
      className: "12A1",
      grade: 12,
      lessonId: s.dao,
      lessonTitle: "Dao động",
      score10: 10,
      timeTakenSec: 60,
      submittedAt: at(1),
      guardCount: 2,
    });
  });

  it("filters by lesson, accent-free name words and Vietnam days", async () => {
    const s = await seedResults();
    const ids = async (params: Record<string, string>) =>
      (await getResults(admin, f(params))).rows.map((r) => r.id);
    expect(await ids({ lesson: String(s.song) })).toEqual([s.a3, s.a2]);
    expect(await ids({ q: "an nguyen" })).toEqual([s.a3, s.a1]);
    expect(await ids({ q: "BINH" })).toEqual([s.a2]);
    expect(await ids({ q: "an", lesson: String(s.dao) })).toEqual([s.a1]);
    expect(await ids({ q: "100%" })).toEqual([]);
    expect(await ids({ from: "2026-10-20", to: "2026-10-20" })).toHaveLength(3);
    expect(await ids({ to: "2026-10-19" })).toEqual([]);
    expect(await ids({ from: "2026-10-21" })).toEqual([]);
  });

  it("pages cumulatively by 50 and says when there is more", async () => {
    const lessonId = await addLesson();
    const student = await addUser();
    const rows = Array.from({ length: 51 }, (_, i) => ({
      userId: student,
      lessonId,
      status: "submitted" as const,
      items: [],
      answers: [],
      maxScore: 1,
      score10: 5,
      submittedAt: at(i),
    }));
    await tdb.insert(attempts).values(rows);
    const page1 = await getResults(admin, f({}));
    expect(page1.rows).toHaveLength(50);
    expect(page1.hasMore).toBe(true);
    expect(page1.rows[0]?.submittedAt).toEqual(at(50));
    const page2 = await getResults(admin, f({ page: "2" }));
    expect(page2.rows).toHaveLength(51);
    expect(page2.hasMore).toBe(false);
  });

  it("exports the same rows with scores, never the phone or birth date", async () => {
    const s = await seedResults();
    const { rows, truncated } = await getResultsForExport(
      admin,
      f({ lesson: String(s.dao) }),
    );
    expect(truncated).toBe(false);
    expect(rows).toEqual([
      {
        fullName: "Nguyễn Văn An",
        className: "12A1",
        grade: 12,
        lessonTitle: "Dao động",
        score10: 10,
        score: 1.75,
        maxScore: 1.75,
        timeTakenSec: 60,
        submittedAt: at(1),
        guardCount: 2,
      },
    ]);
  });

  it("lists every lesson for the filter, deleted ones marked", async () => {
    const s = await seedResults();
    await tdb
      .update(lessons)
      .set({ deletedAt: T0 })
      .where(eq(lessons.id, s.song));
    expect(await getResultLessons(admin)).toEqual([
      { id: s.dao, title: "Dao động", deleted: false },
      { id: s.song, title: "Sóng cơ", deleted: true },
    ]);
  });
});

describe("another teacher's results (B-03)", () => {
  it("are neither listed nor deletable", async () => {
    const lessonId = await addLesson();
    const id = await take(await addUser(), lessonId, PERFECT, 0);
    const other = {
      id: await addUser("admin", { fullName: "Thầy khác" }),
      role: "teacher" as const,
    };
    const f = parseResultsParams({});
    expect((await getResults(other, f)).rows).toEqual([]);
    expect((await getResultsForExport(other, f)).rows).toEqual([]);
    expect(await getResultLessons(other)).toEqual([]);
    expect(await deleteAttempt(other, id, at(30))).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect((await getResults(admin, f)).rows.map((r) => r.id)).toEqual([id]);
  });
});
