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
import { startAttempt, submitAttempt } from "@/features/attempts/service";
import {
  applyRating,
  INITIAL_RATING,
  performance,
} from "@/features/rating/domain/rating";
import { shareLesson } from "@/test/classes";
import { resetDb, type TestDb } from "@/test/db";
import { correctLesson } from "./correction-service";
import { DEFAULT_LESSON_CONFIG, type Question } from "./schema";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
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

const PERFECT: AttemptAnswer[] = ["A", [true, false, true, false], "0.63"];
const OTHER: AttemptAnswer[] = ["B", [true, false, true, false], null];

let admin: { id: string; role: "admin" };
let seq = 0;

async function addUser(role: "student" | "admin" = "student") {
  const [u] = await tdb
    .insert(users)
    .values({
      role,
      status: "active",
      fullName: "Học Sinh",
      phone: `09${String(++seq).padStart(8, "0")}`,
      passwordHash: "x",
    })
    .returning({ id: users.id });
  return u?.id ?? "";
}

async function addLesson() {
  const [lesson] = await tdb
    .insert(lessons)
    .values({
      title: "Dao động",
      status: "published",
      config: DEFAULT_LESSON_CONFIG,
      questionCount: 3,
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
  return { id, versionId: version?.id ?? 0 };
}

async function take(
  userId: string,
  lessonId: number,
  answers: AttemptAnswer[] | null,
  minute: number,
) {
  // B-03: the student reaches the lesson through the admin's class.
  await shareLesson(tdb, lessonId, admin.id);
  const started = await startAttempt(
    { id: userId, role: "student" },
    lessonId,
    { ip: null, now: at(minute), seed: 1 },
  );
  if (!started.ok) throw new Error(started.code);
  const id = started.data.attemptId;
  if (answers) {
    const submitted = await submitAttempt(
      userId,
      id,
      { answers, flagged: [], guardEvents: [], clientSubmitId: randomUUID() },
      at(minute + 1),
    );
    if (!submitted.ok) throw new Error(submitted.code);
  }
  return id;
}

const attempt = async (id: string) =>
  (
    await tdb
      .select({
        items: attempts.items,
        earned: attempts.earned,
        score: attempts.score,
        maxScore: attempts.maxScore,
        score10: attempts.score10,
      })
      .from(attempts)
      .where(eq(attempts.id, id))
  )[0];

beforeEach(async () => {
  await resetDb(tdb);
  admin = { id: await addUser("admin"), role: "admin" };
});

describe("correctLesson (B-10)", () => {
  it("regrades every attempt on the version when a key changes", async () => {
    const { id } = await addLesson();
    const s1 = await addUser();
    const s2 = await addUser();
    const a1 = await take(s1, id, PERFECT, 0);
    const a2 = await take(s2, id, OTHER, 0);

    const r = await correctLesson(admin, id, [
      { kind: "mcq-answer", questionId: "q_mcq", answer: 1 },
    ]);
    expect(r).toEqual({
      ok: true,
      data: {
        versionId: expect.any(Number),
        changed: 1,
        regraded: 2,
        rated: true,
      },
    });
    expect(await attempt(a1)).toMatchObject({
      earned: [0, 1, 0.5],
      score: 1.5,
      maxScore: 1.75,
      score10: 8.57,
    });
    expect(await attempt(a2)).toMatchObject({
      earned: [0.25, 1, 0],
      score: 1.25,
    });

    // Rating as if the student had scored 1.25 / 1.75 in the first place.
    const [event] = await tdb
      .select({
        performance: ratingEvents.performance,
        after: ratingEvents.after,
      })
      .from(ratingEvents)
      .where(eq(ratingEvents.userId, s2));
    const perf = performance(1.25, 1.75);
    const fresh = applyRating(INITIAL_RATING, perf, 1);
    expect(event).toEqual({ performance: perf, after: fresh.after });
    const [rating] = await tdb
      .select({ rating: ratings.rating })
      .from(ratings)
      .where(eq(ratings.userId, s2));
    expect(rating?.rating).toBe(fresh.after);

    // The version holds the new key and its regenerated text.
    const [version] = await tdb
      .select({ q: lessonVersions.questions, text: lessonVersions.sourceText })
      .from(lessonVersions)
      .where(eq(lessonVersions.lessonId, id));
    expect((version?.q as Question[])[0]).toMatchObject({ answer: 1 });
    expect(version?.text).toContain("*B. m");
    const [audit] = await tdb
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.action, "lesson.correct"));
    expect(audit).toBeDefined();
  });

  it("gives a free question's points to everyone, blank answers included", async () => {
    const { id } = await addLesson();
    const a = await take(await addUser(), id, OTHER, 0);
    const r = await correctLesson(admin, id, [
      { kind: "free", questionId: "q_short", free: true },
    ]);
    expect(r.ok).toBe(true);
    expect(await attempt(a)).toMatchObject({ earned: [0, 1, 0.5], score: 1.5 });
  });

  it("removes a question from scores, counts, new attempts and mistakes", async () => {
    const { id, versionId } = await addLesson();
    const s = await addUser();
    const done = await take(s, id, OTHER, 0);
    const open = await take(await addUser(), id, null, 0);
    expect(
      await tdb
        .select({ q: mistakes.questionId })
        .from(mistakes)
        .where(eq(mistakes.userId, s))
        .orderBy(asc(mistakes.questionId)),
    ).toEqual([{ q: "q_mcq" }, { q: "q_short" }]);

    const r = await correctLesson(admin, id, [
      { kind: "remove", questionId: "q_short" },
    ]);
    expect(r.ok && r.data.regraded).toBe(2);
    expect(await attempt(done)).toMatchObject({
      earned: [0, 1, 0],
      score: 1,
      maxScore: 1.25,
      score10: 8,
    });
    // In progress: re-priced, graded at submit.
    expect(await attempt(open)).toMatchObject({ maxScore: 1.25, score: null });
    expect(
      await tdb
        .select({ q: mistakes.questionId })
        .from(mistakes)
        .where(eq(mistakes.lessonVersionId, versionId)),
    ).toEqual([{ q: "q_mcq" }]);
    const [lesson] = await tdb
      .select({ n: lessons.questionCount })
      .from(lessons)
      .where(eq(lessons.id, id));
    expect(lesson?.n).toBe(2);
    const fresh = await take(await addUser(), id, null, 5);
    expect((await attempt(fresh))?.items.map((i) => i.q)).toEqual([
      "q_mcq",
      "q_tf",
    ]);
  });

  it("re-prices a question's items when its points change", async () => {
    const { id } = await addLesson();
    const a = await take(await addUser(), id, PERFECT, 0);
    await correctLesson(admin, id, [
      { kind: "points", questionId: "q_mcq", points: 1 },
    ]);
    expect(await attempt(a)).toMatchObject({
      earned: [1, 1, 0.5],
      score: 2.5,
      maxScore: 2.5,
      score10: 10,
    });
  });

  it("refuses while a draft exists, and a change of shape", async () => {
    const { id } = await addLesson();
    const [draft] = await tdb
      .insert(lessonVersions)
      .values({ lessonId: id, version: 2, sourceText: "", questions: [] })
      .returning({ id: lessonVersions.id });
    await tdb
      .update(lessons)
      .set({ draftVersionId: draft?.id ?? null })
      .where(eq(lessons.id, id));
    expect(
      await correctLesson(admin, id, [
        { kind: "mcq-answer", questionId: "q_mcq", answer: 1 },
      ]),
    ).toMatchObject({ ok: false, code: "CONFLICT" });

    const other = await addLesson();
    expect(
      await correctLesson(admin, other.id, [
        {
          kind: "content",
          question: { id: "q_mcq", type: "short", stem: "x", answer: "1" },
        },
      ]),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});
