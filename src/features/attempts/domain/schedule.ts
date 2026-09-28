/**
 * Scheduled tests (owner decision 2026-09-28). A lesson with `startsAt`
 * can't be started before it. With `revealAnswers: after_deadline` it is one
 * shared exam window: every attempt ends by startsAt + time limit, answers
 * open 30 s later, and from then on only students the teacher gave extra
 * tries may start it. Pure.
 */
import type { LessonConfig } from "../../lessons/schema.ts";
import { DEADLINE_GRACE_MS } from "./deadline.ts";

export type Schedule = Pick<
  LessonConfig,
  "startsAt" | "timeLimitSec" | "revealAnswers"
>;

const ms = (iso: string | null) => (iso ? Date.parse(iso) : Number.NaN);

/** When the answers open, and the lesson closes: null unless scheduled. */
export function revealAt(s: Schedule): Date | null {
  const start = ms(s.startsAt);
  if (s.revealAnswers !== "after_deadline" || !s.timeLimitSec || !(start >= 0))
    return null;
  return new Date(start + s.timeLimitSec * 1000 + DEADLINE_GRACE_MS);
}

/**
 * An attempt's deadline: its own time limit, but inside the shared window no
 * later than startsAt + limit, so nobody still works once answers are out.
 * Extra tries after the close get their own full time.
 */
export function attemptDeadline(s: Schedule, now: Date): Date | null {
  if (!s.timeLimitSec) return null;
  const own = now.getTime() + s.timeLimitSec * 1000;
  const close = revealAt(s);
  if (!close || now >= close) return new Date(own);
  return new Date(Math.min(own, close.getTime() - DEADLINE_GRACE_MS));
}

export type StartCounts = {
  /** Finished attempts on the lesson. */
  used: number;
  /** Attempts started once the lesson had closed. */
  usedSinceClose: number;
  /** Extra tries the teacher granted this student (attempt_overrides). */
  extra: number;
};

export type StartCheck =
  | { ok: true }
  | { ok: false; code: "NOT_OPEN_YET"; at: Date }
  | { ok: false; code: "LESSON_CLOSED" | "ATTEMPT_LIMIT" };

/**
 * May this student start a new attempt now? Admins always may (06 §2).
 * Extra tries both reopen a closed lesson and raise `maxAttempts`.
 */
export function canStart(
  s: Schedule & Pick<LessonConfig, "maxAttempts">,
  { used, usedSinceClose, extra }: StartCounts,
  now: Date,
  isAdmin: boolean,
): StartCheck {
  if (isAdmin) return { ok: true };
  const start = ms(s.startsAt);
  if (start >= 0 && now.getTime() < start)
    return { ok: false, code: "NOT_OPEN_YET", at: new Date(start) };
  const close = revealAt(s);
  if (close && now >= close && usedSinceClose >= extra)
    return { ok: false, code: extra > 0 ? "ATTEMPT_LIMIT" : "LESSON_CLOSED" };
  if (s.maxAttempts !== null && used >= s.maxAttempts + extra)
    return { ok: false, code: "ATTEMPT_LIMIT" };
  return { ok: true };
}
