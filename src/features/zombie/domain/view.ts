/**
 * What the game screen derives from the server's state (B-11): where the
 * zombies are, which lanes are down, which wave is on screen. Pure.
 */
import type { ZombieState, ZombieWave } from "../../../db/schema.ts";
import { OPTION_LETTERS } from "../../grading/domain/grade.ts";
import { BREAK_MS } from "./engine.ts";

/** The last part of a break: the next zombies walk in from the right. */
export const ENTER_MS = 900;
/** The first part: the hit or the miss plays out on the old wave. */
export const AFTERMATH_MS = BREAK_MS - ENTER_MS;
/** How far zombies walk in an untimed game: they stop, then wait. */
export const UNTIMED_STOP = 0.12;

/**
 * Walk progress of the current wave's zombies: below 0 while they walk in
 * (−1 = just off the right edge), 0 at their start, 1 at the barricade.
 */
export function walkProgress(s: ZombieState, now: number): number {
  if (s.at === null) return 0;
  if (now < s.at) {
    const entering = Math.min(1, (s.at - now) / ENTER_MS);
    return -entering;
  }
  if (s.sec === null)
    return Math.min(UNTIMED_STOP, ((now - s.at) / 4000) * UNTIMED_STOP);
  return Math.min(1, (now - s.at) / (s.sec * 1000));
}

/** Lanes whose zombie is down: every wrong shot (a hit ends the wave). */
export function downLanes(w: ZombieWave): number[] {
  return w.s.filter((lane) => lane !== w.k);
}

/** The letter on a lane's sign: A–F for mcq, Đ/S for a tf statement. */
export function laneLetter(w: Pick<ZombieWave, "p">, lane: number): string {
  if (w.p !== undefined) return lane === 0 ? "Đ" : "S";
  return OPTION_LETTERS[lane] ?? "?";
}

/** a–h for a tf statement. */
export const statementLetter = (p: number) => String.fromCharCode(97 + p);

/**
 * The lane a key press shoots, or null: A–F / 1–6 for mcq lanes; Đ, D or 1
 * for "Đúng" and S or 2 for "Sai" in a tf wave.
 */
export function laneForKey(w: Pick<ZombieWave, "p" | "n">, key: string) {
  const k = key.toLowerCase();
  if (w.p !== undefined) {
    if (k === "đ" || k === "d" || k === "1") return 0;
    if (k === "s" || k === "2") return 1;
    return null;
  }
  const digit = Number.parseInt(k, 10);
  const lane =
    k.length === 1 && k >= "a" && k <= "f"
      ? k.charCodeAt(0) - 97
      : Number.isInteger(digit)
        ? digit - 1
        : -1;
  return lane >= 0 && lane < w.n ? lane : null;
}
