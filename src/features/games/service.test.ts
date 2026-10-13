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
  type ZombieWave,
} from "@/db/schema";
import { createRng } from "@/features/attempts/domain/random";
import { expectedAnswer } from "@/features/grading/domain/grade";
import {
  DEFAULT_LESSON_CONFIG,
  type LessonConfig,
  type Question,
} from "@/features/lessons/schema";
import { BREAK_MS, waveKey } from "@/features/zombie/domain/engine";
import { resetDb, type TestDb } from "@/test/db";
import { gradingItem, optionCounts, playerPlan } from "./domain/bank";
import { COUNTDOWN_MS, FEEDBACK_MS, MAX_PLAYERS } from "./domain/rules";
import { sharedShownAt } from "./domain/scoring";
import { SHARED_LEAD_MS } from "./domain/zombie";
import { type CreateGameInput, CreateGameSchema } from "./schemas";
import {
  answerQuestion,
  createGame,
  endGame,
  joinGame,
  pollRoom,
  removePlayer,
  startGame,
  zombieMove,
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
    .select({ bank: gameRooms.bank, sameQuestion: gameRooms.sameQuestion })
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
    room?.sameQuestion,
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

describe("room settings (B-12)", () => {
  const id = (i: number) => students[i] as string;

  it("stores the settings, off by default", async () => {
    const plain = await newRoom();
    const strict = await newRoom({
      sameQuestion: true,
      lockJoin: true,
      lives: 3,
    });
    const rows = await tdb
      .select({
        id: gameRooms.id,
        sameQuestion: gameRooms.sameQuestion,
        lockJoin: gameRooms.lockJoin,
        lives: gameRooms.lives,
      })
      .from(gameRooms);
    expect(rows.find((r) => r.id === plain)).toMatchObject({
      sameQuestion: false,
      lockJoin: false,
      lives: null,
    });
    expect(rows.find((r) => r.id === strict)).toMatchObject({
      sameQuestion: true,
      lockJoin: true,
      lives: 3,
    });
  });

  it("a locked room takes no new players once started, but lets players back", async () => {
    const roomId = await newRoom({ lockJoin: true });
    await join(roomId, id(0));
    await startGame(host, roomId, NOW);
    expect(
      await joinGame({ id: id(1) }, { roomId, ...look }, at(1000)),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(
      await joinGame({ id: id(0) }, { roomId, ...look }, at(1000)),
    ).toMatchObject({ ok: true });
  });

  it("an open room still takes late players", async () => {
    const roomId = await newRoom();
    await join(roomId, id(0));
    await startGame(host, roomId, NOW);
    expect(
      await joinGame({ id: id(1) }, { roomId, ...look }, at(1000)),
    ).toMatchObject({ ok: true });
  });

  it("knocks a player out after their last life, and ranks them last", async () => {
    const roomId = await newRoom({ lives: 2 });
    await join(roomId, id(0));
    await join(roomId, id(1));
    await startGame(host, roomId, NOW);

    const first = await answerQuestion(
      id(0),
      roomId,
      { index: 0, answer: wrong(await keyAt(roomId, id(0), 0)) },
      at(Q1 + 1000),
    );
    expect(first).toMatchObject({
      ok: true,
      data: { lives: 1, eliminated: false, finished: false },
    });
    const second = await answerQuestion(
      id(0),
      roomId,
      { index: 1, answer: null },
      at(Q1 + 1000 + FEEDBACK_MS + 1000),
    );
    expect(second).toMatchObject({
      ok: true,
      data: { lives: 0, eliminated: true, finished: true, raceOver: false },
    });
    expect(
      await answerQuestion(
        id(0),
        roomId,
        { index: 2, answer: null },
        at(Q1 + 10_000),
      ),
    ).toMatchObject({ ok: false, code: "GAME_OVER" });

    // The other player has no points either but is still in: ranked first.
    const poll = await pollRoom(
      { id: id(1), role: "student" },
      roomId,
      -1,
      at(Q1 + 10_000),
    );
    if (!poll.ok || poll.data.kind !== "state") throw new Error("no state");
    expect(
      poll.data.state.players.map((p) => [p.name, p.eliminated, p.lives]),
    ).toEqual([
      ["Trần Thị Bình", false, 2],
      ["Nguyễn Văn An", true, 0],
    ]);
    expect(poll.data.state.settings).toEqual({
      sameQuestion: false,
      lockJoin: false,
      lives: 2,
    });
  });

  it("closes the race when the last player still in is knocked out", async () => {
    const roomId = await newRoom({ lives: 1 });
    await join(roomId, id(0));
    await startGame(host, roomId, NOW);
    const r = await answerQuestion(
      id(0),
      roomId,
      { index: 0, answer: null },
      at(Q1 + 1000),
    );
    expect(r).toMatchObject({
      ok: true,
      data: { eliminated: true, raceOver: true },
    });
  });

  describe("same question", () => {
    async function sharedRoom() {
      const roomId = await newRoom({ sameQuestion: true });
      await join(roomId, id(0));
      await join(roomId, id(1));
      await startGame(host, roomId, NOW);
      const [room] = await tdb
        .select({ bankTypes: gameRooms.bankTypes })
        .from(gameRooms)
        .where(eq(gameRooms.id, roomId));
      const shownAt = (i: number) =>
        sharedShownAt(NOW, room?.bankTypes ?? [], "normal", i);
      return { roomId, shownAt };
    }

    it("everyone meets the same question and waits for the class clock", async () => {
      const { roomId, shownAt } = await sharedRoom();
      const r = await answerQuestion(
        id(0),
        roomId,
        { index: 0, answer: await keyAt(roomId, id(0), 0) },
        at(Q1 + 1000),
      );
      expect(r).toMatchObject({ ok: true, data: { mark: { k: "correct" } } });
      if (!r.ok) return;
      // The next question appears on the shared clock, not 3 s after mine.
      expect(r.data.nextShownAt).toBe(shownAt(1).toISOString());
      // Too early for question 2.
      expect(
        await answerQuestion(
          id(0),
          roomId,
          { index: 1, answer: null },
          at(Q1 + 1000 + FEEDBACK_MS),
        ),
      ).toMatchObject({ ok: false, code: "CONFLICT" });
      const other = await answerQuestion(
        id(1),
        roomId,
        { index: 0, answer: await keyAt(roomId, id(1), 0) },
        at(Q1 + 5000),
      );
      expect(other).toMatchObject({
        ok: true,
        data: { mark: { k: "correct" } },
      });
      // Both answered the same bank question first.
      const marks = await tdb
        .select({ marks: gamePlayers.marks })
        .from(gamePlayers)
        .where(eq(gamePlayers.roomId, roomId));
      for (const m of marks) expect(m.marks[0]?.k).toBe("correct");
    });

    it("a player back from a closed tab answers the current question; the rest time out", async () => {
      const { roomId, shownAt } = await sharedRoom();
      // No skipping ahead while question 1 is still open.
      expect(
        await answerQuestion(
          id(1),
          roomId,
          { index: 1, answer: null },
          at(Q1 + 1000),
        ),
      ).toMatchObject({ ok: false, code: "CONFLICT" });
      const r = await answerQuestion(
        id(1),
        roomId,
        { index: 2, answer: await keyAt(roomId, id(1), 2) },
        new Date(shownAt(2).getTime() + 1000),
      );
      expect(r).toMatchObject({
        ok: true,
        data: { index: 2, answered: 3, mark: { k: "correct" } },
      });
      const [player] = await tdb
        .select({ marks: gamePlayers.marks, misses: gamePlayers.misses })
        .from(gamePlayers)
        .where(
          and(eq(gamePlayers.roomId, roomId), eq(gamePlayers.userId, id(1))),
        );
      expect(player?.marks.slice(0, 3).map((m) => m?.k)).toEqual([
        "timeout",
        "timeout",
        "correct",
      ]);
      expect(player?.misses).toBe(2);
    });
  });
});

describe("scheduled rooms (B-15)", () => {
  const MIN = 60_000;
  const due = at(10 * MIN);

  it("refuses a time too soon or too far ahead", async () => {
    for (const scheduledAt of [at(30_000), at(31 * 24 * 60 * MIN)])
      expect(
        await createGame(host, input({ scheduledAt }), { now: NOW, seed: 1 }),
      ).toMatchObject({
        ok: false,
        code: "VALIDATION",
        fieldErrors: { scheduledAt: expect.any(String) },
      });
  });

  it("waits in the lobby, then the first poll after the time starts it on the minute", async () => {
    const roomId = await newRoom({ scheduledAt: due });
    const student = { id: students[0] as string, role: "student" as const };
    await join(roomId, student.id, at(MIN));
    const before = await pollRoom(student, roomId, -1, at(5 * MIN));
    expect(before).toMatchObject({
      ok: true,
      data: {
        kind: "state",
        state: { status: "lobby", scheduledAt: due.toISOString() },
      },
    });
    const after = await pollRoom(student, roomId, -1, at(10 * MIN + 2000));
    expect(after).toMatchObject({
      ok: true,
      data: {
        kind: "state",
        state: { status: "running", startedAt: due.toISOString() },
      },
    });
    // The class answers on the scheduled clock.
    const r = await answerQuestion(
      student.id,
      roomId,
      { index: 0, answer: await keyAt(roomId, student.id, 0) },
      new Date(due.getTime() + COUNTDOWN_MS + 1000),
    );
    expect(r).toMatchObject({ ok: true, data: { mark: { k: "correct" } } });
  });

  it("a locked room plays with those who waited and refuses latecomers", async () => {
    const roomId = await newRoom({ scheduledAt: due, lockJoin: true });
    await join(roomId, students[0] as string, at(MIN));
    // Nobody polled: the late join itself starts the room, then is refused.
    expect(
      await joinGame(
        { id: students[1] as string },
        { roomId, ...look },
        at(20 * MIN),
      ),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    const [room] = await tdb
      .select({ status: gameRooms.status, startedAt: gameRooms.startedAt })
      .from(gameRooms)
      .where(eq(gameRooms.id, roomId));
    // Long after the time: started now, so nobody finds it half over.
    expect(room).toEqual({ status: "running", startedAt: at(20 * MIN) });
    // The player who waited is still in.
    expect(await join(roomId, students[0] as string, at(20 * MIN))).toEqual(
      expect.any(Number),
    );
  });

  it("the host may start it early", async () => {
    const roomId = await newRoom({ scheduledAt: due });
    await join(roomId, students[0] as string);
    expect(await startGame(host, roomId, at(MIN))).toEqual({
      ok: true,
      data: { startedAt: at(MIN).toISOString() },
    });
    expect(await pollRoom(host, roomId, -1, at(11 * MIN))).toMatchObject({
      ok: true,
      // Its schedule does not start it again.
      data: { state: { startedAt: at(MIN).toISOString() } },
    });
  });
});

describe("zombie rooms (B-14)", () => {
  const zombie = (patch: Partial<CreateGameInput> = {}) =>
    newRoom({
      mode: "zombie",
      lives: 3,
      seconds: 20,
      count: 6,
      types: ["mcq", "tf", "short"],
      ...patch,
    });

  /** The wave on screen for this player and the lane that is its key. */
  async function zombieKey(roomId: string, userId: string) {
    const [room] = await tdb
      .select({ bank: gameRooms.bank, sameQuestion: gameRooms.sameQuestion })
      .from(gameRooms)
      .where(eq(gameRooms.id, roomId));
    const [player] = await tdb
      .select({ seed: gamePlayers.seed, zombie: gamePlayers.zombie })
      .from(gamePlayers)
      .where(
        and(eq(gamePlayers.roomId, roomId), eq(gamePlayers.userId, userId)),
      );
    const bank = room?.bank ?? [];
    const questions = bank.map(
      (b) => questionsOf.get(b.l)?.find((q) => q.id === b.q) as Question,
    );
    const plan = playerPlan(
      optionCounts(questions),
      createRng(player?.seed ?? 0),
      room?.sameQuestion,
    );
    const state = player?.zombie;
    if (!state) throw new Error("not started");
    const wave = state.waves[state.wave] as ZombieWave;
    const bankIndex = plan.order[wave.i] as number;
    const key = waveKey(
      questions[bankIndex] as Question,
      gradingItem(bank[bankIndex] as GameBankItem, plan.options[bankIndex]),
      wave,
    );
    return {
      wave: state.wave,
      key,
      n: wave.n,
      at: state.at ?? 0,
      i: wave.i,
      bankIndex,
      misses: state.misses,
    };
  }

  /** Starts the room with both students in and both games begun. */
  async function playing(patch: Partial<CreateGameInput> = {}) {
    const roomId = await zombie(patch);
    for (const s of students) await join(roomId, s);
    await startGame(host, roomId, NOW);
    for (const s of students)
      expect(
        await zombieMove(s, roomId, { kind: "begin" }, at(1000)),
      ).toMatchObject({ ok: true, data: { event: null } });
    return roomId;
  }

  it("stores the mode, lives, clock and waves; draws mcq and tf only", async () => {
    const roomId = await zombie();
    const [room] = await tdb
      .select()
      .from(gameRooms)
      .where(eq(gameRooms.id, roomId));
    expect(room).toMatchObject({ mode: "zombie", lives: 3, seconds: 20 });
    expect(room?.bankTypes.every((ty) => ty !== "short")).toBe(true);
    // Five mcq and the four-statement tf.
    expect(room?.waves).toBe(9);
  });

  it("a hit scores and the move reports who is still standing", async () => {
    const roomId = await playing();
    const k = await zombieKey(roomId, students[0] as string);
    const r = await zombieMove(
      students[0] as string,
      roomId,
      { kind: "shoot", wave: k.wave, lane: k.key },
      new Date(k.at + 2000),
    );
    expect(r).toMatchObject({
      ok: true,
      data: {
        event: { kind: "hit", key: k.key },
        room: { alive: 2, total: 2, rank: 1 },
      },
    });
    if (!r.ok) return;
    expect(r.data.room.score).toBeGreaterThan(900);
    // The double tap counts once.
    const again = await zombieMove(
      students[0] as string,
      roomId,
      { kind: "shoot", wave: k.wave, lane: k.key },
      new Date(k.at + 2100),
    );
    expect(again).toMatchObject({
      ok: true,
      data: { event: { kind: "stale" } },
    });
    const [p] = await tdb
      .select({
        answered: gamePlayers.answered,
        correct: gamePlayers.correct,
        score: gamePlayers.score,
      })
      .from(gamePlayers)
      .where(eq(gamePlayers.userId, students[0] as string));
    expect(p).toMatchObject({
      answered: 1,
      correct: 1,
      score: r.data.room.score,
    });
  });

  it("the race's answer route is refused in a zombie room", async () => {
    const roomId = await playing();
    expect(
      await answerQuestion(
        students[0] as string,
        roomId,
        { index: 0, answer: "A" },
        at(Q1),
      ),
    ).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("out of lives knocks the player out; the longest survivor ranks first", async () => {
    const roomId = await playing({ lives: 1 });
    const [a, b] = students as [string, string];
    // a survives one wave, then misses; b misses the first.
    let k = await zombieKey(roomId, a);
    await zombieMove(
      a,
      roomId,
      { kind: "shoot", wave: k.wave, lane: k.key },
      new Date(k.at + 1000),
    );
    k = await zombieKey(roomId, a);
    const outA = await zombieMove(
      a,
      roomId,
      { kind: "shoot", wave: k.wave, lane: (k.key + 1) % k.n },
      new Date(k.at + 1000),
    );
    expect(outA).toMatchObject({
      ok: true,
      data: { state: { over: "lost" }, room: { alive: 1, total: 2 } },
    });
    const kb = await zombieKey(roomId, b);
    await zombieMove(
      b,
      roomId,
      { kind: "shoot", wave: kb.wave, lane: (kb.key + 1) % kb.n },
      new Date(kb.at + 1000),
    );
    // Everyone is down: the room closes itself.
    const [room] = await tdb
      .select({ status: gameRooms.status })
      .from(gameRooms)
      .where(eq(gameRooms.id, roomId));
    expect(room?.status).toBe("finished");
    const poll = await pollRoom(host, roomId, -1, at(60_000));
    if (!poll.ok || poll.data.kind !== "state") throw new Error("no state");
    const { state } = poll.data;
    expect(state).toMatchObject({
      mode: "zombie",
      zombie: { waves: 9, seconds: 20 },
    });
    expect(
      state.players.map((p) => [p.name, p.answered, p.eliminated, p.rank]),
    ).toEqual([
      ["Nguyễn Văn An", 1, true, 1],
      ["Trần Thị Bình", 0, true, 2],
    ]);
    // A move after the end is refused.
    expect(
      await zombieMove(a, roomId, { kind: "begin" }, at(61_000)),
    ).toMatchObject({ ok: false, code: "GAME_OVER" });
  });

  it("moves wait for the room to start and stop when the host ends it", async () => {
    const roomId = await zombie();
    await join(roomId, students[0] as string);
    expect(
      await zombieMove(students[0] as string, roomId, { kind: "begin" }, NOW),
    ).toMatchObject({ ok: false, code: "GAME_OVER" });
    await startGame(host, roomId, NOW);
    await endGame(host, roomId, at(5000));
    expect(
      await zombieMove(
        students[0] as string,
        roomId,
        { kind: "begin" },
        at(6000),
      ),
    ).toMatchObject({ ok: false, code: "GAME_OVER" });
  });

  describe("same question (B-15)", () => {
    /** One wave on the class clock: 20 s plus the break. */
    const STEP = 20_000 + BREAK_MS;
    const clock = NOW.getTime() + SHARED_LEAD_MS;

    it("needs a clock per wave", () => {
      const base = {
        title: "",
        lessonIds: [1],
        count: 5,
        types: ["mcq"],
        mode: "zombie",
        lives: 3,
        sameQuestion: true,
      };
      expect(CreateGameSchema.safeParse(base).success).toBe(false);
      expect(CreateGameSchema.safeParse({ ...base, seconds: 20 }).success).toBe(
        true,
      );
    });

    it("everyone meets the same wave, and an early hit waits for the class", async () => {
      const roomId = await playing({ sameQuestion: true });
      const a = await zombieKey(roomId, students[0] as string);
      const b = await zombieKey(roomId, students[1] as string);
      // The bank's order for all, on one clock that leaves time to start.
      expect([a.i, a.bankIndex]).toEqual([b.i, b.bankIndex]);
      expect(a.at).toBe(clock);
      expect(b.at).toBe(clock);
      const r = await zombieMove(
        students[0] as string,
        roomId,
        { kind: "shoot", wave: 0, lane: a.key },
        new Date(clock + 2000),
      );
      expect(r).toMatchObject({ ok: true, data: { event: { kind: "hit" } } });
      if (!r.ok) return;
      // The next wave starts with the class, not after the hit's break.
      expect(r.data.state.at).toBe(clock + STEP);
      // Too early to shoot it.
      const next = await zombieKey(roomId, students[0] as string);
      expect(
        await zombieMove(
          students[0] as string,
          roomId,
          { kind: "shoot", wave: 1, lane: next.key },
          new Date(clock + 5000),
        ),
      ).toMatchObject({ ok: false, code: "VALIDATION" });
    });

    it("waves a player let pass are timeouts that cost a life", async () => {
      const roomId = await zombie({ sameQuestion: true });
      for (const s of students) await join(roomId, s);
      await startGame(host, roomId, NOW);
      // "Bắt đầu" two waves late: both are lost to the zombies.
      const late = new Date(clock + 2 * STEP + 1000);
      const r = await zombieMove(
        students[0] as string,
        roomId,
        { kind: "begin" },
        late,
      );
      expect(r).toMatchObject({ ok: true, data: { state: { wave: 2 } } });
      if (!r.ok) return;
      expect(r.data.state.misses).toBe(2);
      expect(r.data.state.waves.slice(0, 2).map((w) => w.e)).toEqual([
        "timeout",
        "timeout",
      ]);
      expect(r.data.state.at).toBe(clock + 2 * STEP);
    });

    it("a late joiner skips the waves that closed before they came", async () => {
      const roomId = await zombie({ sameQuestion: true });
      await join(roomId, students[0] as string);
      await startGame(host, roomId, NOW);
      const came = new Date(clock + STEP + 5000);
      await join(roomId, students[1] as string, came);
      const r = await zombieMove(
        students[1] as string,
        roomId,
        { kind: "begin" },
        new Date(came.getTime() + 1000),
      );
      expect(r).toMatchObject({
        ok: true,
        data: { state: { wave: 1, misses: 0 } },
      });
      if (!r.ok) return;
      expect(r.data.state.waves[0]?.e).toBeUndefined();
      expect(r.data.state.at).toBe(clock + STEP);
    });
  });

  it("a race room refuses zombie moves", async () => {
    const roomId = await newRoom();
    await join(roomId, students[0] as string);
    await startGame(host, roomId, NOW);
    expect(
      await zombieMove(students[0] as string, roomId, { kind: "begin" }, NOW),
    ).toMatchObject({ ok: false, code: "CONFLICT" });
  });
});
