/**
 * Race timing and points (B-05). Pure. Every time here is measured on the
 * server: the browser never says how long it took.
 *
 * A question is "shown" at a moment the server can compute on its own: the
 * race start (or the player's join) plus the countdown for the first one,
 * then the previous answer plus the feedback card. Speed points run from that
 * moment to the answer's arrival.
 */
import type { QuestionType } from "../../lessons/schema.ts";
import {
  COUNTDOWN_MS,
  FEEDBACK_MS,
  LATE_GRACE_MS,
  MAX_POINTS,
  MAX_STREAK_BONUS,
  MIN_POINTS,
  PACES,
  type Pace,
  STALE_AFTER_MS,
  STREAK_STEP,
} from "./rules.ts";

export type MarkKind = "correct" | "partial" | "wrong" | "blank" | "timeout";

/** One answered bank question, stored compactly in `game_players.marks`. */
export type GameMark = { k: MarkKind; s: number };

export function limitMs(type: QuestionType, pace: Pace): number {
  return PACES[pace][type] * 1000;
}

/** When the player's current question appeared. */
export function questionShownAt(p: {
  raceStartedAt: Date;
  joinedAt: Date;
  lastAnsweredAt: Date | null;
}): Date {
  if (p.lastAnsweredAt)
    return new Date(p.lastAnsweredAt.getTime() + FEEDBACK_MS);
  const start = Math.max(p.raceStartedAt.getTime(), p.joinedAt.getTime());
  return new Date(start + COUNTDOWN_MS);
}

/**
 * Same-question races (B-12): when bank question `index` appears for
 * everyone. One clock for the class: the countdown, then each question at
 * full time plus its feedback card, whoever answered early.
 */
export function sharedShownAt(
  startedAt: Date,
  types: readonly QuestionType[],
  pace: Pace,
  index: number,
): Date {
  let at = startedAt.getTime() + COUNTDOWN_MS;
  for (const type of types.slice(0, index))
    at += limitMs(type, pace) + FEEDBACK_MS;
  return new Date(at);
}

/**
 * The question a same-question race is on: the first whose answers are
 * still taken (time plus `LATE_GRACE_MS`). `types.length` once all closed.
 */
export function sharedPosition(
  startedAt: Date,
  types: readonly QuestionType[],
  pace: Pace,
  now: Date,
): number {
  let at = startedAt.getTime() + COUNTDOWN_MS;
  for (const [i, type] of types.entries()) {
    const closes = at + limitMs(type, pace) + LATE_GRACE_MS;
    if (now.getTime() <= closes) return i;
    at += limitMs(type, pace) + FEEDBACK_MS;
  }
  return types.length;
}

/** When this player's question `index` appeared, in either kind of race. */
export function playerShownAt(
  room: {
    startedAt: Date;
    sameQuestion: boolean;
    bankTypes: readonly QuestionType[];
    pace: Pace;
  },
  player: { joinedAt: Date; lastAnsweredAt: Date | null },
  index: number,
): Date {
  return room.sameQuestion
    ? sharedShownAt(room.startedAt, room.bankTypes, room.pace, index)
    : questionShownAt({
        raceStartedAt: room.startedAt,
        joinedAt: player.joinedAt,
        lastAnsweredAt: player.lastAnsweredAt,
      });
}

/**
 * Same-question races: the questions from `from` up to `to` (exclusive) that
 * a player let pass, by a closed tab or a late join. One that closed before
 * they joined stays unreached (null); the rest are timeouts.
 */
export function passedMarks(
  room: { startedAt: Date; bankTypes: readonly QuestionType[]; pace: Pace },
  joinedAt: Date,
  from: number,
  to: number,
): (GameMark | null)[] {
  const out: (GameMark | null)[] = [];
  for (let i = from; i < to; i++) {
    const type = room.bankTypes[i] as QuestionType;
    const closes =
      sharedShownAt(room.startedAt, room.bankTypes, room.pace, i).getTime() +
      limitMs(type, room.pace);
    out.push(closes < joinedAt.getTime() ? null : { k: "timeout", s: 0 });
  }
  return out;
}

/** Marks that cost a life (B-12): anything but a full or partial answer. */
export function costsLife(kind: MarkKind): boolean {
  return kind === "wrong" || kind === "blank" || kind === "timeout";
}

/** Lives a player still has; null when the room has none. */
export function livesLeft(lives: number | null, misses: number) {
  return lives === null ? null : Math.max(0, lives - misses);
}

/** 1000 at once, falling linearly to 500 when the time runs out. */
export function speedPoints(elapsedMs: number, limit: number): number {
  const used = Math.min(1, Math.max(0, elapsedMs / limit));
  return Math.round(MAX_POINTS - (MAX_POINTS - MIN_POINTS) * used);
}

/** Bonus for the `streak`-th correct answer in a row. */
export function streakBonus(streak: number): number {
  if (streak < 2) return 0;
  return Math.min((streak - 1) * STREAK_STEP, MAX_STREAK_BONUS);
}

export type ScoredAnswer = GameMark & { streak: number };

/**
 * Points for one answer.
 * @param share the graded share (0–1) from `gradeItem` (tf may be partial).
 * @param blank nothing was chosen (also what a timed-out browser sends).
 */
export function scoreAnswer(a: {
  share: number;
  blank: boolean;
  elapsedMs: number;
  limitMs: number;
  streakBefore: number;
}): ScoredAnswer {
  if (a.elapsedMs > a.limitMs + LATE_GRACE_MS)
    return { k: "timeout", s: 0, streak: 0 };
  if (a.blank) return { k: "blank", s: 0, streak: 0 };
  if (a.share <= 0) return { k: "wrong", s: 0, streak: 0 };
  const speed = speedPoints(a.elapsedMs, a.limitMs);
  if (a.share < 1)
    return { k: "partial", s: Math.round(speed * a.share), streak: 0 };
  const streak = a.streakBefore + 1;
  return { k: "correct", s: speed + streakBonus(streak), streak };
}

/**
 * The latest moment a race can still be running: every question at full
 * time plus its feedback, then `STALE_AFTER_MS`. Past it the room counts as
 * finished even if the teacher closed the tab.
 */
export function raceHardEnd(
  startedAt: Date,
  types: readonly QuestionType[],
  pace: Pace,
): Date {
  const play = types.reduce((s, t) => s + limitMs(t, pace) + FEEDBACK_MS, 0);
  return new Date(
    startedAt.getTime() + COUNTDOWN_MS + play + LATE_GRACE_MS + STALE_AFTER_MS,
  );
}

export type RoomStatus = "lobby" | "running" | "finished";

/** The status players see: a running race past its hard end is over. */
export function effectiveStatus(
  room: { status: RoomStatus; hardEndAt: Date | null },
  now: Date,
): RoomStatus {
  if (room.status === "running" && room.hardEndAt && now >= room.hardEndAt)
    return "finished";
  return room.status;
}

/** Car position on the track, 0–1: points against a perfect, instant race. */
export function trackProgress(score: number, questionCount: number): number {
  if (questionCount <= 0) return 0;
  return Math.min(1, Math.max(0, score / (questionCount * MAX_POINTS)));
}
