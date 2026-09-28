/**
 * The test runner's state transitions (07 §5.2). Pure, so the Zustand store
 * stays a thin wrapper and the rules are unit-tested. Answers use the stored
 * shape (04 `attempts.answers`): mcq letter, tf booleans/nulls, short text.
 */
import type { AttemptAnswer } from "../../../db/schema.ts";

export type RunnerAnswers = AttemptAnswer[];

export type RunnerState = {
  answers: RunnerAnswers;
  /** Item indexes, ascending. */
  flagged: number[];
  /** Item shown in one-per-screen mode. */
  current: number;
};

export function isAnswered(answer: AttemptAnswer | undefined): boolean {
  if (answer === null || answer === undefined) return false;
  if (typeof answer === "string") return answer.trim() !== "";
  return answer.some((a) => a !== null);
}

const clamp = (i: number, n: number) => Math.min(Math.max(i, 0), n - 1);

function withAnswer(
  s: RunnerState,
  index: number,
  answer: AttemptAnswer,
): RunnerState {
  if (index < 0 || index >= s.answers.length) return s;
  const answers = [...s.answers];
  answers[index] = answer;
  return { ...s, answers };
}

/** Picks an mcq letter; picking the same letter again clears it. */
export function chooseOption(
  s: RunnerState,
  index: number,
  letter: string,
): RunnerState {
  return withAnswer(s, index, s.answers[index] === letter ? null : letter);
}

/** Sets one tf statement; setting the same value again clears it. */
export function setStatement(
  s: RunnerState,
  index: number,
  statement: number,
  value: boolean,
  statementCount: number,
): RunnerState {
  if (statement < 0 || statement >= statementCount) return s;
  const prev = s.answers[index];
  const row: (boolean | null)[] = Array.from(
    { length: statementCount },
    (_, i) => (Array.isArray(prev) ? (prev[i] ?? null) : null),
  );
  row[statement] = row[statement] === value ? null : value;
  return withAnswer(s, index, row.every((v) => v === null) ? null : row);
}

/** Short answer text as typed (normalized only when graded). */
export function setText(
  s: RunnerState,
  index: number,
  text: string,
): RunnerState {
  return withAnswer(s, index, text === "" ? null : text.slice(0, 100));
}

export function toggleFlag(s: RunnerState, index: number): RunnerState {
  if (index < 0 || index >= s.answers.length) return s;
  const flagged = s.flagged.includes(index)
    ? s.flagged.filter((i) => i !== index)
    : [...s.flagged, index].sort((a, b) => a - b);
  return { ...s, flagged };
}

export function goTo(s: RunnerState, index: number): RunnerState {
  const current = clamp(index, s.answers.length);
  return current === s.current ? s : { ...s, current };
}

export type RunnerSummary = {
  answered: number;
  total: number;
  unanswered: number[];
  flagged: number[];
};

export function summarize(s: RunnerState): RunnerSummary {
  const unanswered = s.answers.flatMap((a, i) => (isAnswered(a) ? [] : [i]));
  return {
    answered: s.answers.length - unanswered.length,
    total: s.answers.length,
    unanswered,
    flagged: s.flagged,
  };
}

/**
 * Normalizes answers restored from the server or localStorage so a stale or
 * tampered copy can't break the runner: wrong length or odd values → blank.
 */
export function restoreAnswers(saved: unknown, count: number): RunnerAnswers {
  const list = Array.isArray(saved) ? saved : [];
  return Array.from({ length: count }, (_, i) => {
    const a: unknown = list[i];
    if (typeof a === "string") return a.slice(0, 100);
    if (
      Array.isArray(a) &&
      a.length <= 8 &&
      a.every((v) => v === null || typeof v === "boolean")
    )
      return a as (boolean | null)[];
    return null;
  });
}

/** What the browser keeps in localStorage per attempt (07 §7). */
export type LocalCopy = {
  answers: unknown;
  flagged: unknown;
  /** Changed since the last save the server confirmed. */
  dirty: boolean;
};

/**
 * On load, unsynced local changes win over the server copy (they are newer:
 * the browser saves on every change, the server every 30 s). A clean local
 * copy is ignored, so a save from another device shows up.
 */
export function localToRestore(
  local: LocalCopy | null,
  count: number,
): Pick<RunnerState, "answers" | "flagged"> | null {
  if (!local?.dirty) return null;
  if (!Array.isArray(local.answers) || local.answers.length !== count)
    return null;
  return {
    answers: restoreAnswers(local.answers, count),
    flagged: restoreFlagged(local.flagged, count),
  };
}

/** Autosave retry backoff: 2, 4, 8, 16, then every 30 s. */
export function retryDelayMs(failures: number): number {
  return Math.min(30_000, 2_000 * 2 ** Math.max(0, failures - 1));
}

export function restoreFlagged(saved: unknown, count: number): number[] {
  if (!Array.isArray(saved)) return [];
  return [
    ...new Set(
      saved.filter(
        (i): i is number => Number.isInteger(i) && i >= 0 && i < count,
      ),
    ),
  ].sort((a, b) => a - b);
}
