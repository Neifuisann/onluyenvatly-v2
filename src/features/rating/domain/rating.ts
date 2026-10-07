/**
 * ELO-like rating (00 §4.4, ADR-004). Pure: the submit transaction and the
 * rating replay call these with plain numbers.
 *
 * v2 is the only formula applied to new attempts. The v1 time bonus exists so
 * tests can prove the shared core reproduces migrated v1 history exactly.
 */

export const START_RATING = 1500;
export const K_FACTOR = 48;

export type Formula = "v2" | "v1-legacy";

/** Probability of "winning" against a fixed 1500 opponent (the test). */
export function expectedScore(rating: number): number {
  return 1 / (1 + 10 ** ((START_RATING - rating) / 400));
}

/** Rounded to 3 decimals, the precision `rating_events` stores. */
export const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Share of the points earned, 0..1, at stored precision. */
export function performance(score: number, maxScore: number): number {
  if (!(maxScore > 0)) return 0;
  return round3(Math.min(1, Math.max(0, score / maxScore)));
}

/**
 * v2 (ADR-004): `clamp(1 − 0.5·taken/limit, 0.5, 1)`; 1 without a limit.
 * Rounded to stored precision so a replay gets the same delta.
 */
export function timeBonusV2(
  timeTakenSec: number,
  timeLimitSec: number | null,
): number {
  if (!timeLimitSec || timeLimitSec <= 0) return 1;
  const raw = 1 - 0.5 * (Math.max(0, timeTakenSec) / timeLimitSec);
  return round3(Math.min(1, Math.max(0.5, raw)));
}

/** v1 quirk, kept only to verify history: 0 for anything over 5 minutes. */
export function timeBonusV1(timeTakenSec: number): number {
  return Math.max(0, 1 - timeTakenSec / 300);
}

/**
 * Rating change. Big wins double, big losses count 1.5×; the streak
 * multiplier is 1 (v1 always passed streak = 0). `Math.round` as in v1.
 */
export function ratingDelta(
  rating: number,
  perf: number,
  timeBonus: number,
): number {
  let delta = K_FACTOR * (perf - expectedScore(rating)) * timeBonus;
  if (delta > 0 && perf >= 0.8) delta *= 2;
  else if (delta < 0 && perf <= 0.5) delta *= 1.5;
  // `+ 0` turns -0 into 0.
  return Math.round(delta) + 0;
}

export type RatingState = { rating: number; peak: number; rated: number };

export const INITIAL_RATING: RatingState = {
  rating: START_RATING,
  peak: START_RATING,
  rated: 0,
};

export type RatingStep = {
  before: number;
  delta: number;
  after: number;
  state: RatingState;
};

/** One rated attempt applied to a student's rating. */
export function applyRating(
  state: RatingState,
  perf: number,
  timeBonus: number,
): RatingStep {
  const delta = ratingDelta(state.rating, perf, timeBonus);
  return step(state, delta);
}

function step(state: RatingState, delta: number): RatingStep {
  const after = state.rating + delta;
  return {
    before: state.rating,
    delta,
    after,
    state: {
      rating: after,
      peak: Math.max(state.peak, after),
      rated: state.rated + 1,
    },
  };
}

export type ReplayEvent = {
  formula: string;
  /** Stored delta; kept as is for migrated (v1-legacy) rows. */
  delta: number;
  performance: number | null;
  timeBonus: number | null;
};

/**
 * Recomputes a student's rating from their remaining events in order (05 §4,
 * delete attempt). Migrated rows keep their recorded delta (history isn't
 * recomputed, ADR-004); v2 rows are recomputed from what they stored.
 */
export function replayRatings(
  events: readonly ReplayEvent[],
  start: RatingState = INITIAL_RATING,
): { state: RatingState; steps: RatingStep[] } {
  let state = start;
  const steps: RatingStep[] = [];
  for (const e of events) {
    const s =
      e.formula === "v2" && e.performance !== null && e.timeBonus !== null
        ? applyRating(state, e.performance, e.timeBonus)
        : step(state, e.delta);
    steps.push(s);
    state = s.state;
  }
  return { state, steps };
}

/** A stored `rating_events` row, as the delete-attempt replay reads it. */
export type StoredRatingEvent = ReplayEvent & {
  id: number;
  before: number;
  after: number;
};

export type RewrittenEvent = {
  id: number;
  before: number;
  delta: number;
  after: number;
};

/**
 * Deleting a rated attempt (S6-04): replays the student's other events, in
 * order, from where their history started (the first event's `before`: 1500
 * for v2 students, the v1 starting point for migrated history). Returns the
 * new rating state (null when no event remains) and only the events whose
 * `before/delta/after` change.
 */
export function replayWithout(
  events: readonly StoredRatingEvent[],
  removedId: number,
): { state: RatingState | null; changed: RewrittenEvent[] } {
  const start = events[0]?.before ?? START_RATING;
  const remaining = events.filter((e) => e.id !== removedId);
  if (remaining.length === 0) return { state: null, changed: [] };
  const { state, steps } = replayRatings(remaining, {
    rating: start,
    peak: start,
    rated: 0,
  });
  // One step per remaining event, in the same order.
  const changed = steps.flatMap((s, i): RewrittenEvent[] => {
    const e = remaining[i] as StoredRatingEvent;
    return s.before === e.before && s.delta === e.delta && s.after === e.after
      ? []
      : [{ id: e.id, before: s.before, delta: s.delta, after: s.after }];
  });
  return { state, changed };
}

export type RescoredEvent = RewrittenEvent & { performance: number | null };

/**
 * A regrade (B-10) changed some attempts' scores: replays the student's
 * events in order, from where their history started, with the new
 * performance of those events. Returns the new state and only the events
 * whose performance or `before/delta/after` change.
 */
export function replayWithPerformance(
  events: readonly StoredRatingEvent[],
  performances: ReadonlyMap<number, number>,
): { state: RatingState; changed: RescoredEvent[] } {
  const start = events[0]?.before ?? START_RATING;
  const updated = events.map((e) => ({
    ...e,
    performance: performances.get(e.id) ?? e.performance,
  }));
  const { state, steps } = replayRatings(updated, {
    rating: start,
    peak: start,
    rated: 0,
  });
  const changed = steps.flatMap((s, i): RescoredEvent[] => {
    const e = updated[i] as StoredRatingEvent;
    const old = events[i] as StoredRatingEvent;
    return s.before === old.before &&
      s.delta === old.delta &&
      s.after === old.after &&
      e.performance === old.performance
      ? []
      : [
          {
            id: e.id,
            before: s.before,
            delta: s.delta,
            after: s.after,
            performance: e.performance,
          },
        ];
  });
  return { state, changed };
}

export const TIERS = [
  { id: "master", min: 2000 },
  { id: "diamond", min: 1800 },
  { id: "platinum", min: 1600 },
  { id: "gold", min: 1400 },
  { id: "silver", min: 1200 },
  { id: "bronze", min: Number.NEGATIVE_INFINITY },
] as const;

export type Tier = (typeof TIERS)[number]["id"];

export function tierOf(rating: number): Tier {
  return TIERS.find((t) => rating >= t.min)?.id ?? "bronze";
}
