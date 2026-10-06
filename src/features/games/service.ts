import "server-only";
import { randomInt } from "node:crypto";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { gamePlayers, gameRooms } from "@/db/schema";
import { createRng } from "@/features/attempts/domain/random";
import {
  expectedAnswer,
  gradeItem,
  isBlank,
} from "@/features/grading/domain/grade";
import { getLessonWithAnswers } from "@/features/lessons/queries";
import {
  LessonConfigSchema,
  type Question,
  type QuestionType,
} from "@/features/lessons/schema";
import { writeAudit } from "@/lib/audit";
import { pgErrorCode } from "@/lib/pg-error";
import { rateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import {
  type BankCandidate,
  type BankItem,
  drawBank,
  gradingItem,
  lessonAllowsGame,
  optionCounts,
  playerPlan,
} from "./domain/bank";
import {
  generatePin,
  MAX_PLAYERS,
  MIN_QUESTIONS,
  type Pace,
} from "./domain/rules";
import {
  effectiveStatus,
  type GameMark,
  limitMs,
  questionShownAt,
  raceHardEnd,
  scoreAnswer,
} from "./domain/scoring";
import {
  playerView,
  rankPlayers,
  type StandingInput,
} from "./domain/standings";
import { gameCopy as t } from "./messages";
import {
  forgetSnapshot,
  getGameLessonChoices,
  getPlayer,
  getRoom,
  getRoomSnapshot,
  type RoomRow,
  type SnapshotPlayer,
} from "./queries";
import type {
  CreateGameInput,
  GameAnswerInput,
  JoinGameInput,
} from "./schemas";
import type { AnswerOutcome, RoomState } from "./types";

/** 06 §4. Tune here only; the integration tests read these values. */
export const GAME_LIMITS = {
  createPerHost: [10, "1m"],
  joinPerUser: [20, "1m"],
  /** Wrong PINs: stops a student walking the PIN space. */
  pinMissPerUser: [20, "10m"],
} as const;

const UNIQUE_VIOLATION = "23505";

type Actor = { id: string };

/**
 * "Tạo phòng" (B-05): draws the bank from the chosen lessons and opens a
 * lobby with a fresh PIN. Only lessons whose keys may be shown now take part
 * (`lessonAllowsGame`): a race shows the key after every answer.
 */
export async function createGame(
  host: Actor,
  input: CreateGameInput,
  {
    now = new Date(),
    seed = randomInt(0, 2 ** 32),
    pin = () => generatePin(randomInt),
  }: { now?: Date; seed?: number; pin?: () => string } = {},
): Promise<Result<{ roomId: string; pin: string }>> {
  const limit = await rateLimit(
    `game:create:${host.id}`,
    ...GAME_LIMITS.createPerHost,
    now,
  );
  if (!limit.ok) return err("RATE_LIMITED");

  const wanted = new Set(input.lessonIds);
  const chosen = (await getGameLessonChoices()).filter((l) => {
    if (!wanted.has(l.id)) return false;
    const config = LessonConfigSchema.safeParse(l.config);
    return config.success && lessonAllowsGame(config.data, now);
  });
  if (chosen.length !== wanted.size)
    return err("VALIDATION", {
      fieldErrors: { lessonIds: t.create.lessonUnavailable },
    });

  const candidates: BankCandidate[] = [];
  for (const lesson of chosen) {
    const questions = await getLessonWithAnswers(lesson.id, lesson.versionId);
    for (const question of questions ?? [])
      candidates.push({
        lessonId: lesson.id,
        versionId: lesson.versionId,
        question,
      });
  }
  const types = new Map(
    candidates.map((c) => [`${c.lessonId}:${c.question.id}`, c.question.type]),
  );
  const bank = drawBank(candidates, input.types, input.count, createRng(seed));
  if (bank.length < MIN_QUESTIONS)
    return err("VALIDATION", {
      fieldErrors: { count: t.create.notEnough(bank.length) },
    });
  const bankTypes = bank.map((b) => types.get(`${b.l}:${b.q}`) as QuestionType);
  const first = chosen.find((l) => l.id === input.lessonIds[0]);
  const title =
    input.title ?? t.create.defaultTitle(first?.title ?? "", chosen.length - 1);

  for (let tries = 0; tries < 5; tries++) {
    const code = pin();
    try {
      const roomId = await db.transaction(async (tx) => {
        const [room] = await tx
          .insert(gameRooms)
          .values({
            pin: code,
            hostId: host.id,
            title,
            pace: input.pace,
            bank,
            bankTypes,
            lessonIds: chosen.map((l) => l.id),
            createdAt: now,
          })
          .returning({ id: gameRooms.id });
        if (!room) throw new Error("game room insert returned nothing");
        await writeAudit(tx, {
          actorId: host.id,
          action: "game.create",
          targetType: "game",
          targetId: room.id,
          data: { lessons: chosen.length, questions: bank.length },
        });
        return room.id;
      });
      return ok({ roomId, pin: code });
    } catch (error) {
      // PIN taken by an open room: draw another.
      if (pgErrorCode(error) !== UNIQUE_VIOLATION) throw error;
    }
  }
  return err("CONFLICT");
}

const bumpRev = { rev: sql`${gameRooms.rev} + 1` };

/**
 * Joins a room, or changes racer while still in the lobby. Joining a race
 * already running is allowed: the late player starts with their own
 * countdown. A player the host removed can't come back.
 */
export async function joinGame(
  user: Actor,
  input: JoinGameInput,
  now = new Date(),
): Promise<Result<{ playerId: number }>> {
  const limit = await rateLimit(
    `game:join:${user.id}`,
    ...GAME_LIMITS.joinPerUser,
    now,
  );
  if (!limit.ok) return err("RATE_LIMITED");
  const room = await getRoom(input.roomId);
  if (!room) return err("NOT_FOUND", { message: t.play.notFound });
  if (effectiveStatus(room, now) === "finished") return err("GAME_OVER");

  const existing = await getPlayer(room.id, user.id);
  if (existing?.removedAt) return err("FORBIDDEN", { message: t.play.removed });
  if (existing) {
    if (room.status === "lobby")
      await db.transaction(async (tx) => {
        await tx
          .update(gamePlayers)
          .set({ racer: input.racer, color: input.color })
          .where(eq(gamePlayers.id, existing.id));
        await tx
          .update(gameRooms)
          .set(bumpRev)
          .where(eq(gameRooms.id, room.id));
      });
    forgetSnapshot(room.id);
    return ok({ playerId: existing.id });
  }

  const [players] = await db
    .select({ n: count() })
    .from(gamePlayers)
    .where(and(eq(gamePlayers.roomId, room.id), isNull(gamePlayers.removedAt)));
  if ((players?.n ?? 0) >= MAX_PLAYERS) return err("GAME_FULL");

  const playerId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(gamePlayers)
      .values({
        roomId: room.id,
        userId: user.id,
        racer: input.racer,
        color: input.color,
        seed: randomInt(0, 2 ** 32),
        marks: room.bankTypes.map(() => null),
        joinedAt: now,
      })
      // A double click: the first insert wins.
      .onConflictDoNothing()
      .returning({ id: gamePlayers.id });
    if (created)
      await tx.update(gameRooms).set(bumpRev).where(eq(gameRooms.id, room.id));
    return created?.id ?? null;
  });
  forgetSnapshot(room.id);
  if (playerId !== null) return ok({ playerId });
  const winner = await getPlayer(room.id, user.id);
  return winner ? ok({ playerId: winner.id }) : err("CONFLICT");
}

/** "Bắt đầu": lobby → running, with at least one player. */
export async function startGame(
  roomId: string,
  now = new Date(),
): Promise<Result<{ startedAt: string }>> {
  const room = await getRoom(roomId);
  if (!room) return err("NOT_FOUND");
  if (room.status !== "lobby")
    return room.status === "running" && room.startedAt
      ? ok({ startedAt: room.startedAt.toISOString() })
      : err("GAME_OVER");
  const [players] = await db
    .select({ n: count() })
    .from(gamePlayers)
    .where(and(eq(gamePlayers.roomId, roomId), isNull(gamePlayers.removedAt)));
  if (!players?.n) return err("VALIDATION", { message: t.host.noPlayers });
  await db
    .update(gameRooms)
    .set({
      ...bumpRev,
      status: "running",
      startedAt: now,
      hardEndAt: raceHardEnd(now, room.bankTypes, room.pace),
    })
    .where(and(eq(gameRooms.id, roomId), eq(gameRooms.status, "lobby")));
  forgetSnapshot(roomId);
  return ok({ startedAt: now.toISOString() });
}

/** "Kết thúc": the race is over for everyone, whatever they were doing. */
export async function endGame(
  roomId: string,
  now = new Date(),
): Promise<Result<null>> {
  const [ended] = await db
    .update(gameRooms)
    .set({ ...bumpRev, status: "finished", finishedAt: now })
    .where(
      and(eq(gameRooms.id, roomId), sql`${gameRooms.status} <> 'finished'`),
    )
    .returning({ id: gameRooms.id });
  forgetSnapshot(roomId);
  if (ended) return ok(null);
  return (await getRoom(roomId)) ? ok(null) : err("NOT_FOUND");
}

/**
 * Closes a running room once every remaining player has crossed the line.
 * Runs after the room row is locked, so two last answers at once can't both
 * miss each other.
 */
async function finishIfAllDone(
  ex: Pick<typeof db, "update">,
  roomId: string,
  now: Date,
) {
  const [closed] = await ex
    .update(gameRooms)
    .set({ status: "finished", finishedAt: now })
    .where(
      and(
        eq(gameRooms.id, roomId),
        eq(gameRooms.status, "running"),
        sql`not exists (select 1 from ${gamePlayers}
          where ${gamePlayers.roomId} = ${roomId}
            and ${gamePlayers.finishedAt} is null
            and ${gamePlayers.removedAt} is null)`,
      ),
    )
    .returning({ id: gameRooms.id });
  return Boolean(closed);
}

/** The host removes a player (a wrong account, a prank name). */
export async function removePlayer(
  host: Actor,
  roomId: string,
  playerId: number,
  now = new Date(),
): Promise<Result<null>> {
  const removed = await db.transaction(async (tx) => {
    const [room] = await tx
      .update(gameRooms)
      .set(bumpRev)
      .where(eq(gameRooms.id, roomId))
      .returning({ id: gameRooms.id });
    if (!room) return false;
    const [player] = await tx
      .update(gamePlayers)
      .set({ removedAt: now })
      .where(
        and(
          eq(gamePlayers.id, playerId),
          eq(gamePlayers.roomId, roomId),
          isNull(gamePlayers.removedAt),
        ),
      )
      .returning({ id: gamePlayers.id });
    if (!player) return false;
    await finishIfAllDone(tx, roomId, now);
    await writeAudit(tx, {
      actorId: host.id,
      action: "game.remove_player",
      targetType: "game",
      targetId: roomId,
    });
    return true;
  });
  forgetSnapshot(roomId);
  return removed ? ok(null) : err("NOT_FOUND");
}

/** One bank question with its key, from the shared lesson cache. */
async function bankQuestion(item: BankItem): Promise<Question | null> {
  const questions = await getLessonWithAnswers(item.l, item.v);
  return questions?.find((q) => q.id === item.q) ?? null;
}

/** Option counts of the whole bank, to rebuild a player's plan. */
async function bankOptionCounts(bank: readonly BankItem[]) {
  const questions = await Promise.all(bank.map(bankQuestion));
  if (questions.some((q) => q === null)) return null;
  return optionCounts(questions as Question[]);
}

function toStanding(p: SnapshotPlayer): StandingInput {
  return {
    id: p.id,
    name: p.name,
    racer: p.racer,
    color: p.color,
    score: p.score,
    answered: p.answered,
    correct: p.correct,
    bestStreak: p.bestStreak,
    finishedAt: p.finishedAt,
  };
}

/**
 * One answer in a race (ADR-004 still holds: the key comes back only for
 * the question just answered). Server-timed, graded with `gradeItem`, and
 * written with `WHERE answered = index`, so a retry counts once and gets the
 * same result back. The room row is locked first, which also refuses an
 * answer after the host ended the race.
 */
export async function answerQuestion(
  userId: string,
  roomId: string,
  input: GameAnswerInput,
  now = new Date(),
): Promise<Result<AnswerOutcome>> {
  const [row] = await db
    .select({
      status: gameRooms.status,
      startedAt: gameRooms.startedAt,
      hardEndAt: gameRooms.hardEndAt,
      pace: gameRooms.pace,
      bank: gameRooms.bank,
      bankTypes: gameRooms.bankTypes,
      playerId: gamePlayers.id,
      seed: gamePlayers.seed,
      answered: gamePlayers.answered,
      streak: gamePlayers.streak,
      marks: gamePlayers.marks,
      joinedAt: gamePlayers.joinedAt,
      lastAnsweredAt: gamePlayers.lastAnsweredAt,
      removedAt: gamePlayers.removedAt,
    })
    .from(gamePlayers)
    .innerJoin(gameRooms, eq(gameRooms.id, gamePlayers.roomId))
    .where(and(eq(gamePlayers.roomId, roomId), eq(gamePlayers.userId, userId)))
    .limit(1);
  if (!row) return err("NOT_FOUND");
  if (row.removedAt) return err("FORBIDDEN", { message: t.play.removed });
  const size = row.bank.length;
  if (input.index >= size) return err("VALIDATION");
  if (input.index > row.answered) return err("CONFLICT");

  const counts = await bankOptionCounts(row.bank);
  if (!counts) return err("INTERNAL");
  const plan = playerPlan(counts, createRng(row.seed));
  const bankIndex = plan.order[input.index] as number;
  const bankItem = row.bank[bankIndex] as BankItem;
  const question = await bankQuestion(bankItem);
  if (!question) return err("INTERNAL");
  const item = gradingItem(bankItem, plan.options[bankIndex]);
  const expected = expectedAnswer(question, item);

  let mark: GameMark;
  let updated: {
    score: number;
    answered: number;
    correct: number;
    streak: number;
    lastAnsweredAt: Date | null;
    finishedAt: Date | null;
  } | null = null;
  let raceOver = false;

  if (input.index < row.answered) {
    // A retry of an answer already counted: the stored mark is the truth.
    mark = row.marks[bankIndex] ?? { k: "blank", s: 0 };
  } else {
    if (
      row.status !== "running" ||
      !row.startedAt ||
      effectiveStatus(row, now) !== "running"
    )
      return err("GAME_OVER");
    const graded = gradeItem(question, item, input.answer, "proportional");
    const shownAt = questionShownAt({
      raceStartedAt: row.startedAt,
      joinedAt: row.joinedAt,
      lastAnsweredAt: row.lastAnsweredAt,
    });
    const scored = scoreAnswer({
      share: graded.max > 0 ? graded.earned / graded.max : 0,
      blank: isBlank(input.answer),
      elapsedMs: now.getTime() - shownAt.getTime(),
      limitMs: limitMs(question.type, row.pace as Pace),
      streakBefore: row.streak,
    });
    mark = { k: scored.k, s: scored.s };
    const done = input.index + 1 >= size;
    const result = await db.transaction(async (tx) => {
      const [room] = await tx
        .update(gameRooms)
        .set(bumpRev)
        .where(and(eq(gameRooms.id, roomId), eq(gameRooms.status, "running")))
        .returning({ id: gameRooms.id });
      if (!room) return "over" as const;
      const [player] = await tx
        .update(gamePlayers)
        .set({
          answered: sql`${gamePlayers.answered} + 1`,
          score: sql`${gamePlayers.score} + ${mark.s}`,
          correct: sql`${gamePlayers.correct} + ${mark.k === "correct" ? 1 : 0}`,
          streak: scored.streak,
          bestStreak: sql`greatest(${gamePlayers.bestStreak}, ${scored.streak})`,
          marks: sql`jsonb_set(${gamePlayers.marks}, ${`{${bankIndex}}`}::text[], ${JSON.stringify(mark)}::jsonb)`,
          lastAnsweredAt: now,
          ...(done && { finishedAt: now }),
        })
        .where(
          and(
            eq(gamePlayers.id, row.playerId),
            eq(gamePlayers.answered, input.index),
          ),
        )
        .returning({
          score: gamePlayers.score,
          answered: gamePlayers.answered,
          correct: gamePlayers.correct,
          streak: gamePlayers.streak,
          lastAnsweredAt: gamePlayers.lastAnsweredAt,
          finishedAt: gamePlayers.finishedAt,
        });
      if (!player) return "raced" as const;
      const closed = done ? await finishIfAllDone(tx, roomId, now) : false;
      return { player, closed };
    });
    if (result === "over") return err("GAME_OVER");
    if (result === "raced") {
      // A parallel copy of this answer won: report what it stored.
      return answerQuestion(userId, roomId, input, now);
    }
    updated = result.player;
    raceOver = result.closed;
    if (raceOver) forgetSnapshot(roomId);
  }

  const me = updated ?? (await getPlayer(roomId, userId));
  if (!me) return err("NOT_FOUND");
  const snapshot = await getRoomSnapshot(roomId, now.getTime());
  // The snapshot may be up to a second old: my own row is fresh.
  const rows = (snapshot?.players ?? []).map((p) =>
    p.id === row.playerId ? toStanding({ ...p, ...me }) : toStanding(p),
  );
  const nextShownAt = questionShownAt({
    raceStartedAt: row.startedAt ?? now,
    joinedAt: row.joinedAt,
    lastAnsweredAt: me.lastAnsweredAt,
  });
  return ok({
    index: input.index,
    mark,
    expected,
    score: me.score,
    answered: me.answered,
    correct: me.correct,
    streak: me.streak,
    finished: me.finishedAt !== null,
    raceOver:
      raceOver ||
      (snapshot ? effectiveStatus(snapshot.room, now) === "finished" : false),
    view: playerView(rankPlayers(rows), row.playerId),
    nextShownAt: nextShownAt.toISOString(),
    serverNow: now.toISOString(),
  });
}

export type StatePoll =
  | { kind: "unchanged" }
  | { kind: "state"; state: RoomState };

/**
 * The poll behind the lobby, the host screen and the finish line (ADR-008).
 * Host or player only. Answers "unchanged" when the caller already has this
 * `rev`, which costs no player read on this instance.
 */
export async function pollRoom(
  user: { id: string; role: "student" | "admin" },
  roomId: string,
  rev: number,
  now = new Date(),
): Promise<Result<StatePoll>> {
  const snapshot = await getRoomSnapshot(roomId, now.getTime());
  if (!snapshot) return err("NOT_FOUND");
  const { room, players } = snapshot;
  const me = players.find((p) => p.userId === user.id) ?? null;
  if (!me && user.role !== "admin") {
    // Joined a moment ago on another instance, or removed by the host.
    const fresh = await getPlayer(roomId, user.id);
    if (!fresh || fresh.removedAt)
      return err("FORBIDDEN", { message: t.play.removed });
    forgetSnapshot(roomId);
    return pollRoom(user, roomId, -1, now);
  }
  const status = effectiveStatus(room, now);
  if (rev === room.rev && status === room.status)
    return ok({ kind: "unchanged" });
  return ok({
    kind: "state",
    state: roomState(room, players, me?.id ?? null, now),
  });
}

export function roomState(
  room: RoomRow,
  players: readonly SnapshotPlayer[],
  meId: number | null,
  now: Date,
): RoomState {
  return {
    rev: room.rev,
    status: effectiveStatus(room, now),
    questionCount: room.bankTypes.length,
    startedAt: room.startedAt?.toISOString() ?? null,
    serverNow: now.toISOString(),
    players: rankPlayers(players.map(toStanding)),
    meId,
  };
}

/** Wrong PINs count against the student (`GAME_LIMITS.pinMissPerUser`). */
export async function notePinMiss(userId: string, now = new Date()) {
  const limit = await rateLimit(
    `game:pin:${userId}`,
    ...GAME_LIMITS.pinMissPerUser,
    now,
  );
  return limit.ok;
}
