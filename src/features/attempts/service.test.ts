import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  attemptOverrides,
  attempts,
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
import { resetDb, type TestDb } from "@/test/db";
import { MAX_GUARD_EVENTS } from "./domain/guard";
import {
  ATTEMPT_LIMITS,
  DEADLINE_GRACE_MS,
  saveProgress,
  startAttempt,
  submitAttempt,
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
    stem: "ÄÆ¡n vá»‹ cá»§a chu kÃ¬?",
    options: [{ text: "s" }, { text: "m" }, { text: "Hz" }, { text: "N" }],
    answer: 0,
    points: 0.25,
  },
  {
    id: "q_tf1",
    type: "tf",
    stem: "Con láº¯c lÃ² xo",
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
      title: "BÃ i",
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
        stem: `CÃ¢u ${i}`,
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

  it("refuses closed attempts and misaligned answers (save)", async () => {
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

describe("submitAttempt", () => {
  // Correct: mcq "A" (s), tf all four, short "0.63" â†’ 0.25 + 1 + 0.5.
  const right = {
    answers: ["A", [true, false, true, false], "0,63"],
    flagged: [1],
    clientSubmitId: "11111111-1111-4111-8111-111111111111",
  };
  const at = (ms: number) => new Date(NOW.getTime() + ms);

  async function started(config: Partial<LessonConfig> = {}) {
    const lessonId = await addLesson(config);
    const r = await startAttempt(student, lessonId, ctx);
    if (!r.ok) throw new Error("start failed");
    return { id: r.data.attemptId, lessonId };
  }
  const row = async (id: string) =>
    (await tdb.select().from(attempts).where(eq(attempts.id, id)))[0];

  it("grades on the server and stores marks, time and the idempotency key", async () => {
    const { id, lessonId } = await started();
    const wrongTf = {
      ...right,
      answers: ["B", [true, false, true, true], "1"],
    };
    const r = await submitAttempt(student.id, id, wrongTf, at(95_000));
    expect(r).toEqual({
      ok: true,
      data: {
        attemptId: id,
        score: 0.5,
        maxScore: 1.75,
        score10: 2.86,
        alreadySubmitted: false,
        late: false,
      },
    });
    expect(await row(id)).toMatchObject({
      status: "submitted",
      answers: wrongTf.answers,
      flagged: [1],
      earned: [0, 0.5, 0],
      score: 0.5,
      score10: 2.86,
      submittedAt: at(95_000),
      timeTakenSec: 95,
      clientSubmitId: right.clientSubmitId,
    });
    const [lesson] = await tdb
      .select({ n: lessons.attemptCount })
      .from(lessons)
      .where(eq(lessons.id, lessonId));
    expect(lesson?.n).toBe(1);
  });

  it("is idempotent: retries and parallel submits give one graded result", async () => {
    const { id, lessonId } = await started();
    const other = { ...right, clientSubmitId: crypto.randomUUID() };
    const [a, b] = await Promise.all([
      submitAttempt(student.id, id, right, at(1000)),
      submitAttempt(student.id, id, other, at(1000)),
    ]);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.data.score).toBe(1.75);
    expect(b.data.score).toBe(1.75);
    expect([a.data.alreadySubmitted, b.data.alreadySubmitted].sort()).toEqual([
      false,
      true,
    ]);
    // A later retry with different answers changes nothing.
    const again = await submitAttempt(
      student.id,
      id,
      { ...right, answers: [null, null, null] },
      at(5000),
    );
    expect(again).toMatchObject({ ok: true, data: { score: 1.75 } });
    const [lesson] = await tdb
      .select({ n: lessons.attemptCount })
      .from(lessons)
      .where(eq(lessons.id, lessonId));
    expect(lesson?.n).toBe(1);
  });

  it("uses the submitted answers within the grace period", async () => {
    const { id } = await started({ timeLimitSec: 60 });
    const r = await submitAttempt(
      student.id,
      id,
      right,
      at(60_000 + DEADLINE_GRACE_MS),
    );
    expect(r).toMatchObject({ ok: true, data: { score: 1.75, late: false } });
    expect((await row(id))?.timeTakenSec).toBe(60);
  });

  it("grades a late submit with the last saved answers", async () => {
    const { id } = await started({ timeLimitSec: 60 });
    await saveProgress(
      student.id,
      id,
      { answers: ["A", null, null], flagged: [] },
      at(30_000),
    );
    const r = await submitAttempt(student.id, id, right, at(10 * 60_000));
    expect(r).toMatchObject({
      ok: true,
      data: { score: 0.25, late: true },
    });
    expect(await row(id)).toMatchObject({
      answers: ["A", null, null],
      timeTakenSec: 60,
    });
    // And nothing saves after that.
    expect(
      await saveProgress(student.id, id, {
        answers: ["B", null, null],
        flagged: [],
      }),
    ).toMatchObject({ code: "ATTEMPT_CLOSED" });
  });

  it("maps shuffled options back before grading", async () => {
    const { id } = await started({ shuffleOptions: true });
    const order = (await row(id))?.items[0]?.o ?? [];
    const letter = "ABCD"[order.indexOf(0)] as string;
    const r = await submitAttempt(
      student.id,
      id,
      { ...right, answers: [letter, null, null] },
      at(1000),
    );
    expect(r).toMatchObject({ ok: true, data: { score: 0.25 } });
  });

  it("hides others' attempts and refuses misaligned answers", async () => {
    const { id } = await started();
    const other = await addUser("student", "0900000010");
    expect(await submitAttempt(other, id, right, at(1000))).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(
      await submitAttempt(
        student.id,
        id,
        { ...right, answers: ["A"] },
        at(1000),
      ),
    ).toMatchObject({ code: "VALIDATION" });
    expect((await row(id))?.status).toBe("in_progress");
  });

  describe("rating (S4-01)", () => {
    const events = () => tdb.select().from(ratingEvents);
    const rating = async () =>
      (
        await tdb.select().from(ratings).where(eq(ratings.userId, student.id))
      )[0];

    it("rates the first test from 1500 and records the event", async () => {
      const { id, lessonId } = await started();
      await submitAttempt(student.id, id, right, at(1000));
      expect(await rating()).toMatchObject({
        rating: 1548,
        peak: 1548,
        ratedAttempts: 1,
      });
      expect(await events()).toEqual([
        expect.objectContaining({
          userId: student.id,
          attemptId: id,
          lessonId,
          before: 1500,
          delta: 48,
          after: 1548,
          performance: 1,
          timeBonus: 1,
          formula: "v2",
          createdAt: at(1000),
        }),
      ]);
    });

    it("rates zero-ish scores and slow late submits (v2 time bonus)", async () => {
      const { id } = await started({ timeLimitSec: 60 });
      await saveProgress(
        student.id,
        id,
        { answers: ["A", null, null], flagged: [] },
        at(30_000),
      );
      await submitAttempt(student.id, id, right, at(10 * 60_000));
      // perf 0.25/1.75 = 0.143, bonus 0.5: 48·(0.143 − 0.5)·0.5·1.5 = −12.85.
      expect(await events()).toMatchObject([
        { performance: 0.143, timeBonus: 0.5, delta: -13, after: 1487 },
      ]);
      expect((await rating())?.peak).toBe(1500);
    });

    it("writes one event for parallel submits of one attempt", async () => {
      const { id } = await started();
      await Promise.all([
        submitAttempt(student.id, id, right, at(1000)),
        submitAttempt(student.id, id, right, at(1000)),
      ]);
      expect(await events()).toHaveLength(1);
      expect((await rating())?.ratedAttempts).toBe(1);
    });

    it("counts two different tests submitted at once, one after the other", async () => {
      const a = await started();
      const b = await started();
      await Promise.all([
        submitAttempt(student.id, a.id, right, at(1000)),
        submitAttempt(student.id, b.id, right, at(1000)),
      ]);
      const list = await events();
      expect(list).toHaveLength(2);
      // The second one waits for the first one's row lock: 1548 + 41.
      expect(list.map((e) => e.before).sort()).toEqual([1500, 1548]);
      expect(await rating()).toMatchObject({ rating: 1589, ratedAttempts: 2 });
    });

    it("skips lessons that don't count for rating", async () => {
      const { id } = await started({ countsForRating: false });
      await submitAttempt(student.id, id, right, at(1000));
      expect(await events()).toHaveLength(0);
      expect(await rating()).toBeUndefined();
    });
  });

  describe("mistakes (S4-02)", () => {
    const bank = async () =>
      Object.fromEntries(
        (
          await tdb
            .select()
            .from(mistakes)
            .where(eq(mistakes.userId, student.id))
        ).map((m) => [
          m.questionId,
          `${m.status} w${m.wrongCount} s${m.correctStreak}`,
        ]),
      );
    // Retake the same lesson: each start is a new attempt after a submit.
    async function take(lessonId: number, answers: unknown[], ms: number) {
      const r = await startAttempt(student, lessonId, { ...ctx, now: at(ms) });
      if (!r.ok) throw new Error("start failed");
      await submitAttempt(
        student.id,
        r.data.attemptId,
        { ...right, answers: answers as typeof right.answers },
        at(ms + 1000),
      );
      return r.data.attemptId;
    }

    it("opens wrong, partial and blank questions, not correct ones", async () => {
      const { id, lessonId } = await started();
      await submitAttempt(
        student.id,
        id,
        { ...right, answers: ["A", [true, false, true, true], null] },
        at(1000),
      );
      expect(await bank()).toEqual({
        q_tf1: "open w1 s0",
        q_short1: "open w1 s0",
      });
      const [m] = await tdb
        .select()
        .from(mistakes)
        .where(eq(mistakes.questionId, "q_tf1"));
      expect(m).toMatchObject({
        lessonId,
        lastAttemptId: id,
        updatedAt: at(1000),
      });
    });

    it("resolves after two correct answers in a row and reopens on a wrong one", async () => {
      const lessonId = await addLesson();
      const wrongMcq = ["B", [true, false, true, false], "0.63"];
      await take(lessonId, wrongMcq, 0);
      await take(lessonId, right.answers, 10_000);
      expect(await bank()).toEqual({ q_mcq1: "open w1 s1" });
      const second = await take(lessonId, right.answers, 20_000);
      expect(await bank()).toEqual({ q_mcq1: "resolved w1 s2" });
      const [m] = await tdb.select().from(mistakes);
      expect(m?.lastAttemptId).toBe(second);
      // Resolved stays resolved on further correct answers...
      await take(lessonId, right.answers, 30_000);
      expect(await bank()).toEqual({ q_mcq1: "resolved w1 s2" });
      // ...and reopens with a fresh streak when missed again.
      await take(lessonId, wrongMcq, 40_000);
      expect(await bank()).toEqual({ q_mcq1: "open w2 s0" });
    });

    it("writes nothing for a perfect first test, and nothing twice on retries", async () => {
      const { id } = await started();
      await submitAttempt(student.id, id, right, at(1000));
      expect(await bank()).toEqual({});
      const other = await started();
      const wrong = { ...right, answers: ["B", null, null] };
      await Promise.all([
        submitAttempt(student.id, other.id, wrong, at(2000)),
        submitAttempt(student.id, other.id, wrong, at(2000)),
      ]);
      expect(await bank()).toEqual({
        q_mcq1: "open w1 s0",
        q_tf1: "open w1 s0",
        q_short1: "open w1 s0",
      });
    });
  });
});

describe("exam guard events (S4-04)", () => {
  const blank = { answers: [null, null, null], flagged: [] };
  const at = (ms: number) => new Date(NOW.getTime() + ms);
  async function started() {
    const lessonId = await addLesson({ examGuard: true });
    const r = await startAttempt(student, lessonId, ctx);
    if (!r.ok) throw new Error("start failed");
    return r.data.attemptId;
  }
  const events = async (id: string) =>
    (await tdb.select().from(attempts).where(eq(attempts.id, id)))[0]
      ?.guardEvents;

  it("appends on save and submit; an empty or forged batch erases nothing", async () => {
    const id = await started();
    await saveProgress(
      student.id,
      id,
      { ...blank, guardEvents: [{ t: 5, k: "hidden" }] },
      at(6000),
    );
    await saveProgress(student.id, id, blank, at(7000));
    await saveProgress(
      student.id,
      id,
      { ...blank, guardEvents: [{ t: 9, k: "copy" }] },
      at(9000),
    );
    await submitAttempt(
      student.id,
      id,
      {
        ...blank,
        guardEvents: [{ t: 12, k: "blur" }],
        clientSubmitId: crypto.randomUUID(),
      },
      at(12_000),
    );
    expect(await events(id)).toEqual([
      { t: 5, k: "hidden" },
      { t: 9, k: "copy" },
      { t: 12, k: "blur" },
    ]);
  });

  it(`keeps the first ${MAX_GUARD_EVENTS} events`, async () => {
    const id = await started();
    const batch = (from: number) =>
      Array.from({ length: 50 }, (_, i) => ({
        t: from + i,
        k: "blur" as const,
      }));
    for (let i = 0; i < 5; i++)
      await saveProgress(
        student.id,
        id,
        { ...blank, guardEvents: batch(i * 100) },
        at(1000 * (i + 1)),
      );
    const stored = await events(id);
    expect(stored).toHaveLength(MAX_GUARD_EVENTS);
    expect(stored?.at(-1)).toEqual({ t: 349, k: "blur" });
  });
});

describe("scheduled lessons (startsAt, after_deadline)", () => {
  const min = (m: number) => new Date(NOW.getTime() + m * 60_000);
  // Starts at NOW, 45 minutes, answers at NOW + 45 min + 30 s.
  const exam = {
    startsAt: NOW.toISOString(),
    timeLimitSec: 45 * 60,
    revealAnswers: "after_deadline" as const,
    maxAttempts: 1,
  };
  const start = (
    lessonId: number,
    now: Date,
    who: typeof student | typeof admin = student,
  ) => startAttempt(who, lessonId, { ...ctx, now });

  it("refuses starts before startsAt, except for admins", async () => {
    const id = await addLesson({ ...exam, revealAnswers: "after_submit" });
    expect(await start(id, min(-1))).toMatchObject({ code: "NOT_OPEN_YET" });
    expect(await start(id, min(-1), admin)).toMatchObject({ ok: true });
    expect(await start(id, min(0))).toMatchObject({ ok: true });
  });

  it("ends every attempt at startsAt + limit inside the window", async () => {
    const id = await addLesson(exam);
    const r = await start(id, min(30));
    if (!r.ok) throw new Error("start failed");
    const [row] = await tdb
      .select()
      .from(attempts)
      .where(eq(attempts.id, r.data.attemptId));
    expect(row?.deadlineAt).toEqual(min(45));
  });

  it("closes once answers are out; extra tries reopen it", async () => {
    const id = await addLesson(exam);
    const closed = new Date(min(45).getTime() + DEADLINE_GRACE_MS);
    expect(await start(id, closed)).toMatchObject({ code: "LESSON_CLOSED" });

    await tdb
      .insert(attemptOverrides)
      .values({ userId: student.id, lessonId: id, extraAttempts: 1 });
    const r = await start(id, min(60));
    if (!r.ok) throw new Error("override start failed");
    const [row] = await tdb
      .select()
      .from(attempts)
      .where(eq(attempts.id, r.data.attemptId));
    // After the close an extra try gets its own full time.
    expect(row?.deadlineAt).toEqual(min(105));
    await submitAttempt(
      student.id,
      r.data.attemptId,
      {
        answers: [null, null, null],
        flagged: [],
        clientSubmitId: crypto.randomUUID(),
      },
      min(70),
    );
    expect(await start(id, min(80))).toMatchObject({ code: "ATTEMPT_LIMIT" });
  });

  it("adds extra tries to maxAttempts while open", async () => {
    const id = await addLesson({ ...exam, revealAnswers: "after_submit" });
    const first = await start(id, min(1));
    if (!first.ok) throw new Error("start failed");
    await submitAttempt(
      student.id,
      first.data.attemptId,
      {
        answers: [null, null, null],
        flagged: [],
        clientSubmitId: crypto.randomUUID(),
      },
      min(2),
    );
    expect(await start(id, min(3))).toMatchObject({ code: "ATTEMPT_LIMIT" });
    await tdb
      .insert(attemptOverrides)
      .values({ userId: student.id, lessonId: id, extraAttempts: 1 });
    expect(await start(id, min(4))).toMatchObject({ ok: true });
  });
});
