import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  type AttemptAnswer,
  type AttemptItem,
  attempts,
  lessons,
  lessonVersions,
  mistakes,
  ratingEvents,
  users,
} from "@/db/schema";
import {
  checkPracticeAnswer,
  saveProgress,
  startAttempt,
  submitAttempt,
} from "@/features/attempts/service";
import { expectedAnswer } from "@/features/grading/domain/grade";
import {
  DEFAULT_LESSON_CONFIG,
  type LessonConfig,
  type Question,
} from "@/features/lessons/schema";
import { shareLesson } from "@/test/classes";
import { resetDb, type TestDb } from "@/test/db";
import { summarizeBank } from "./domain/practice";
import { reviewCopy } from "./messages";
import { startReviewPractice } from "./practice-service";
import {
  getMistakeGroups,
  getMistakes,
  getOpenReview,
  getPracticeCandidates,
} from "./queries";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

/**
 * Journey 6 (11 §3) at the service level (S7-06): wrong answers land in the
 * bank, a practice set is built from the ones whose answers may be shown,
 * "Kiểm tra" locks answers, and two correct rounds resolve a mistake. No
 * rating, no attempt count.
 */

const tdb = db as unknown as TestDb;
const NOW = new Date("2026-10-20T02:00:00Z");
const later = (min: number) => new Date(NOW.getTime() + min * 60_000);

const mcq = (id: string): Question => ({
  id,
  type: "mcq",
  stem: `Câu ${id}?`,
  options: [{ text: "đúng" }, { text: "b" }, { text: "c" }, { text: "d" }],
  answer: 0,
});
const tf: Question = {
  id: "q_2",
  type: "tf",
  stem: "Phát biểu",
  statements: [
    { text: "a", answer: true },
    { text: "b", answer: false },
    { text: "c", answer: true },
    { text: "d", answer: false },
  ],
};
const short: Question = { id: "q_3", type: "short", stem: "T?", answer: "0.5" };

let student: string;
let other: string;
let teacher: string;
let lessonA: number;
let lessonB: number;
let lessonC: number;
let versionOf: Map<number, Map<string, Question>>;

async function addUser(phone: string) {
  const [u] = await tdb
    .insert(users)
    .values({
      role: "student",
      status: "active",
      fullName: "Học Sinh",
      phone,
      passwordHash: "x",
    })
    .returning({ id: users.id });
  return u?.id ?? "";
}

async function addLesson(
  chapter: string,
  questions: Question[],
  config: Partial<LessonConfig> = {},
) {
  const [lesson] = await tdb
    .insert(lessons)
    .values({
      title: `Bài ${chapter}`,
      chapter,
      status: "published",
      config: { ...DEFAULT_LESSON_CONFIG, ...config },
    })
    .returning({ id: lessons.id });
  const id = lesson?.id ?? 0;
  const [version] = await tdb
    .insert(lessonVersions)
    .values({ lessonId: id, version: 1, sourceText: "", questions })
    .returning({ id: lessonVersions.id });
  const versionId = version?.id ?? 0;
  await tdb
    .update(lessons)
    .set({ currentVersionId: versionId })
    .where(eq(lessons.id, id));
  // B-03: the students reach it through the teacher's class.
  await shareLesson(tdb, id, teacher);
  versionOf.set(versionId, new Map(questions.map((q) => [q.id, q])));
  return id;
}

/** Takes a lesson's test and leaves everything blank: all mistakes. */
async function failTest(userId: string, lessonId: number, at = NOW) {
  const started = await startAttempt(
    { id: userId, role: "student" },
    lessonId,
    {
      ip: null,
      now: at,
      seed: 1,
    },
  );
  if (!started.ok) throw new Error(started.code);
  const [row] = await tdb
    .select({ items: attempts.items })
    .from(attempts)
    .where(eq(attempts.id, started.data.attemptId));
  const submitted = await submitAttempt(
    userId,
    started.data.attemptId,
    {
      answers: (row?.items ?? []).map(() => null),
      flagged: [],
      clientSubmitId: randomUUID(),
    },
    at,
  );
  if (!submitted.ok) throw new Error(submitted.code);
}

async function reviewRow(id: string) {
  const [row] = await tdb.select().from(attempts).where(eq(attempts.id, id));
  if (!row) throw new Error("no attempt");
  return row;
}

const keyOf = (item: AttemptItem): AttemptAnswer => {
  const q = versionOf.get(item.v ?? 0)?.get(item.q);
  if (!q) throw new Error(`no question ${item.q}`);
  return expectedAnswer(q, item);
};

const bank = () =>
  tdb
    .select({
      lessonId: mistakes.lessonId,
      questionId: mistakes.questionId,
      questionType: mistakes.questionType,
      wrongCount: mistakes.wrongCount,
      correctStreak: mistakes.correctStreak,
      status: mistakes.status,
    })
    .from(mistakes)
    .where(eq(mistakes.userId, student))
    .orderBy(mistakes.lessonId, mistakes.questionId);

async function submitReview(id: string, answers: AttemptAnswer[], at: Date) {
  return submitAttempt(
    student,
    id,
    { answers, flagged: [], clientSubmitId: randomUUID() },
    at,
  );
}

beforeEach(async () => {
  await resetDb(tdb);
  versionOf = new Map();
  student = await addUser("0900000001");
  other = await addUser("0900000002");
  const [t] = await tdb
    .insert(users)
    .values({
      role: "teacher",
      status: "active",
      fullName: "Cô giáo",
      username: "teacher",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  teacher = t?.id ?? "";
  // A and C share a question id: the bank keys by lesson too.
  lessonA = await addLesson("Sóng cơ", [mcq("q_1"), tf, short]);
  lessonB = await addLesson("Dao động cơ", [mcq("q_1")], {
    revealAnswers: "never",
  });
  lessonC = await addLesson("Sóng cơ", [mcq("q_1")]);
  await failTest(student, lessonA);
  await failTest(student, lessonB);
  await failTest(student, lessonC);
});

describe("the mistakes bank", () => {
  it("records each question with its type, per lesson", async () => {
    expect(await bank()).toEqual([
      {
        lessonId: lessonA,
        questionId: "q_1",
        questionType: "mcq",
        wrongCount: 1,
        correctStreak: 0,
        status: "open",
      },
      {
        lessonId: lessonA,
        questionId: "q_2",
        questionType: "tf",
        wrongCount: 1,
        correctStreak: 0,
        status: "open",
      },
      {
        lessonId: lessonA,
        questionId: "q_3",
        questionType: "short",
        wrongCount: 1,
        correctStreak: 0,
        status: "open",
      },
      {
        lessonId: lessonB,
        questionId: "q_1",
        questionType: "mcq",
        wrongCount: 1,
        correctStreak: 0,
        status: "open",
      },
      {
        lessonId: lessonC,
        questionId: "q_1",
        questionType: "mcq",
        wrongCount: 1,
        correctStreak: 0,
        status: "open",
      },
    ]);
  });

  it("counts, filters and marks what can't be practised", async () => {
    const summary = summarizeBank(await getMistakeGroups(student, NOW), {
      chapter: null,
      type: null,
    });
    expect(summary).toMatchObject({ total: 5, matching: 5, practicable: 4 });
    expect(summary.chapters).toEqual([
      { name: "Dao động cơ", count: 1 },
      { name: "Sóng cơ", count: 4 },
    ]);
    const mcqOnly = await getMistakes(
      student,
      { chapter: "Sóng cơ", type: "mcq" },
      1,
      NOW,
    );
    expect(mcqOnly.rows).toHaveLength(1);
    expect(mcqOnly.more).toBe(true);
    const hidden = await getMistakes(
      student,
      { chapter: "Dao động cơ", type: null },
      20,
      NOW,
    );
    expect(hidden.rows.map((r) => r.practicable)).toEqual([false]);
    expect(
      await getPracticeCandidates(
        student,
        { chapter: null, type: null },
        50,
        NOW,
      ),
    ).toHaveLength(4);
    expect(await getMistakeGroups(other, NOW)).toEqual([]);
  });
});

describe("startReviewPractice", () => {
  it("builds one open review from practicable mistakes and resumes it", async () => {
    const started = await startReviewPractice(
      { id: student },
      { chapter: null, type: null, count: 10 },
      { now: NOW, seed: 3 },
    );
    expect(started).toMatchObject({ ok: true, data: { resumed: false } });
    if (!started.ok) return;
    const row = await reviewRow(started.data.attemptId);
    expect(row).toMatchObject({
      mode: "review",
      lessonId: null,
      lessonVersionId: null,
      status: "in_progress",
      deadlineAt: null,
      maxScore: 4,
      checked: [],
    });
    expect(row.items).toHaveLength(4);
    expect(row.items.every((i) => i.v !== undefined && i.p === 1)).toBe(true);
    // Lesson B's answers are never shown: not in the set.
    const lessonOfVersion = new Map(
      (
        await tdb
          .select({ id: lessonVersions.id, lessonId: lessonVersions.lessonId })
          .from(lessonVersions)
      ).map((v) => [v.id, v.lessonId]),
    );
    expect(row.items.map((i) => lessonOfVersion.get(i.v ?? 0)).sort()).toEqual(
      [lessonA, lessonA, lessonA, lessonC].sort(),
    );

    const again = await startReviewPractice(
      { id: student },
      { chapter: "Sóng cơ", type: "tf", count: 10 },
      { now: NOW },
    );
    expect(again).toEqual({
      ok: true,
      data: { attemptId: started.data.attemptId, resumed: true },
    });
    expect(await getOpenReview(student)).toMatchObject({
      id: started.data.attemptId,
      count: 4,
    });
  });

  it("follows the filters and the size", async () => {
    const started = await startReviewPractice(
      { id: student },
      { chapter: "Sóng cơ", type: "mcq", count: 10 },
      { now: NOW, seed: 1 },
    );
    if (!started.ok) throw new Error(started.code);
    const row = await reviewRow(started.data.attemptId);
    expect(row.items.map((i) => i.q)).toEqual(["q_1", "q_1"]);
    expect(row.items.every((i) => i.o?.length === 4)).toBe(true);
  });

  it("says so when nothing can be practised", async () => {
    const result = await startReviewPractice(
      { id: student },
      { chapter: "Dao động cơ", type: null, count: 10 },
      { now: NOW },
    );
    expect(result).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: reviewCopy.nothing,
    });
    expect(await getOpenReview(student)).toBeNull();
  });
});

describe("practice and submit", () => {
  async function openReview(count = 10) {
    const started = await startReviewPractice(
      { id: student },
      { chapter: null, type: null, count },
      { now: NOW, seed: 5 },
    );
    if (!started.ok) throw new Error(started.code);
    return reviewRow(started.data.attemptId);
  }

  it("checks one answer, locks it, and refuses tests and strangers", async () => {
    const row = await openReview();
    const first = row.items[0] as AttemptItem;
    const key = keyOf(first);
    const wrong: AttemptAnswer = Array.isArray(key)
      ? key.map((v) => !v)
      : key === "A"
        ? "B"
        : "A";

    const checked = await checkPracticeAnswer(student, {
      attemptId: row.id,
      index: 0,
      answer: wrong,
    });
    expect(checked).toMatchObject({
      ok: true,
      data: { outcome: "wrong", max: 1, expected: key },
    });
    // Asking again with the key doesn't change the checked answer.
    const retry = await checkPracticeAnswer(student, {
      attemptId: row.id,
      index: 0,
      answer: key,
    });
    expect(retry).toMatchObject({ ok: true, data: { outcome: "wrong" } });
    // Neither does a save.
    const answers = row.items.map(() => null) as AttemptAnswer[];
    answers[0] = key;
    answers[1] = "A";
    expect(
      await saveProgress(student, row.id, { answers, flagged: [] }, NOW),
    ).toMatchObject({ ok: true });
    const saved = await reviewRow(row.id);
    expect(saved.checked).toEqual([0]);
    expect(saved.answers[0]).toEqual(wrong);
    expect(saved.answers[1]).toBe("A");

    expect(
      await checkPracticeAnswer(other, {
        attemptId: row.id,
        index: 1,
        answer: "A",
      }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(
      await checkPracticeAnswer(student, {
        attemptId: row.id,
        index: 9,
        answer: "A",
      }),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
    const test = await startAttempt({ id: student, role: "student" }, lessonA, {
      ip: null,
      now: NOW,
      seed: 1,
    });
    if (!test.ok) throw new Error(test.code);
    expect(
      await checkPracticeAnswer(student, {
        attemptId: test.data.attemptId,
        index: 0,
        answer: "A",
      }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });

    // The submit keeps the checked (wrong) answer too.
    const done = await submitReview(
      row.id,
      row.items.map((i) => keyOf(i)),
      later(5),
    );
    expect(done).toMatchObject({ ok: true, data: { score: 3, maxScore: 4 } });
    expect(
      await checkPracticeAnswer(student, {
        attemptId: row.id,
        index: 1,
        answer: "A",
      }),
    ).toMatchObject({ ok: false, code: "ATTEMPT_CLOSED" });
  });

  it("two correct rounds resolve mistakes, without rating or attempt counts", async () => {
    const ratedCount = async () =>
      (
        await tdb
          .select({ id: ratingEvents.id })
          .from(ratingEvents)
          .where(eq(ratingEvents.userId, student))
      ).length;
    expect(await ratedCount()).toBe(3);
    const countsBefore = await tdb
      .select({ id: lessons.id, n: lessons.attemptCount })
      .from(lessons);

    const first = await openReview();
    const r1 = await submitReview(
      first.id,
      first.items.map((i) => keyOf(i)),
      later(5),
    );
    expect(r1).toMatchObject({ ok: true, data: { score: 4, score10: 10 } });
    const afterOne = await bank();
    expect(
      afterOne
        .filter((m) => m.lessonId !== lessonB)
        .map((m) => m.correctStreak),
    ).toEqual([1, 1, 1, 1]);
    expect(afterOne.every((m) => m.status === "open")).toBe(true);

    const second = await openReview();
    expect(second.id).not.toBe(first.id);
    await submitReview(
      second.id,
      second.items.map((i) => keyOf(i)),
      later(10),
    );
    const afterTwo = await bank();
    expect(afterTwo.map((m) => m.status)).toEqual([
      "resolved",
      "resolved",
      "resolved",
      "open",
      "resolved",
    ]);

    // Only the three tests were rated.
    expect(await ratedCount()).toBe(3);
    expect(
      await tdb
        .select({ id: lessons.id, n: lessons.attemptCount })
        .from(lessons),
    ).toEqual(countsBefore);
    // Only lesson B's mistake is left, and it can't be practised.
    expect(
      await startReviewPractice(
        { id: student },
        { chapter: null, type: null, count: 10 },
        { now: later(11) },
      ),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("a wrong answer in practice counts like one in a test", async () => {
    const row = await openReview();
    const answers = row.items.map((i) => keyOf(i));
    answers[0] = null;
    await submitReview(row.id, answers, later(5));
    const missed = row.items[0] as AttemptItem;
    const [lessonVersion] = await tdb
      .select({ lessonId: lessonVersions.lessonId })
      .from(lessonVersions)
      .where(eq(lessonVersions.id, missed.v ?? 0));
    const [m] = await tdb
      .select()
      .from(mistakes)
      .where(
        and(
          eq(mistakes.userId, student),
          eq(mistakes.lessonId, lessonVersion?.lessonId ?? 0),
          eq(mistakes.questionId, missed.q),
        ),
      );
    expect(m).toMatchObject({
      wrongCount: 2,
      correctStreak: 0,
      status: "open",
      lastAttemptId: row.id,
    });
  });
});
