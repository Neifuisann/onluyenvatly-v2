import "server-only";
import { and, asc, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { gamePlayers, gameRooms, lessons, users } from "@/db/schema";
import type { QuestionType } from "@/features/lessons/schema";
import { publicName } from "@/features/rating/domain/leaderboard";
import type { Pace } from "./domain/rules";

/**
 * Game room reads (B-05, ADR-008). Rooms are live, per-class data: never in
 * the shared cache. Polls go through `getRoomSnapshot`, which a whole class
 * shares for one second per function instance.
 */

const roomColumns = {
  id: gameRooms.id,
  pin: gameRooms.pin,
  hostId: gameRooms.hostId,
  title: gameRooms.title,
  status: gameRooms.status,
  pace: sql<Pace>`${gameRooms.pace}`,
  bankTypes: gameRooms.bankTypes,
  lessonIds: gameRooms.lessonIds,
  rev: gameRooms.rev,
  createdAt: gameRooms.createdAt,
  startedAt: gameRooms.startedAt,
  hardEndAt: gameRooms.hardEndAt,
  finishedAt: gameRooms.finishedAt,
};

export type RoomRow = {
  id: string;
  pin: string;
  hostId: string;
  title: string;
  status: "lobby" | "running" | "finished";
  pace: Pace;
  bankTypes: QuestionType[];
  lessonIds: number[];
  rev: number;
  createdAt: Date;
  startedAt: Date | null;
  hardEndAt: Date | null;
  finishedAt: Date | null;
};

export type SnapshotPlayer = {
  id: number;
  userId: string;
  name: string;
  racer: string;
  color: number;
  score: number;
  answered: number;
  correct: number;
  streak: number;
  bestStreak: number;
  joinedAt: Date;
  lastAnsweredAt: Date | null;
  finishedAt: Date | null;
};

export type RoomSnapshot = { room: RoomRow; players: SnapshotPlayer[] };

export async function getRoom(id: string): Promise<RoomRow | null> {
  const [room] = await db
    .select(roomColumns)
    .from(gameRooms)
    .where(eq(gameRooms.id, id))
    .limit(1);
  return room ?? null;
}

/**
 * The newest room with this PIN. A PIN is unique among open rooms; an old
 * finished room may share it, and the newest one is what a fresh link means.
 */
export async function getRoomByPin(pin: string): Promise<RoomRow | null> {
  const [room] = await db
    .select(roomColumns)
    .from(gameRooms)
    .where(eq(gameRooms.pin, pin))
    .orderBy(desc(gameRooms.createdAt))
    .limit(1);
  return room ?? null;
}

/** Players still in the room, in join order, with their public names. */
async function loadPlayers(roomId: string): Promise<SnapshotPlayer[]> {
  const rows = await db
    .select({
      id: gamePlayers.id,
      userId: gamePlayers.userId,
      fullName: users.fullName,
      initialsOnly: users.leaderboardInitials,
      racer: gamePlayers.racer,
      color: gamePlayers.color,
      score: gamePlayers.score,
      answered: gamePlayers.answered,
      correct: gamePlayers.correct,
      streak: gamePlayers.streak,
      bestStreak: gamePlayers.bestStreak,
      joinedAt: gamePlayers.joinedAt,
      lastAnsweredAt: gamePlayers.lastAnsweredAt,
      finishedAt: gamePlayers.finishedAt,
    })
    .from(gamePlayers)
    .innerJoin(users, eq(users.id, gamePlayers.userId))
    .where(and(eq(gamePlayers.roomId, roomId), isNull(gamePlayers.removedAt)))
    .orderBy(asc(gamePlayers.id));
  return rows.map(({ fullName, initialsOnly, ...p }) => ({
    ...p,
    name: publicName(fullName, initialsOnly),
  }));
}

/** One second: a class polling together reads the room about once. */
export const SNAPSHOT_TTL_MS = 1_000;
const memo = new Map<
  string,
  { at: number; value: Promise<RoomSnapshot | null> }
>();

/**
 * The room and its players as of at most a second ago, shared by every
 * request on this instance. Writers on this instance call `forgetSnapshot`.
 */
export function getRoomSnapshot(
  roomId: string,
  now = Date.now(),
): Promise<RoomSnapshot | null> {
  const hit = memo.get(roomId);
  if (hit && now - hit.at < SNAPSHOT_TTL_MS) return hit.value;
  if (memo.size > 200)
    for (const [key, entry] of memo)
      if (now - entry.at >= SNAPSHOT_TTL_MS) memo.delete(key);
  const value = Promise.all([getRoom(roomId), loadPlayers(roomId)]).then(
    ([room, players]) => (room ? { room, players } : null),
  );
  // A failed read is not remembered.
  value.catch(() => memo.delete(roomId));
  memo.set(roomId, { at: now, value });
  return value;
}

export function forgetSnapshot(roomId: string) {
  memo.delete(roomId);
}

/** The signed-in user's row in a room, removed or not. */
export async function getPlayer(roomId: string, userId: string) {
  const [player] = await db
    .select({
      id: gamePlayers.id,
      racer: gamePlayers.racer,
      color: gamePlayers.color,
      seed: gamePlayers.seed,
      answered: gamePlayers.answered,
      score: gamePlayers.score,
      correct: gamePlayers.correct,
      streak: gamePlayers.streak,
      bestStreak: gamePlayers.bestStreak,
      joinedAt: gamePlayers.joinedAt,
      lastAnsweredAt: gamePlayers.lastAnsweredAt,
      finishedAt: gamePlayers.finishedAt,
      removedAt: gamePlayers.removedAt,
    })
    .from(gamePlayers)
    .where(and(eq(gamePlayers.roomId, roomId), eq(gamePlayers.userId, userId)))
    .limit(1);
  return player ?? null;
}

export type PlayerRow = NonNullable<Awaited<ReturnType<typeof getPlayer>>>;

/** The room's bank (references only). */
export async function getRoomBank(roomId: string) {
  const [row] = await db
    .select({ bank: gameRooms.bank })
    .from(gameRooms)
    .where(eq(gameRooms.id, roomId))
    .limit(1);
  return row?.bank ?? null;
}

/** Every player's marks, for the teacher's per-question report. */
export async function getRoomMarks(roomId: string) {
  const rows = await db
    .select({ marks: gamePlayers.marks })
    .from(gamePlayers)
    .where(and(eq(gamePlayers.roomId, roomId), isNull(gamePlayers.removedAt)));
  return rows.map((r) => r.marks);
}

export type HostRoomItem = {
  id: string;
  pin: string;
  title: string;
  status: "lobby" | "running" | "finished";
  questionCount: number;
  players: number;
  createdAt: Date;
};

/** `/admin/games`: the teacher's latest rooms with their player counts. */
export async function getHostRooms(
  hostId: string,
  limit = 30,
): Promise<HostRoomItem[]> {
  const players = db
    .select({ roomId: gamePlayers.roomId, n: count().as("n") })
    .from(gamePlayers)
    .where(isNull(gamePlayers.removedAt))
    .groupBy(gamePlayers.roomId)
    .as("players");
  const rows = await db
    .select({
      id: gameRooms.id,
      pin: gameRooms.pin,
      title: gameRooms.title,
      status: gameRooms.status,
      questionCount: sql<number>`cardinality(${gameRooms.bankTypes})`,
      players: sql<number>`coalesce(${players.n}, 0)::int`,
      createdAt: gameRooms.createdAt,
    })
    .from(gameRooms)
    .leftJoin(players, eq(players.roomId, gameRooms.id))
    .where(eq(gameRooms.hostId, hostId))
    .orderBy(desc(gameRooms.createdAt))
    .limit(limit);
  return rows;
}

export type GameLessonChoice = {
  id: number;
  title: string;
  grade: number | null;
  chapter: string | null;
  versionId: number;
  config: unknown;
  counts: Record<QuestionType, number>;
};

/**
 * Published lessons the create form offers, with every question of the
 * published version counted by type (not the test's pool size). Admin only,
 * ~170 small rows; the question JSON never leaves the database here.
 */
export async function getGameLessonChoices(): Promise<GameLessonChoice[]> {
  const typeCount = (type: QuestionType) =>
    sql<number>`(select count(*)::int from lesson_versions v,
      jsonb_array_elements(v.questions) q
      where v.id = ${lessons.currentVersionId} and q->>'type' = ${type})`;
  const rows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      grade: lessons.grade,
      chapter: lessons.chapter,
      versionId: lessons.currentVersionId,
      config: lessons.config,
      mcq: typeCount("mcq"),
      tf: typeCount("tf"),
      short: typeCount("short"),
    })
    .from(lessons)
    .where(
      and(
        eq(lessons.status, "published"),
        isNull(lessons.deletedAt),
        isNotNull(lessons.currentVersionId),
      ),
    )
    .orderBy(asc(lessons.sortOrder), asc(lessons.id));
  return rows.flatMap(({ versionId, mcq, tf, short, ...r }) =>
    versionId === null ? [] : [{ ...r, versionId, counts: { mcq, tf, short } }],
  );
}
