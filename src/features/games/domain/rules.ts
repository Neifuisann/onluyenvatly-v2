/**
 * Game rooms (B-05, ADR-008): the fixed rules of a live race. Pure and
 * import-free (no Zod: the race screens ship these constants to phones);
 * the input schemas live in `../schemas.ts`.
 */
import type { QuestionType } from "../../lessons/schema.ts";

/** Six digits, never starting with 0, so it reads like a Kahoot PIN. */
export const PIN_PATTERN = /^[1-9]\d{5}$/;

/** A random PIN from a uniform integer source (`crypto.randomInt`). */
export function generatePin(randomInt: (min: number, max: number) => number) {
  return String(randomInt(100_000, 1_000_000));
}

/** Questions a teacher may draw for one race. */
export const MIN_QUESTIONS = 5;
export const MAX_QUESTIONS = 40;
export const DEFAULT_QUESTIONS = 10;
/** Lessons one race may draw from. */
export const MAX_LESSONS = 10;
/** One classroom plus a few late arrivals. */
export const MAX_PLAYERS = 60;

/** Seconds a player has per question, by pace and type. */
export const PACES = {
  fast: { mcq: 15, tf: 30, short: 30 },
  normal: { mcq: 20, tf: 40, short: 45 },
  relaxed: { mcq: 30, tf: 60, short: 75 },
} as const satisfies Record<string, Record<QuestionType, number>>;
export type Pace = keyof typeof PACES;
export const PACE_NAMES = Object.keys(PACES) as Pace[];

/**
 * What a room plays (B-14): the B-05 race, or "Bắn zombie" together, where
 * every player fights the bank as zombie waves and the longest survivor
 * wins.
 */
export const GAME_MODES = ["race", "zombie"] as const;
export type GameMode = (typeof GAME_MODES)[number];
/** A zombie room plays mcq and tf questions only (one wave per statement). */
export const ZOMBIE_TYPES = ["mcq", "tf"] as const satisfies QuestionType[];
/** Lives in a zombie room: as in the solo game (B-11). */
export const ZOMBIE_LIVES = [3, 1] as const;
export type ZombieLives = (typeof ZOMBIE_LIVES)[number];
/** Seconds per wave a zombie room starts with. */
export const DEFAULT_ZOMBIE_SECONDS = 20;

/** Lives a teacher may give when misses knock players out (B-12). */
export const MIN_LIVES = 1;
export const MAX_LIVES = 5;
export const DEFAULT_LIVES = 3;

/**
 * Room settings the teacher picks at creation (B-12). Everything off is the
 * B-05 race: own order, late joins welcome, nobody knocked out.
 */
export type GameSettings = {
  /** Everyone answers the same question at the same time. */
  sameQuestion: boolean;
  /** No new players once the race has started. */
  lockJoin: boolean;
  /** Misses allowed before a player is out; null when off. */
  lives: number | null;
};
export const DEFAULT_SETTINGS: GameSettings = {
  sameQuestion: false,
  lockJoin: false,
  lives: null,
};

/** "3, 2, 1, Chạy!" before the first question. */
export const COUNTDOWN_MS = 4_000;
/** How long the right/wrong card stays before the next question. */
export const FEEDBACK_MS = 3_000;
/** Network slack after a question's time is up. */
export const LATE_GRACE_MS = 2_000;
/** A race nobody ended is closed this long after its last possible answer. */
export const STALE_AFTER_MS = 5 * 60_000;

/** Points for a correct answer: 1000 instantly, 500 at the last second. */
export const MAX_POINTS = 1000;
export const MIN_POINTS = 500;
/** +20 per answer in a row after the first, up to +100. */
export const STREAK_STEP = 20;
export const MAX_STREAK_BONUS = 100;

/** Racers a player picks in the lobby (icons in `components/racer.tsx`). */
export const RACERS = [
  "rabbit",
  "rocket",
  "car",
  "bike",
  "plane",
  "sailboat",
  "turtle",
  "cat",
] as const;
export type Racer = (typeof RACERS)[number];
/** `--racer-0` … `--racer-7` in globals.css. */
export const RACER_COLORS = 8;

/** A stable starting look from the user id, so a lobby isn't all rabbits. */
export function defaultRacer(userId: string): { racer: Racer; color: number } {
  let h = 0;
  for (const ch of userId) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return {
    racer: RACERS[h % RACERS.length] as Racer,
    color: (h >>> 8) % RACER_COLORS,
  };
}
