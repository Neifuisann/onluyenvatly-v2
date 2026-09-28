/**
 * Server deadlines (02 §4.1): saves and submits are accepted until
 * `deadline_at` + 30 s grace. A later submit is still graded, but with the
 * answers last saved in time, never with what arrives late.
 */
export const DEADLINE_GRACE_MS = 30_000;

export function isPastGrace(deadlineAt: Date | null, now: Date): boolean {
  return (
    deadlineAt !== null &&
    now.getTime() > deadlineAt.getTime() + DEADLINE_GRACE_MS
  );
}

/** Seconds from start to submit, never more than the time limit allows. */
export function timeTakenSec(
  startedAt: Date,
  deadlineAt: Date | null,
  now: Date,
): number {
  const end =
    deadlineAt && now > deadlineAt ? deadlineAt.getTime() : now.getTime();
  return Math.max(0, Math.round((end - startedAt.getTime()) / 1000));
}
