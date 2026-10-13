/**
 * "Bắn zombie" in a room (B-14). Pure. Each player plays the bank, in
 * their own order, with the solo game's rules (`zombie/domain/engine.ts`);
 * these turn their game into what the room ranks: waves survived, points
 * for first shots, and a bank-aligned mark per question for the report.
 * The longest survivor wins (`rankPlayers` with `survival`).
 */
import type { ZombieState, ZombieWave } from "../../../db/schema.ts";
import type { PublicQuestion } from "../../lessons/domain/public-question.ts";
import type { Question } from "../../lessons/schema.ts";
import {
  BREAK_MS,
  initialState,
  LATE_GRACE_MS,
  shapeOf,
  sharedWaveAt,
  timeout,
  COUNTDOWN_MS as ZOMBIE_COUNTDOWN_MS,
} from "../../zombie/domain/engine.ts";
import { STALE_AFTER_MS, type ZombieLives } from "./rules.ts";
import { type GameMark, speedPoints, streakBonus } from "./scoring.ts";

/** Speed points in an untimed room run against this. */
export const UNTIMED_SCORE_MS = 30_000;
/** What an untimed wave may take, for the room's hard end. */
export const UNTIMED_WAVE_MS = 120_000;

/**
 * Same-question zombie rooms (B-15): the first wave starts this long after
 * the room, so everyone has time to read the rules and tap "Bắt đầu".
 */
export const SHARED_LEAD_MS = 10_000;

/** Waves a bank makes: one per mcq, one per tf statement. */
export function countWaves(questions: readonly Question[]): number {
  return questions.reduce(
    (n, q) =>
      n + (q.type === "tf" ? q.statements.length : q.type === "mcq" ? 1 : 0),
    0,
  );
}

/**
 * A player's game before "Bắt đầu": the waves of their questions in their
 * order (a zombie room's bank holds mcq and tf only, so position = index).
 * A same-question room (B-15) puts everyone on the class's clock, which
 * starts `SHARED_LEAD_MS` after the room.
 */
export function roomStartState(
  rules: {
    lives: ZombieLives;
    seconds: number | null;
    shared?: { startedAt: Date } | null;
  },
  questionsInOrder: readonly (Question | PublicQuestion)[],
): ZombieState {
  const state = initialState(
    { lives: rules.lives, secondsPerQuestion: rules.seconds },
    questionsInOrder.flatMap((q) => shapeOf(q) ?? []),
  );
  if (!rules.shared || rules.seconds === null) return state;
  return {
    ...state,
    clock: rules.shared.startedAt.getTime() + SHARED_LEAD_MS,
  };
}

/**
 * Same-question rooms (B-15): the class has moved past waves this player
 * did not play (a closed tab, a late "Bắt đầu"). Each wave whose answers
 * closed is a timeout, which costs a life, as in a same-question race;
 * one that closed before the player joined is skipped instead. Nothing
 * changes before "Bắt đầu" or in a room on its own clock.
 */
export function catchUp(
  s: ZombieState,
  now: number,
  joinedAt: number,
  keyOf: (wave: number) => number,
): ZombieState {
  let state = s;
  while (state.at !== null && !state.over) {
    const at = sharedWaveAt(state, state.wave);
    if (at === null || state.sec === null) return state;
    const closes = at + state.sec * 1000 + LATE_GRACE_MS;
    if (now <= closes) return state;
    if (closes < joinedAt) {
      const next = state.wave + 1;
      state =
        next >= state.waves.length
          ? { ...state, over: "won" }
          : { ...state, wave: next, at: sharedWaveAt(state, next) };
      continue;
    }
    const step = timeout(state, state.wave, keyOf(state.wave), now);
    if (!step.ok) return state;
    state = step.state;
  }
  return state;
}

/** The first shot of an ended wave was its key. */
export const firstShotHit = (w: ZombieWave) =>
  w.e !== undefined && w.k !== undefined && w.s[0] === w.k;

/**
 * Waves the player came through alive: every ended wave but the one that
 * took the last life.
 */
export function wavesSurvived(s: Pick<ZombieState, "waves" | "over">) {
  const ended = s.waves.filter((w) => w.e).length;
  return Math.max(0, ended - (s.over === "lost" ? 1 : 0));
}

/**
 * Points for an ended wave: a first-shot hit scores like a race answer
 * (1000 at once, 500 when the clock runs out, plus the streak bonus);
 * anything else scores nothing and breaks the streak.
 */
export function scoreWave(
  wave: ZombieWave,
  elapsedMs: number,
  sec: number | null,
  streakBefore: number,
): { points: number; streak: number } {
  if (!firstShotHit(wave)) return { points: 0, streak: 0 };
  const streak = streakBefore + 1;
  const limit = sec === null ? UNTIMED_SCORE_MS : sec * 1000;
  return {
    points: speedPoints(Math.max(0, elapsedMs), limit) + streakBonus(streak),
    streak,
  };
}

/**
 * The mark of the question at `position` from its waves so far: correct
 * when every wave fell to the first shot, partial for some (a tf), timeout
 * when the zombies reached the barricade on every wave, wrong otherwise.
 */
export function questionMark(
  s: Pick<ZombieState, "waves">,
  position: number,
  points: number,
): GameMark {
  const waves = s.waves.filter((w) => w.i === position);
  const hits = waves.filter(firstShotHit).length;
  const k =
    waves.length > 0 && hits === waves.length
      ? "correct"
      : hits > 0
        ? "partial"
        : waves.every((w) => w.e === "timeout")
          ? "timeout"
          : "wrong";
  return { k, s: points };
}

export type ZombieTally = {
  score: number;
  streak: number;
  bestStreak: number;
  /** Bank-aligned, as `game_players.marks`. */
  marks: readonly (GameMark | null)[];
};

export type ZombieStats = Omit<ZombieTally, "marks"> & {
  marks: (GameMark | null)[];
  /** Waves survived. */
  answered: number;
  /** Waves that fell to the first shot. */
  correct: number;
  /** Lives used. */
  misses: number;
};

/**
 * The player's row after one move: points and marks for the waves that
 * ended between `prev` and `next`. `order[position]` is the bank index of
 * the player's question at that position; `waveStartedAt` is when the
 * wave's clock started (`prev.at`).
 */
export function tallyMove(
  prev: ZombieState,
  next: ZombieState,
  before: ZombieTally,
  order: readonly number[],
  now: number,
): ZombieStats {
  let { score, streak, bestStreak } = before;
  const marks = [...before.marks];
  next.waves.forEach((w, j) => {
    if (!w.e || prev.waves[j]?.e) return;
    const r = scoreWave(w, now - (prev.at ?? now), next.sec, streak);
    score += r.points;
    streak = r.streak;
    bestStreak = Math.max(bestStreak, streak);
    const bankIndex = order[w.i];
    if (bankIndex === undefined) return;
    marks[bankIndex] = questionMark(
      next,
      w.i,
      (marks[bankIndex]?.s ?? 0) + r.points,
    );
  });
  return {
    score,
    streak,
    bestStreak,
    marks,
    answered: wavesSurvived(next),
    correct: next.waves.filter(firstShotHit).length,
    misses: next.misses,
  };
}

/**
 * The latest moment a zombie room can still be running: every wave at
 * full time (or `UNTIMED_WAVE_MS`) plus its break, then `STALE_AFTER_MS`.
 * A same-question room starts its first wave `SHARED_LEAD_MS` in.
 */
export function zombieHardEnd(
  startedAt: Date,
  waves: number,
  sec: number | null,
  shared = false,
): Date {
  const wave = (sec === null ? UNTIMED_WAVE_MS : sec * 1000) + BREAK_MS;
  return new Date(
    startedAt.getTime() +
      (shared ? SHARED_LEAD_MS : ZOMBIE_COUNTDOWN_MS) +
      waves * wave +
      LATE_GRACE_MS +
      STALE_AFTER_MS,
  );
}
