import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  type AttemptAnswer,
  auditLog,
  type GameBankItem,
  gamePlayers,
  gameRooms,
  lessons,
  lessonVersions,
  users,
} from "@/db/schema";
import { createRng } from "@/features/attempts/domain/random";
import { expectedAnswer } from "@/features/grading/domain/grade";
import {
  DEFAULT_LESSON_CONFIG,
  type LessonConfig,
  type Question,
} from "@/features/lessons/schema";
import { resetDb, type TestDb } from "@/test/db";
import { gradingItem, optionCounts, playerPlan } from "./domain/bank";
import { COUNTDOWN_MS, FEEDBACK_MS, MAX_PLAYERS } from "./domain/rules";
import type { CreateGameInput } from "./schemas";
import {
  answerQuestion,
  createGame,
  endGame,
  joinGame,
  pollRoom,
  removePlayer,
  startGame,
} from "./service";

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

/**
 * Game rooms (B-05) against a real Postgres (PGlite): lesson eligibility,
 * joining, server-timed scoring, idempotent answers, the auto-finish and the
 * `rev` poll.
 */

const tdb = db as unknown as TestDb;
const NOW = new Date("2026-10-06T02:00:00Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);
/** The first question appears this long after the start. */
const Q1 = COUNTDOWN_MS;

const mcq = (id: string): Question => ({
  id,
  type: "mcq",
  stem: `Câu ${id}?`,
  options: [{ text: "đúng" }, { text: "b" }, { text: "c" }, { text: "d" }],
  answer: 0,
});
const tf: Question = {
  id: "q_tf",
  type: "tf",
  stem: "Phát biểu",
  statements: [
    { text: "a", answer: true },
    { text: "b", answer: false },
    { text: "c", answer: true },
    { text: "d", answer: false },
  ],
};

let host: { id: string; role: "teacher" | "admin" };
let students: string[];
let lessonA: number;
let lessonB: number;
const questionsOf = new Map<number, Question[]>();

async function addUser(
  phone: string,
  role: "student" | "teacher" | "admin" = "student",
  fullName = "Học Sinh",
) {
  const [u] = await tdb
    .insert(users)
    .values({
      role,
      status: "active",
      fullName,
      phone,
      passwordHash: "x",
    })
    .returning({ id: users.id });
  return u?.id ?? "";
}

async function addLesson(
  questions: Question[],
  config: Partial<LessonConfig> = {},
) {
  const [lesson] = await tdb
    .insert(lessons)
    .values({
      title: `Bài ${questions.length}`,
      status: "published",
      config: { ...DEFAULT_LESSON_CONFIG, ...config },
      ownerId: host.id,
    })
    .returning({ id: lessons.id });
  const id = lesson?.id ?? 0;
  const [version] = await tdb
    .insert(lessonVersions)
    .values({ lessonId: id, version: 1, sourceText: "", questions })
    .returning({ id: lessonVersions.id });
  await tdb
    .update(lessons)
    .set({ currentVersionId: version?.id ?? 0 })
    .where(eq(lessons.id, id));
  questionsOf.set(id, questions);
  return id;
}

const input = (patch: Partial<CreateGameInput> = {}): CreateGameInput => ({
  title: null,
  lessonIds: [lessonA, lessonB],
  count: 5,
  pace: "normal",
  types: ["mcq", "tf"],
  ...patch,
});

async function newRoom(patch: Partial<CreateGameInput> = {}) {
  const r = await createGame(host, input(patch), { now: NOW, seed: 1 });
  if (!r.ok) throw new Error(r.code);
  return r.data.roomId;
}

const look = { racer: "car", color: 2 } as const;

async function join(roomId: string, userId: string, now = NOW) {
  const r = await joinGame({ id: userId }, { roomId, ...look }, now);
  if (!r.ok) throw new Error(r.code);
  return r.data.playerId;
}

/** The answer that scores full marks at position `index` for this player. */
async function keyAt(
  roomId: string,
  userId: string,
  index: number,
): Promise<AttemptAnswer> {
  const [room] = await tdb
    .select({ bank: gameRooms.bank })
    .from(gameRooms)
    .where(eq(gameRooms.id, roomId));
  const [player] = await tdb
    .select({ seed: gamePlayers.seed })
    .from(gamePlayers)
    .where(and(eq(gamePlayers.roomId, roomId), eq(gamePlayers.userId, userId)));
  const bank = room?.bank ?? [];
  const questions = bank.map(
    (b) => questionsOf.get(b.l)?.find((q) => q.id === b.q) as Question,
  );
  const plan = playerPlan(
    optionCounts(questions),
    createRng(player?.seed ?? 0),
  );
  const bankIndex = plan.order[index] as number;
  return expectedAnswer(
    questions[bankIndex] as Question,
    gradingItem(bank[bankIndex] as GameBankItem, plan.options[bankIndex]),
  );
}

/** A wrong mcq letter, or every tf statement flipped. */
function wrong(key: AttemptAnswer): AttemptAnswer {
  if (Array.isArray(key)) return key.map((b) => !b);
  return key === "A" ? "B" : "A";
}

beforeEach(async () => {
  await resetDb(tdb);
  questionsOf.clear();
  host = {
    id: await addUser("0900000000", "teacher", "Cô Giáo"),
    role: "teacher",
  };
  students = [
    await addUser("0900000001", "student", "Nguyễn Văn An"),
    await addUser("0900000002", "student", "Trần Thị Bình"),
  ];
  lessonA = await addLesson([mcq("q_1"), mcq("q_2"), mcq("q_3"), tf]);
  lessonB = await addLesson([mcq("q_1"), mcq("q_9")]);
});

describe("createGame", () => {
  it("draws the bank across lessons and opens a lobby with a PIN", async () => {
    const r = await createGame(host, input({ count: 6 }), {
      now: NOW,
      seed: 3,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.pin).toMatch(/^[1-9]\d{5}$/);
    const [room] = await tdb
      .select()
      .from(gameRooms)
      .where(eq(gameRooms.id, r.data.roomId));
    expect(room).toMatchObject({
      status: "lobby",
      title: "Bài 4 (+1 bài)",
      pace: "normal",
      lessonIds: [lessonA, lessonB],
    });
    expect(room?.bank).toHaveLength(6);
    // q_1 exists in both lessons: kept apart by lesson id.
    expect(room?.bank.filter((b) => b.q === "q_1")).toHaveLength(2);
    expect(room?.bankTypes.filter((t) => t === "tf")).toHaveLength(1);
    const audit = await tdb.select().from(auditLog);
    expect(audit).toMatchObject([
      { action: "game.create", targetId: r.data.roomId },
    ]);
  });

  it("only the allowed types; fewer than five is refused", async () => {
    const r = await createGame(host, input({ types: ["tf"] }), { now: NOW });
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    if (!r.ok) expect(r.fieldErrors?.count).toContain("1");
  });

  it("refuses lessons whose answers are hidden or not open yet", async () => {
    const hidden = await addLesson([mcq("q_1")], { revealAnswers: "never" });
    const scheduled = await addLesson([mcq("q_1")], {
      startsAt: "2026-10-07T00:00:00Z",
    });
    for (const id of [hidden, scheduled]) {
      const r = await createGame(host, input({ lessonIds: [lessonA, id] }), {
        now: NOW,
      });
      expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
      if (!r.ok) expect(r.fieldErrors).toHaveProperty("lessonIds");
    }
    expect(await tdb.select().from(gameRooms)).toHaveLength(0);
  });

  it("draws another PIN when one is taken by an open room", async () => {
    const pins = ["111111", "111111", "222222"];
    const pin = () => pins.shift() ?? "333333";
    const a = await createGame(host, input(), { now: NOW, pin });
    const b = await createGame(host, input(), { now: NOW, pin });
    expect(a).toMatchObject({ ok: true, data: { pin: "111111" } });
    expect(b).toMatchObject({ ok: true, data: { pin: "222222" } });
  });

  it("a finished room's PIN can be used again", async () => {
    const pin = () => "444444";
    const a = await createGame(host, input(), { now: NOW, pin });
    if (!a.ok) throw new Error();
    await endGame(host, a.data.roomId, NOW);
    const b = await createGame(host, input(), { now: NOW, pin });
    expect(b).toMatchObject({ ok: true, data: { pin: "444444" } });
  });
});

describe("joinGame", () => {
  it("joins, and a second join in the lobby only changes the racer", async () => {
    const roomId = await newRoom();
    const id = await join(roomId, students[0] as string);
    const again = await joinGame(
      { id: students[0] as string },
      { roomId, racer: "rocket", color: 5 },
      NOW,
    );
    expect(again).toMatchObject({ ok: true, data: { playerId: id } });
    const rows = await tdb.select().from(gamePlayers);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ racer: "rocket", color: 5, answered: 0 });
    expect(rows[0]?.marks).toEqual([null, null, null, null, null]);
  });

  it("refuses a finished room, a full room and a removed player", async () => {
    const roomId = await newRoom();
    const playerId = await join(roomId, students[0] as string);
    await removePlayer(host, roomId, playerId, NOW);
    expect(
      await joinGame({ id: students[0] as string }, { roomId, ...look }, NOW),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });

    const others = await Promise.all(
      Array.from({ length: MAX_PLAYERS }, (_, i) =>
        addUser(`091${String(i).padStart(7, "0")}`),
      ),
    );
    await tdb.insert(gamePlayers).values(
      others.map((userId) => ({
        roomId,
        userId,
        racer: "car",
        color: 0,
        seed: 1,
        marks: [],
      })),
    );
    expect(
      await joinGame({ id: students[1] as string }, { roomId, ...look }, NOW),
    ).toMatchObject({ ok: false, code: "GAME_FULL" });

    await endGame(host, roomId, NOW);
    expect(
      await joinGame({ id: students[1] as string }, { roomId, ...look }, NOW),
    ).toMatchObject({ ok: false, code: "GAME_OVER" });
  });

  it("an unknown room is NOT_FOUND", async () => {
    expect(
      await joinGame(
        { id: students[0] as string },
        { roomId: crypto.randomUUID(), ...look },
        NOW,
      ),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("other teachers (B-03)", () => {
  it("can't draw from another teacher's lessons or control their room", async () => {
    const other = {
      id: await addUser("0900000088", "teacher", "Thầy khác"),
      role: "teacher" as const,
    };
    expect(
      await createGame(other, input(), { now: NOW, seed: 1 }),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
    const roomId = await newRoom();
    await join(roomId, students[0] as string);
    expect(await startGame(other, roomId, NOW)).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await endGame(other, roomId, NOW)).toMatchObject({
      code: "NOT_FOUND",
    });
    const [player] = await tdb.select().from(gamePlayers);
    expect(
      await removePlayer(other, roomId, player?.id ?? 0, NOW),
    ).toMatchObject({ code: "NOT_FOUND" });
    expect(await pollRoom(other, roomId, -1, NOW)).toMatchObject({
      code: "FORBIDDEN",
    });
    const [room] = await tdb.select().from(gameRooms);
    expect(room?.status).toBe("lobby");
    // An admin runs any room.
    const admin = {
      id: await addUser("0900000089", "admin", "Quản trị"),
      role: "admin" as const,
    };
    expect(await startGame(admin, roomId, NOW)).toMatchObject({ ok: true });
  });
});

describe("startGame and endGame", () => {
  it("needs a player, then runs with a hard end", async () => {
    const roomId = await newRoom();
    expect(await startGame(host, roomId, NOW)).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    await join(roomId, students[0] as string);
    expect(await startGame(host, roomId, NOW)).toMatchObject({ ok: true });
    // A second click is harmless.
    expect(await startGame(host, roomId, at(500))).toMatchObject({
      ok: true,
      data: { startedAt: NOW.toISOString() },
    });
    const [room] = await tdb
      .select()
      .from(gameRooms)
      .where(eq(gameRooms.id, roomId));
    expect(room?.status).toBe("running");
    expect(room?.hardEndAt?.getTime()).toBeGreaterThan(NOW.getTime());
    expect(await endGame(host, roomId, at(1000))).toMatchObject({ ok: true });
    expect(await startGame(host, roomId, at(2000))).toMatchObject({
      ok: false,
      code: "GAME_OVER",
    });
    expect(await endGame(host, crypto.randomUUID())).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});

describe("answerQuestion", () => {
  async function runningRoom(players = 1) {
    const roomId = await newRoom();
    for (const s of students.slice(0, players)) await join(roomId, s);
    await startGame(host, roomId, NOW);
    return roomId;
  }

  it("a fast right answer earns 1000 and returns the key", async () => {
    const roomId = await runningRoom();
    const me = students[0] as string;
    const key = await keyAt(roomId, me, 0);
    const r = await answerQuestion(
      me,
      roomId,
      { index: 0, answer: key },
      at(Q1 + 100),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({
      index: 0,
      mark: { k: "correct", s: 998 },
      expected: key,
      score: 998,
      answered: 1,
      correct: 1,
      streak: 1,
      finished: false,
      raceOver: false,
    });
    expect(r.data.view.me).toMatchObject({ rank: 1, score: 998 });
    expect(r.data.nextShownAt).toBe(at(Q1 + 100 + FEEDBACK_MS).toISOString());
  });

  it("counts a retried or parallel answer once", async () => {
    const roomId = await runningRoom();
    const me = students[0] as string;
    const key = await keyAt(roomId, me, 0);
    const [a, b] = await Promise.all([
      answerQuestion(me, roomId, { index: 0, answer: key }, at(Q1 + 1000)),
      answerQuestion(me, roomId, { index: 0, answer: key }, at(Q1 + 1000)),
    ]);
    const c = await answerQuestion(
      me,
      roomId,
      { index: 0, answer: wrong(key) },
      at(Q1 + 5000),
    );
    for (const r of [a, b, c])
      expect(r).toMatchObject({
        ok: true,
        data: { mark: { k: "correct", s: 975 }, score: 975, answered: 1 },
      });
    const [row] = await tdb.select().from(gamePlayers);
    expect(row).toMatchObject({ answered: 1, score: 975, correct: 1 });
  });

  it("streaks add a bonus; a wrong answer breaks them", async () => {
    const roomId = await runningRoom();
    const me = students[0] as string;
    let t = Q1;
    const results = [];
    for (const [i, right] of [true, true, false, true].entries()) {
      const key = await keyAt(roomId, me, i);
      const r = await answerQuestion(
        me,
        roomId,
        { index: i, answer: right ? key : wrong(key) },
        at(t),
      );
      if (!r.ok) throw new Error(r.code);
      results.push([r.data.mark.k, r.data.streak]);
      t += FEEDBACK_MS;
    }
    expect(results.map(([k]) => k)).toEqual([
      "correct",
      "correct",
      "wrong",
      "correct",
    ]);
    expect(results.map(([, s]) => s)).toEqual([1, 2, 0, 1]);
    const [row] = await tdb.select().from(gamePlayers);
    expect(row?.bestStreak).toBe(2);
    // 1000 + (1000 + 20 bonus) + 0 + 1000.
    expect(row?.score).toBe(3020);
    expect(row?.marks.filter(Boolean)).toHaveLength(4);
  });

  it("a timed-out answer scores nothing", async () => {
    const roomId = await runningRoom();
    const me = students[0] as string;
    const key = await keyAt(roomId, me, 0);
    const r = await answerQuestion(
      me,
      roomId,
      { index: 0, answer: key },
      at(Q1 + 120_000),
    );
    expect(r).toMatchObject({
      ok: true,
      data: { mark: { k: "timeout", s: 0 } },
    });
  });

  it("refuses skipping ahead, strangers and a finished race", async () => {
    const roomId = await runningRoom();
    const me = students[0] as string;
    expect(
      await answerQuestion(me, roomId, { index: 2, answer: "A" }, at(Q1)),
    ).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(
      await answerQuestion(me, roomId, { index: 9, answer: "A" }, at(Q1)),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(
      await answerQuestion(
        students[1] as string,
        roomId,
        { index: 0, answer: "A" },
        at(Q1),
      ),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    await endGame(host, roomId, at(Q1));
    expect(
      await answerQuestion(me, roomId, { index: 0, answer: "A" }, at(Q1 + 10)),
    ).toMatchObject({ ok: false, code: "GAME_OVER" });
  });

  it("can't answer in the lobby", async () => {
    const roomId = await newRoom();
    await join(roomId, students[0] as string);
    expect(
      await answerQuestion(
        students[0] as string,
        roomId,
        { index: 0, answer: "A" },
        NOW,
      ),
    ).toMatchObject({ ok: false, code: "GAME_OVER" });
  });

  it("the room finishes when the last player crosses the line", async () => {
    const roomId = await runningRoom(2);
    const [a, b] = students as [string, string];
    let t = Q1;
    for (let i = 0; i < 5; i++) {
      const r = await answerQuestion(
        a,
        roomId,
        { index: i, answer: await keyAt(roomId, a, i) },
        at(t),
      );
      expect(r).toMatchObject({ ok: true, data: { raceOver: false } });
      t += FEEDBACK_MS;
    }
    const [mid] = await tdb.select().from(gameRooms);
    expect(mid?.status).toBe("running");
    let last: Awaited<ReturnType<typeof answerQuestion>> | undefined;
    t = Q1;
    for (let i = 0; i < 5; i++) {
      last = await answerQuestion(b, roomId, { index: i, answer: null }, at(t));
      t += FEEDBACK_MS;
    }
    expect(last).toMatchObject({
      ok: true,
      data: { finished: true, raceOver: true, score: 0 },
    });
    if (last?.ok) {
      expect(last.data.view.me).toMatchObject({ rank: 2, finished: true });
      expect(last.data.view.ahead?.name).toBe("Nguyễn Văn An");
    }
    const [room] = await tdb.select().from(gameRooms);
    expect(room?.status).toBe("finished");
  });

  it("removing the last unfinished player finishes the race", async () => {
    const roomId = await runningRoom(2);
    const [a] = students as [string, string];
    let t = Q1;
    for (let i = 0; i < 5; i++) {
      await answerQuestion(a, roomId, { index: i, answer: null }, at(t));
      t += FEEDBACK_MS;
    }
    const [b] = await tdb
      .select({ id: gamePlayers.id })
      .from(gamePlayers)
      .where(eq(gamePlayers.userId, students[1] as string));
    expect(await removePlayer(host, roomId, b?.id ?? 0, at(t))).toMatchObject({
      ok: true,
    });
    const [room] = await tdb.select().from(gameRooms);
    expect(room?.status).toBe("finished");
    expect(await removePlayer(host, roomId, b?.id ?? 0, at(t))).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});

describe("pollRoom", () => {
  const student = (id: string) => ({ id, role: "student" as const });

  it("sends the state, then 'unchanged' for the same rev", async () => {
    const roomId = await newRoom();
    await join(roomId, students[0] as string);
    const first = await pollRoom(
      student(students[0] as string),
      roomId,
      -1,
      at(0),
    );
    expect(first.ok).toBe(true);
    if (!first.ok || first.data.kind !== "state") throw new Error();
    const { state } = first.data;
    expect(state).toMatchObject({
      status: "lobby",
      questionCount: 5,
      startedAt: null,
    });
    expect(state.players).toMatchObject([
      { name: "Nguyễn Văn An", racer: "car", color: 2, rank: 1 },
    ]);
    expect(state.meId).toBe(state.players[0]?.id);
    expect(JSON.stringify(state)).not.toContain(students[0]);
    expect(
      await pollRoom(student(students[0] as string), roomId, state.rev, at(10)),
    ).toEqual({ ok: true, data: { kind: "unchanged" } });
  });

  it("strangers are refused, the host is not", async () => {
    const roomId = await newRoom();
    expect(
      await pollRoom(student(students[1] as string), roomId, -1, at(0)),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    const asHost = await pollRoom(host, roomId, -1, at(0));
    expect(asHost).toMatchObject({
      ok: true,
      data: { kind: "state", state: { meId: null, players: [] } },
    });
    expect(
      await pollRoom(student(students[0] as string), crypto.randomUUID(), -1),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("a player who joined on another instance is found fresh", async () => {
    const roomId = await newRoom();
    // Prime the snapshot without the player, then join "elsewhere".
    await pollRoom(host, roomId, -1, at(0));
    await tdb.insert(gamePlayers).values({
      roomId,
      userId: students[0] as string,
      racer: "cat",
      color: 1,
      seed: 7,
      marks: [null, null, null, null, null],
    });
    const r = await pollRoom(
      student(students[0] as string),
      roomId,
      -1,
      at(100),
    );
    expect(r).toMatchObject({ ok: true, data: { kind: "state" } });
  });

  it("a race past its hard end reads as finished", async () => {
    const roomId = await newRoom();
    await join(roomId, students[0] as string);
    await startGame(host, roomId, NOW);
    const [room] = await tdb.select().from(gameRooms);
    const r = await pollRoom(
      student(students[0] as string),
      roomId,
      room?.rev ?? 0,
      new Date((room?.hardEndAt?.getTime() ?? 0) + 1),
    );
    expect(r).toMatchObject({
      ok: true,
      data: { kind: "state", state: { status: "finished" } },
    });
  });
});
