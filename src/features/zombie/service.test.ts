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
  type GameConfig,
  type Question,
} from "@/features/lessons/schema";
import { shareLesson } from "@/test/classes";
import { resetDb, type TestDb } from "@/test/db";
import { BREAK_MS, COUNTDOWN_MS } from "./domain/engine";
import { playMove } from "./service";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

const tdb = db as unknown as TestDb;
const NOW = new Date("2026-10-20T02:00:00Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);

const questions: Question[] = [
  {
    id: "m1",
    type: "mcq",
    stem: "?",
    options: [{ text: "a" }, { text: "b" }, { text: "c" }, { text: "d" }],
    answer: 1,
  },
  { id: "s1", type: "short", stem: "?", answer: "1" },
  {
    id: "t1",
    type: "tf",
    stem: "?",
    statements: [
      { text: "a", answer: true },
      { text: "b", answer: false },
    ],
  },
];

let userId: string;

async function setup(game: GameConfig | null) {
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
      config: { ...DEFAULT_LESSON_CONFIG, game },
    })
    .returning({ id: lessons.id });
  const lessonId = lesson?.id ?? 0;
  const [version] = await tdb
    .insert(lessonVersions)
    .values({ lessonId, version: 1, sourceText: "", questions })
    .returning({ id: lessonVersions.id });
  await tdb
    .update(lessons)
    .set({ currentVersionId: version?.id ?? null })
    .where(eq(lessons.id, lessonId));
  // B-03: students reach a lesson only through a class.
  await shareLesson(tdb, lessonId, teacher?.id ?? "");
  const started = await startAttempt(
    { id: userId, role: "student" },
    lessonId,
    {
      ip: null,
      now: NOW,
      seed: 1,
    },
  );
  if (!started.ok) throw new Error(started.code);
  return started.data.attemptId;
}

const row = async (id: string) =>
  (await tdb.select().from(attempts).where(eq(attempts.id, id)))[0];

const ZOMBIE: GameConfig = {
  kind: "zombie",
  lives: 3,
  secondsPerQuestion: 20,
};

beforeEach(async () => {
  await resetDb(tdb);
});

describe("starting a game", () => {
  it("plays mcq and tf only, one wave per mcq and per tf statement", async () => {
    const id = await setup(ZOMBIE);
    const a = await row(id);
    expect(a).toMatchObject({
      mode: "game",
      items: [{ q: "m1" }, { q: "t1" }],
      answers: [null, null],
      deadlineAt: null,
      game: {
        lives: 3,
        sec: 20,
        at: null,
        wave: 0,
        over: null,
        waves: [
          { i: 0, n: 4, s: [] },
          { i: 1, p: 0, n: 2, s: [] },
          { i: 1, p: 1, n: 2, s: [] },
        ],
      },
    });
  });

  it("a lesson without a game starts a test", async () => {
    const id = await setup(null);
    expect(await row(id)).toMatchObject({ mode: "test", game: null });
    expect(await playMove(userId, id, { kind: "begin" }, NOW)).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
  });
});

describe("playMove", () => {
  it("plays a whole game: answers, keys only after a wave ends, grading", async () => {
    const id = await setup(ZOMBIE);
    expect(
      await playMove(userId, id, { kind: "shoot", wave: 0, lane: 1 }, NOW),
    ).toMatchObject({ ok: false, code: "VALIDATION" });

    const begun = await playMove(userId, id, { kind: "begin" }, NOW);
    expect(begun).toMatchObject({ ok: true, data: { event: null } });
    const t0 = COUNTDOWN_MS + 500;

    const miss = await playMove(
      userId,
      id,
      { kind: "shoot", wave: 0, lane: 3 },
      at(t0),
    );
    expect(miss).toMatchObject({
      ok: true,
      data: { event: { kind: "miss", lane: 3, ended: false } },
    });
    if (!miss.ok) return;
    expect(miss.data.state.waves[0]?.k).toBeUndefined();

    // A retried copy counts once.
    const retry = await playMove(
      userId,
      id,
      { kind: "shoot", wave: 0, lane: 3 },
      at(t0 + 100),
    );
    expect(retry).toMatchObject({ data: { event: { kind: "stale" } } });

    const hit = await playMove(
      userId,
      id,
      { kind: "shoot", wave: 0, lane: 1 },
      at(t0 + 200),
    );
    expect(hit).toMatchObject({ data: { event: { kind: "hit", key: 1 } } });

    const t1 = t0 + 200 + BREAK_MS;
    await playMove(userId, id, { kind: "shoot", wave: 1, lane: 0 }, at(t1));
    // The zombie reaches the barricade on the last statement.
    const last = await playMove(
      userId,
      id,
      { kind: "timeout", wave: 2 },
      at(t1 + BREAK_MS + 20_000),
    );
    expect(last).toMatchObject({
      ok: true,
      data: {
        event: { kind: "timeout", key: 1 },
        state: { over: "won", misses: 2 },
        // mcq: first shot D was wrong (0); tf: 1 of 2 statements right.
        result: { score: 0.5, maxScore: 2 },
      },
    });

    const a = await row(id);
    expect(a).toMatchObject({
      status: "submitted",
      answers: ["D", [true, null]],
    });
    // A game is a test: it moves the rating.
    const events = await tdb
      .select()
      .from(ratingEvents)
      .where(eq(ratingEvents.attemptId, id));
    expect(events).toHaveLength(1);
    expect(
      await playMove(userId, id, { kind: "begin" }, at(t1 + 60_000)),
    ).toMatchObject({ ok: false, code: "ATTEMPT_CLOSED" });
  });

  it("one life: the first miss ends and grades the game", async () => {
    const id = await setup({ ...ZOMBIE, lives: 1 });
    await playMove(userId, id, { kind: "begin" }, NOW);
    const r = await playMove(
      userId,
      id,
      { kind: "shoot", wave: 0, lane: 0 },
      at(COUNTDOWN_MS),
    );
    expect(r).toMatchObject({
      ok: true,
      data: {
        event: { kind: "miss", ended: true, key: 1 },
        state: { over: "lost" },
        result: { score: 0 },
      },
    });
    expect((await row(id))?.status).toBe("submitted");
  });

  it("refuses other students and autosaves", async () => {
    const id = await setup(ZOMBIE);
    expect(
      await playMove(crypto.randomUUID(), id, { kind: "begin" }, NOW),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    const saved = await saveProgress(userId, id, {
      answers: ["B", null],
      flagged: [],
    });
    expect(saved.ok).toBe(false);
    expect((await row(id))?.answers).toEqual([null, null]);
  });
});
