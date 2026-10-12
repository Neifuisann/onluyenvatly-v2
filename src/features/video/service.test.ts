import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  attempts,
  lessons,
  lessonVersions,
  ratingEvents,
  users,
} from "@/db/schema";
import { saveProgress, startAttempt } from "@/features/attempts/service";
import {
  DEFAULT_LESSON_CONFIG,
  type Question,
  type VideoConfig,
} from "@/features/lessons/schema";
import { shareLesson } from "@/test/classes";
import { resetDb, type TestDb } from "@/test/db";
import { CLOCK_SLACK_SEC } from "./domain/engine";
import { videoMove } from "./service";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
const NOW = new Date("2026-10-20T02:00:00Z");
const at = (sec: number) => new Date(NOW.getTime() + sec * 1000);

// Written in teacher order; the video asks them by time.
const questions: Question[] = [
  { id: "s_end", type: "short", stem: "?", answer: "1.5" },
  {
    id: "t_90",
    type: "tf",
    stem: "?",
    statements: [
      { text: "a", answer: true },
      { text: "b", answer: false },
    ],
    at: 90,
  },
  {
    id: "m_30",
    type: "mcq",
    stem: "?",
    options: [{ text: "a" }, { text: "b" }, { text: "c" }],
    answer: 1,
    at: 30,
  },
  { id: "s_90", type: "short", stem: "?", answer: "2", at: 90 },
];

const VIDEO: VideoConfig = {
  youtubeId: "dQw4w9WgXcQ",
  seek: "after_first",
  durationSec: 600,
};

let userId: string;
let lessonId: number;

async function setup(video: VideoConfig | null, qs = questions) {
  const [u] = await tdb
    .insert(users)
    .values({
      role: "student",
      status: "active",
      fullName: "Học sinh",
      phone: "0900000001",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  userId = u?.id ?? "";
  const [teacher] = await tdb
    .insert(users)
    .values({
      role: "teacher",
      status: "active",
      fullName: "Giáo viên",
      phone: "0900000002",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  const [lesson] = await tdb
    .insert(lessons)
    .values({
      title: "Bài",
      status: "published",
      config: { ...DEFAULT_LESSON_CONFIG, video },
    })
    .returning({ id: lessons.id });
  lessonId = lesson?.id ?? 0;
  const [version] = await tdb
    .insert(lessonVersions)
    .values({ lessonId, version: 1, sourceText: "", questions: qs })
    .returning({ id: lessonVersions.id });
  await tdb
    .update(lessons)
    .set({ currentVersionId: version?.id ?? null })
    .where(eq(lessons.id, lessonId));
  await shareLesson(tdb, lessonId, teacher?.id ?? "");
  return start(NOW);
}

async function start(now: Date) {
  const started = await startAttempt(
    { id: userId, role: "student" },
    lessonId,
    {
      ip: null,
      now,
      seed: 1,
    },
  );
  if (!started.ok) throw new Error(started.code);
  return started.data.attemptId;
}

const row = async (id: string) =>
  (await tdb.select().from(attempts).where(eq(attempts.id, id)))[0];

beforeEach(async () => {
  await resetDb(tdb);
});

describe("starting a video lesson", () => {
  it("asks the questions in video order, grouped into cues", async () => {
    const id = await setup(VIDEO);
    expect(await row(id)).toMatchObject({
      mode: "video",
      items: [{ q: "m_30" }, { q: "t_90" }, { q: "s_90" }, { q: "s_end" }],
      answers: [null, null, null, null],
      deadlineAt: null,
      video: {
        cues: [
          { at: 30, n: 1 },
          { at: 90, n: 2 },
          { at: null, n: 1 },
        ],
        done: 0,
        seek: false,
        pos: 0,
        max: 0,
      },
    });
  });

  it("asks a question set past the video's end at the end", async () => {
    const id = await setup({ ...VIDEO, durationSec: 60 });
    expect((await row(id))?.video?.cues).toEqual([
      { at: 30, n: 1 },
      { at: null, n: 3 },
    ]);
  });

  it("lets the student seek once they have finished the video", async () => {
    const first = await setup({ ...VIDEO, seek: "after_first" });
    expect((await row(first))?.video?.seek).toBe(false);
    await tdb
      .update(attempts)
      .set({ status: "submitted", submittedAt: NOW })
      .where(eq(attempts.id, first));
    expect((await row(await start(at(1))))?.video?.seek).toBe(true);
  });

  it("follows the never and always rules", async () => {
    const id = await setup({ ...VIDEO, seek: "always" });
    expect((await row(id))?.video?.seek).toBe(true);
    await resetDb(tdb);
    const never = await setup({ ...VIDEO, seek: "never" });
    await tdb
      .update(attempts)
      .set({ status: "submitted", submittedAt: NOW })
      .where(eq(attempts.id, never));
    expect((await row(await start(at(1))))?.video?.seek).toBe(false);
  });

  it("a lesson without a video refuses video steps", async () => {
    const id = await setup(null);
    expect(await row(id)).toMatchObject({ mode: "test", video: null });
    expect(
      await videoMove(userId, id, { kind: "progress", pos: 3 }, NOW),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("videoMove", () => {
  it("watches a whole lesson: cues in order, the clock checked, graded at the end", async () => {
    const id = await setup(VIDEO);

    // Too early for the first cue, and not the next cue.
    expect(
      await videoMove(
        userId,
        id,
        { kind: "answer", cue: 0, answers: ["B"] },
        at(10),
      ),
    ).toMatchObject({ ok: false, code: "VIDEO_TOO_EARLY" });
    expect(
      await videoMove(
        userId,
        id,
        { kind: "answer", cue: 1, answers: [[true, false], "2"] },
        at(100),
      ),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
    // Wrong number of answers for the cue.
    expect(
      await videoMove(
        userId,
        id,
        { kind: "answer", cue: 0, answers: ["B", "C"] },
        at(31),
      ),
    ).toMatchObject({ ok: false, code: "VALIDATION" });

    const first = await videoMove(
      userId,
      id,
      { kind: "answer", cue: 0, answers: ["B"] },
      at(31),
    );
    expect(first).toMatchObject({
      ok: true,
      data: { state: { done: 1, pos: 30, max: 30 } },
    });
    // Nothing about the key comes back.
    expect(JSON.stringify(first)).not.toContain("answer");
    // A retry reads as done and can't change the stored answer.
    expect(
      await videoMove(
        userId,
        id,
        { kind: "answer", cue: 0, answers: ["A"] },
        at(32),
      ),
    ).toMatchObject({ ok: true, data: { state: { done: 1 } } });
    expect((await row(id))?.answers).toEqual(["B", null, null, null]);

    expect(
      await videoMove(
        userId,
        id,
        { kind: "answer", cue: 1, answers: [[true, true], "2,0"] },
        at(95),
      ),
    ).toMatchObject({ ok: true, data: { state: { done: 2 } } });

    // The end cue waits for the whole video, then grades.
    expect(
      await videoMove(
        userId,
        id,
        { kind: "answer", cue: 2, answers: ["1,5"] },
        at(200),
      ),
    ).toMatchObject({ ok: false, code: "VIDEO_TOO_EARLY" });
    const last = await videoMove(
      userId,
      id,
      { kind: "answer", cue: 2, answers: ["1,5"] },
      at(600),
    );
    expect(last).toMatchObject({
      ok: true,
      data: { state: { done: 3 }, result: { maxScore: 4 } },
    });
    const graded = await row(id);
    expect(graded).toMatchObject({
      status: "submitted",
      answers: ["B", [true, true], "2,0", "1,5"],
    });
    // mcq 1 + tf (1 of 2 statements: thpt2025 with 2 statements → 0.5) + 1 + 1.
    expect(graded?.score).toBe(3.5);
    // A video lesson is rated like a test.
    const [rated] = await tdb
      .select()
      .from(ratingEvents)
      .where(eq(ratingEvents.attemptId, id));
    expect(rated).toBeDefined();
    expect(
      await videoMove(userId, id, { kind: "finish" }, at(601)),
    ).toMatchObject({ ok: false, code: "ATTEMPT_CLOSED" });
  });

  it("finishes when the video ends after the last timed cue", async () => {
    const id = await setup(
      VIDEO,
      questions.filter((q) => q.at !== undefined),
    );
    await videoMove(
      userId,
      id,
      { kind: "answer", cue: 0, answers: ["B"] },
      at(30),
    );
    expect(
      await videoMove(userId, id, { kind: "finish" }, at(60)),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
    await videoMove(
      userId,
      id,
      { kind: "answer", cue: 1, answers: [[true, false], "2"] },
      at(90),
    );
    expect(
      await videoMove(userId, id, { kind: "finish" }, at(300)),
    ).toMatchObject({ ok: false, code: "VIDEO_TOO_EARLY" });
    expect(
      await videoMove(
        userId,
        id,
        { kind: "finish" },
        at(600 - CLOCK_SLACK_SEC),
      ),
    ).toMatchObject({
      ok: true,
      data: { result: { score: 3, maxScore: 3, score10: 10 } },
    });
  });

  it("saves the position for a reload, bounded by the clock", async () => {
    const id = await setup(VIDEO);
    expect(
      await videoMove(userId, id, { kind: "progress", pos: 42.04 }, at(50)),
    ).toMatchObject({
      ok: true,
      data: { state: { pos: 42, max: 42, done: 0 } },
    });
    // A skip the clock can't explain is cut back.
    expect(
      await videoMove(userId, id, { kind: "progress", pos: 400 }, at(60)),
    ).toMatchObject({
      ok: true,
      data: { state: { pos: 60 + CLOCK_SLACK_SEC, max: 60 + CLOCK_SLACK_SEC } },
    });
    // Rewinding keeps the furthest point.
    expect(
      await videoMove(userId, id, { kind: "progress", pos: 10 }, at(70)),
    ).toMatchObject({ ok: true, data: { state: { pos: 10, max: 65 } } });
  });

  it("is the owner's only and never autosaves", async () => {
    const id = await setup(VIDEO);
    expect(
      await videoMove(
        "00000000-0000-4000-8000-000000000000",
        id,
        { kind: "progress", pos: 1 },
        NOW,
      ),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(
      await saveProgress(
        userId,
        id,
        { answers: ["A", null, null, null], flagged: [] },
        at(5),
      ),
    ).toMatchObject({ ok: false });
    expect((await row(id))?.answers).toEqual([null, null, null, null]);
  });
});
