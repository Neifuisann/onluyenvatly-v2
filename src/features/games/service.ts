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
import { liveQuestions } from "@/features/lessons/domain/summary";
import type { Owner } from "@/features/lessons/ownership";
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
import { bankQuestions } from "./content";
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
  DEFAULT_SETTINGS,
  generatePin,
  MAX_PLAYERS,
  MIN_QUESTIONS,
  type Pace,
} from "./domain/rules";
import {
  costsLife,
  effectiveStatus,
  type GameMark,
  limitMs,
  livesLeft,
  passedMarks,
  playerShownAt,
  raceHardEnd,
  scoreAnswer,
  sharedPosition,
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

type Actor = Owner;

/**
 * A room is run by the teacher who created it (B-03); an admin may run any
 * room, as before B-03.
 */
export const hosts = (user: Owner, hostId: string) =>
  user.role === "admin" || user.id === hostId;
const hostedBy = (user: Owner) =>
  user.role === "admin" ? undefined : eq(gameRooms.hostId, user.id);

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
  const chosen = (await getGameLessonChoices(host)).filter((l) => {
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
    for (const question of liveQuestions(questions ?? []))
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
            sameQuestion: input.sameQuestion ?? DEFAULT_SETTINGS.sameQuestion,
            lockJoin: input.lockJoin ?? DEFAULT_SETTINGS.lockJoin,
            lives: input.lives ?? DEFAULT_SETTINGS.lives,
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
 * already running is allowed unless the room locks joins (B-12): the late
 * player starts with their own countdown, or on the class's current question
 * in a same-question race. A player the host removed can't come back.
 */
export async function joinGame(
  user: { id: string },
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
  if (room.lockJoin && room.status !== "lobby")
    return err("FORBIDDEN", { message: t.play.lockedBody });

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

/** "Bắt đầu": lobby → running, with at least one player. The host only. */
export async function startGame(
  host: Actor,
  roomId: string,
  now = new Date(),
): Promise<Result<{ startedAt: string }>> {
  const room = await getRoom(roomId);
  if (!room || !hosts(host, room.hostId)) return err("NOT_FOUND");
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
  host: Actor,
  roomId: string,
  now = new Date(),
): Promise<Result<null>> {
  const [ended] = await db
    .update(gameRooms)
    .set({ ...bumpRev, status: "finished", finishedAt: now })
    .where(
      and(
        eq(gameRooms.id, roomId),
        hostedBy(host),
        sql`${gameRooms.status} <> 'finished'`,
      ),
    )
    .returning({ id: gameRooms.id });
  forgetSnapshot(roomId);
  if (ended) return ok(null);
  const room = await getRoom(roomId);
  return room && hosts(host, room.hostId) ? ok(null) : err("NOT_FOUND");
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
      .where(and(eq(gameRooms.id, roomId), hostedBy(host)))
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

function toStanding(p: SnapshotPlayer, lives: number | null): StandingInput {
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
    eliminatedAt: p.eliminatedAt,
    lives: livesLeft(lives, p.misses),
  };
}

/** A same-question answer this far ahead of its question is refused. */
const EARLY_SLACK_MS = 1_000;

/**
 * One answer in a race (ADR-004 still holds: the key comes back only for
 * the question just answered). Server-timed, graded with `gradeItem`, and
 * written with `WHERE answered = <what I read>`, so a retry counts once and
 * gets the same result back. The room row is locked first, which also
 * refuses an answer after the host ended the race.
 *
 * Room settings (B-12): in a same-question race the clock is the class's,
 * and a player coming back after a closed tab answers the current question,
 * the ones they let pass counting as timeouts. With lives, a wrong, blank or
 * timed-out answer costs one; the last one ends this player's race.
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
      sameQuestion: gameRooms.sameQuestion,
      lives: gameRooms.lives,
      playerId: gamePlayers.id,
      seed: gamePlayers.seed,
      answered: gamePlayers.answered,
      streak: gamePlayers.streak,
      misses: gamePlayers.misses,
      marks: gamePlayers.marks,
      joinedAt: gamePlayers.joinedAt,
      lastAnsweredAt: gamePlayers.lastAnsweredAt,
      eliminatedAt: gamePlayers.eliminatedAt,
      removedAt: gamePlayers.removedAt,
    })
    .from(gamePlayers)
    .innerJoin(gameRooms, eq(gameRooms.id, gamePlayers.roomId))
    .where(and(eq(gamePlayers.roomId, roomId), eq(gamePlayers.userId, userId)))
    .limit(1);
  if (!row) return err("NOT_FOUND");
  if (row.removedAt) return err("FORBIDDEN", { message: t.play.removed });
  const size = row.bank.length;
  const pace = row.pace as Pace;
  if (input.index >= size) return err("VALIDATION");
  const isRetry = input.index < row.answered;
  if (!isRetry && row.eliminatedAt) return err("GAME_OVER");
  if (input.index > row.answered) {
    // Only a same-question race moves on without you, and only past
    // questions whose answers are closed.
    if (
      !row.sameQuestion ||
      !row.startedAt ||
      sharedPosition(row.startedAt, row.bankTypes, pace, now) < input.index
    )
      return err("CONFLICT");
  }

  // The whole bank (from the shared lesson cache) rebuilds this player's plan.
  const questions = await bankQuestions(row.bank);
  if (!questions) return err("INTERNAL");
  const plan = playerPlan(
    optionCounts(questions),
    createRng(row.seed),
    row.sameQuestion,
  );
  const bankIndex = plan.order[input.index] as number;
  const bankItem = row.bank[bankIndex] as BankItem;
  const question = questions[bankIndex] as Question;
  const item = gradingItem(bankItem, plan.options[bankIndex]);
  const expected = expectedAnswer(question, item);

  let mark: GameMark;
  let updated: {
    score: number;
    answered: number;
    correct: number;
    streak: number;
    misses: number;
    lastAnsweredAt: Date | null;
    finishedAt: Date | null;
    eliminatedAt: Date | null;
  } | null = null;
  let raceOver = false;

  if (isRetry) {
    // A retry of an answer already counted: the stored mark is the truth.
    mark = row.marks[bankIndex] ?? { k: "blank", s: 0 };
  } else {
    if (
      row.status !== "running" ||
      !row.startedAt ||
      effectiveStatus(row, now) !== "running"
    )
      return err("GAME_OVER");
    const room = {
      startedAt: row.startedAt,
      sameQuestion: row.sameQuestion,
      bankTypes: row.bankTypes,
      pace,
    };
    const shownAt = playerShownAt(room, row, input.index);
    if (row.sameQuestion && now.getTime() < shownAt.getTime() - EARLY_SLACK_MS)
      return err("CONFLICT");
    // Same-question races only: positions are bank indexes there.
    const passed = passedMarks(room, row.joinedAt, row.answered, input.index);
    const graded = gradeItem(question, item, input.answer, "proportional");
    const scored = scoreAnswer({
      share: graded.max > 0 ? graded.earned / graded.max : 0,
      blank: isBlank(input.answer),
      elapsedMs: now.getTime() - shownAt.getTime(),
      limitMs: limitMs(question.type, pace),
      streakBefore: passed.some((m) => m !== null) ? 0 : row.streak,
    });
    mark = { k: scored.k, s: scored.s };
    const marks = [...row.marks];
    for (const [i, m] of passed.entries()) marks[row.answered + i] = m;
    marks[bankIndex] = mark;
    const missed = [...passed, mark].filter((m) => m && costsLife(m.k)).length;
    const eliminated = row.lives !== null && row.misses + missed >= row.lives;
    const done = input.index + 1 >= size || eliminated;
    const result = await db.transaction(async (tx) => {
      const [locked] = await tx
        .update(gameRooms)
        .set(bumpRev)
        .where(and(eq(gameRooms.id, roomId), eq(gameRooms.status, "running")))
        .returning({ id: gameRooms.id });
      if (!locked) return "over" as const;
      const [player] = await tx
        .update(gamePlayers)
        .set({
          answered: input.index + 1,
          score: sql`${gamePlayers.score} + ${mark.s}`,
          correct: sql`${gamePlayers.correct} + ${mark.k === "correct" ? 1 : 0}`,
          streak: scored.streak,
          bestStreak: sql`greatest(${gamePlayers.bestStreak}, ${scored.streak})`,
          misses: sql`${gamePlayers.misses} + ${missed}`,
          marks,
          lastAnsweredAt: now,
          ...(done && { finishedAt: now }),
          ...(eliminated && { eliminatedAt: now }),
        })
        .where(
          and(
            eq(gamePlayers.id, row.playerId),
            eq(gamePlayers.answered, row.answered),
          ),
        )
        .returning({
          score: gamePlayers.score,
          answered: gamePlayers.answered,
          correct: gamePlayers.correct,
          streak: gamePlayers.streak,
          misses: gamePlayers.misses,
          lastAnsweredAt: gamePlayers.lastAnsweredAt,
          finishedAt: gamePlayers.finishedAt,
          eliminatedAt: gamePlayers.eliminatedAt,
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
    toStanding(p.id === row.playerId ? { ...p, ...me } : p, row.lives),
  );
  const nextShownAt = playerShownAt(
    {
      startedAt: row.startedAt ?? now,
      sameQuestion: row.sameQuestion,
      bankTypes: row.bankTypes,
      pace,
    },
    { joinedAt: row.joinedAt, lastAnsweredAt: me.lastAnsweredAt },
    me.answered,
  );
  return ok({
    index: input.index,
    mark,
    expected,
    score: me.score,
    answered: me.answered,
    correct: me.correct,
    streak: me.streak,
    lives: livesLeft(row.lives, me.misses),
    eliminated: me.eliminatedAt !== null,
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
  user: Owner,
  roomId: string,
  rev: number,
  now = new Date(),
): Promise<Result<StatePoll>> {
  const snapshot = await getRoomSnapshot(roomId, now.getTime());
  if (!snapshot) return err("NOT_FOUND");
  const { room, players } = snapshot;
  const me = players.find((p) => p.userId === user.id) ?? null;
  if (!me && !hosts(user, room.hostId)) {
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
    players: rankPlayers(players.map((p) => toStanding(p, room.lives))),
    meId,
    settings: {
      sameQuestion: room.sameQuestion,
      lockJoin: room.lockJoin,
      lives: room.lives,
    },
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
