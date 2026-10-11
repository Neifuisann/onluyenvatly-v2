/**
 * "Bắn zombie" (B-11): the rules of one solo game, pure. A wave is an mcq
 * question (one lane per option) or one statement of a tf question (two
 * lanes: Đúng, Sai). The student shoots a lane:
 * - the right one clears the wave and costs nothing;
 * - a wrong one knocks that zombie out and costs a life; when one lane is
 *   left it must be the key, so the wave ends and shows it;
 * - a zombie that reaches the barricade (the wave's clock ran out) costs a
 *   life and ends the wave.
 * No lives left ends the game. The first shot of a wave is its answer, so
 * the normal grading scores the attempt (ADR-004: keys are shown only for
 * waves that have ended). Nothing here reads the clock: `now` comes in.
 */
import type {
  AttemptAnswer,
  AttemptItem,
  ZombieState,
  ZombieWave,
} from "../../../db/schema.ts";
import { expectedAnswer, OPTION_LETTERS } from "../../grading/domain/grade.ts";
import type { GameConfig, Question } from "../../lessons/schema.ts";

/** The "3, 2, 1" before the first wave. */
export const COUNTDOWN_MS = 3_000;
/** Between waves: the hit, the next zombies walking in. */
export const BREAK_MS = 1_800;
/** A shot this late after the clock still counts (network, slow phones). */
export const LATE_GRACE_MS = 1_500;
/** A timeout may arrive this early (clocks drift a little). */
export const EARLY_TIMEOUT_MS = 1_000;

/** tf lanes, top to bottom. */
export const TF_LANES = [true, false] as const;

export type QuestionShape =
  | { type: "mcq"; options: number }
  | { type: "tf"; statements: number };

/** Only mcq and tf questions can be played; `short` is left out at start. */
export const PLAYABLE_TYPES = ["mcq", "tf"] as const;
export const isPlayable = (q: { type: string }) =>
  (PLAYABLE_TYPES as readonly string[]).includes(q.type);

export function shapeOf(q: Question): QuestionShape | null {
  if (q.type === "mcq") return { type: "mcq", options: q.options.length };
  if (q.type === "tf") return { type: "tf", statements: q.statements.length };
  return null;
}

/** The waves for items in display order: one per mcq, one per tf statement. */
export function buildWaves(shapes: readonly QuestionShape[]): ZombieWave[] {
  return shapes.flatMap((shape, i) =>
    shape.type === "mcq"
      ? [{ i, n: shape.options, s: [] }]
      : Array.from({ length: shape.statements }, (_, p) => ({
          i,
          p,
          n: TF_LANES.length,
          s: [],
        })),
  );
}

export function initialState(
  game: Pick<GameConfig, "lives" | "secondsPerQuestion">,
  shapes: readonly QuestionShape[],
): ZombieState {
  return {
    lives: game.lives,
    sec: game.secondsPerQuestion,
    at: null,
    wave: 0,
    misses: 0,
    over: null,
    waves: buildWaves(shapes),
  };
}

/** The lane that is right for a wave, in display terms (shuffled options). */
export function waveKey(
  q: Question,
  item: AttemptItem,
  wave: Pick<ZombieWave, "p">,
): number {
  const expected = expectedAnswer(q, item);
  if (q.type === "tf") {
    const answer = Array.isArray(expected) ? expected[wave.p ?? 0] : null;
    return answer === true ? 0 : 1;
  }
  const letter = OPTION_LETTERS.indexOf(
    expected as (typeof OPTION_LETTERS)[number],
  );
  return Math.max(0, letter);
}

export const livesLeft = (s: Pick<ZombieState, "lives" | "misses">) =>
  Math.max(0, s.lives - s.misses);

/** Milliseconds left on the current wave's clock; null = no clock. */
export function timeLeftMs(s: ZombieState, now: number): number | null {
  if (s.sec === null || s.at === null) return null;
  return s.at + s.sec * 1000 - now;
}

/** "Bắt đầu": starts the first wave's clock after the countdown. Idempotent. */
export function begin(s: ZombieState, now: number): ZombieState {
  if (s.at !== null || s.over) return s;
  return { ...s, at: now + COUNTDOWN_MS };
}

/** Where a first shot goes in `answers`: the item, and the value there. */
export type AnswerPatch = { item: number; part?: number; lane: number };

export type GameEvent =
  /** The wave was already decided: a retry, a double tap, an old tab. */
  | { kind: "stale" }
  | { kind: "hit"; key: number }
  | { kind: "miss"; lane: number; ended: boolean; key?: number }
  | { kind: "timeout"; key: number };

export type Step =
  | { ok: true; state: ZombieState; event: GameEvent; answer?: AnswerPatch }
  | { ok: false; code: "NOT_STARTED" | "OVER" | "INVALID" };

/** Ends the current wave and moves on, or ends the game. */
function endWave(
  s: ZombieState,
  wave: ZombieWave,
  now: number,
  misses: number,
): ZombieState {
  const waves = s.waves.with(s.wave, wave);
  const next = s.wave + 1;
  const lost = misses >= s.lives;
  const won = !lost && next >= waves.length;
  return {
    ...s,
    waves,
    misses,
    wave: lost ? s.wave : next,
    at: lost || won ? s.at : now + BREAK_MS,
    over: lost ? "lost" : won ? "won" : null,
  };
}

/** Common checks for a shot or a timeout at `wave`. */
function current(
  s: ZombieState,
  wave: number,
): ZombieWave | "stale" | "NOT_STARTED" | "OVER" | "INVALID" {
  if (!Number.isInteger(wave) || wave < 0 || wave >= s.waves.length)
    return "INVALID";
  if (wave < s.wave) return "stale";
  if (s.over) return "OVER";
  if (wave > s.wave) return "INVALID";
  if (s.at === null) return "NOT_STARTED";
  return s.waves[wave] as ZombieWave;
}

/** The zombie reached the barricade: one life, and the wave ends. */
export function timeout(
  s: ZombieState,
  wave: number,
  key: number,
  now: number,
): Step {
  const w = current(s, wave);
  if (w === "stale") return { ok: true, state: s, event: { kind: "stale" } };
  if (typeof w === "string") return { ok: false, code: w };
  const left = timeLeftMs(s, now);
  if (left === null || left > EARLY_TIMEOUT_MS)
    return { ok: false, code: "INVALID" };
  return {
    ok: true,
    state: endWave(s, { ...w, e: "timeout", k: key }, now, s.misses + 1),
    event: { kind: "timeout", key },
  };
}

/** A shot at `lane` of `wave`; `key` is that wave's right lane. */
export function shoot(
  s: ZombieState,
  input: { wave: number; lane: number },
  key: number,
  now: number,
): Step {
  const w = current(s, input.wave);
  if (w === "stale") return { ok: true, state: s, event: { kind: "stale" } };
  if (typeof w === "string") return { ok: false, code: w };
  const { lane } = input;
  if (!Number.isInteger(lane) || lane < 0 || lane >= w.n)
    return { ok: false, code: "INVALID" };
  // The same lane twice: the first one already counted.
  if (w.s.includes(lane))
    return { ok: true, state: s, event: { kind: "stale" } };
  // Before the clock (the break after the last wave): too early to shoot.
  if (now < (s.at ?? 0) - EARLY_TIMEOUT_MS)
    return { ok: false, code: "INVALID" };
  const left = timeLeftMs(s, now);
  if (left !== null && left < -LATE_GRACE_MS)
    return timeout(s, s.wave, key, now);

  const answer: AnswerPatch | undefined =
    w.s.length === 0
      ? { item: w.i, lane, ...(w.p !== undefined && { part: w.p }) }
      : undefined;
  const shot = { ...w, s: [...w.s, lane] };
  const withAnswer = <T extends object>(step: T) =>
    answer ? { ...step, answer } : step;

  if (lane === key)
    return withAnswer({
      ok: true as const,
      state: endWave(s, { ...shot, e: "hit", k: key }, now, s.misses),
      event: { kind: "hit" as const, key },
    });

  const misses = s.misses + 1;
  // One lane left (always, in a tf wave): it is the key, the wave is over.
  const ended = shot.s.length >= w.n - 1 || misses >= s.lives;
  if (ended)
    return withAnswer({
      ok: true as const,
      state: endWave(s, { ...shot, e: "miss", k: key }, now, misses),
      event: { kind: "miss" as const, lane, ended, key },
    });
  return withAnswer({
    ok: true as const,
    state: {
      ...s,
      misses,
      waves: s.waves.with(s.wave, shot),
    },
    event: { kind: "miss" as const, lane, ended },
  });
}

/**
 * The stored answers with a first shot written in: the option letter for an
 * mcq, the statement's boolean for a tf (other statements stay as they are).
 */
export function applyAnswer(
  answers: readonly AttemptAnswer[],
  patch: AnswerPatch,
  statements: number,
): AttemptAnswer[] {
  const out = [...answers];
  if (patch.part === undefined) {
    out[patch.item] = OPTION_LETTERS[patch.lane] ?? null;
    return out;
  }
  const prev = out[patch.item];
  const row: (boolean | null)[] = Array.isArray(prev)
    ? [...prev]
    : Array.from({ length: statements }, () => null);
  row[patch.part] = TF_LANES[patch.lane] ?? null;
  out[patch.item] = row;
  return out;
}

/** What the end screen shows. */
export function summary(s: ZombieState) {
  const ended = s.waves.filter((w) => w.e);
  return {
    waves: s.waves.length,
    cleared: ended.length,
    firstShot: ended.filter((w) => w.k !== undefined && w.s[0] === w.k).length,
    livesLeft: livesLeft(s),
  };
}
