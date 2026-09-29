import type { AttemptAnswer, GuardEvent } from "../../../src/db/schema.ts";

/**
 * S6-04: the submitted attempts `pnpm seed --profile e2e` gives each results
 * student (fixtures/users `results`, `results2`), oldest first, rated with
 * the real v2 formula so deleting one replays the rating. Items follow the
 * seeded runner lessons (no shuffle, teacher's points).
 */
export type E2eResultAttempt = {
  lesson: "e2e-runner" | "e2e-timer";
  hoursAgo: number;
  items: { q: string; p: number }[];
  answers: AttemptAnswer[];
  earned: number[];
  timeTakenSec: number;
  /** The lesson's time limit, for the time bonus. */
  timeLimitSec: number | null;
  guardEvents: GuardEvent[];
};

const runnerItems = [
  { q: "q_run_mcq1", p: 0.25 },
  { q: "q_run_mcq2", p: 0.25 },
  { q: "q_run_tf1", p: 1 },
  { q: "q_run_short1", p: 0.5 },
];

/** What the guarded attempt recorded, in the order the timeline shows. */
export const RESULT_GUARD_EVENTS: GuardEvent[] = [
  { t: 15, k: "blur" },
  { t: 42, k: "copy" },
  { t: 75, k: "hidden" },
];

export const e2eResultAttempts: E2eResultAttempt[] = [
  {
    lesson: "e2e-runner",
    hoursAgo: 3,
    items: runnerItems,
    answers: ["B", "B", [true, false, true, false], "0.63"],
    earned: [0.25, 0.25, 1, 0.5],
    timeTakenSec: 120,
    timeLimitSec: null,
    guardEvents: RESULT_GUARD_EVENTS,
  },
  // The middle one, which the desktop project deletes.
  {
    lesson: "e2e-timer",
    hoursAgo: 2,
    items: runnerItems.slice(0, 2),
    answers: ["A", "A"],
    earned: [0, 0],
    timeTakenSec: 50,
    timeLimitSec: 60,
    guardEvents: [],
  },
  {
    lesson: "e2e-runner",
    hoursAgo: 1,
    items: runnerItems,
    answers: ["B", "A", [true, false, null, null], null],
    earned: [0.25, 0, 0.25, 0],
    timeTakenSec: 300,
    timeLimitSec: null,
    guardEvents: [],
  },
];
