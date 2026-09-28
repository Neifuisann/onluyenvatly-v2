/**
 * Exam guard (S4-04, 06 §3): what the runner records while a lesson has
 * `examGuard` on. Events are only shown to the teacher, never penalized
 * automatically. Pure.
 */
import type { GuardEvent } from "../../../db/schema.ts";

/**
 * `blur`: the window lost focus; `hidden`: the tab was hidden or the phone
 * switched apps; `fs-exit`: full screen was left; `copy`: a blocked copy, cut
 * or context menu.
 */
export const GUARD_KINDS = ["blur", "hidden", "fs-exit", "copy"] as const;
export type GuardKind = (typeof GUARD_KINDS)[number];

/** Stored per attempt (04 `attempts.guard_events`). */
export const MAX_GUARD_EVENTS = 200;
/** Unsent events kept by the browser and accepted per request. */
export const MAX_GUARD_BATCH = 50;
/** A repeat of the same kind within this many seconds is one event. */
export const GUARD_DEDUPE_SEC = 2;

/** Whole seconds since the attempt started, on the server's clock. */
export function guardSecond(startedAtMs: number, serverNowMs: number): number {
  return Math.max(0, Math.round((serverNowMs - startedAtMs) / 1000));
}

/**
 * Adds an event to the unsent batch. Holding a key or a blur that also hides
 * the tab would otherwise log bursts of the same thing.
 */
export function pushGuard(
  pending: readonly GuardEvent[],
  event: GuardEvent,
): readonly GuardEvent[] {
  const lastSame = pending.findLast((e) => e.k === event.k);
  if (lastSame && event.t - lastSame.t < GUARD_DEDUPE_SEC) return pending;
  if (pending.length >= MAX_GUARD_BATCH) return pending;
  return [...pending, event];
}
