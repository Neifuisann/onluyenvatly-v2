import { describe, expect, it } from "vitest";
import history from "../../../../tests/fixtures/v1/rating-history.json" with {
  type: "json",
};
import {
  applyRating,
  expectedScore,
  INITIAL_RATING,
  performance,
  ratingDelta,
  replayRatings,
  replayWithout,
  replayWithPerformance,
  tierOf,
  timeBonusV1,
  timeBonusV2,
} from "./rating.ts";

describe("v1 history (anonymized real rows)", () => {
  it.each(history)("reproduces row $id exactly", ({
    previous_rating,
    rating_change,
    new_rating,
    performance,
    time_taken,
  }) => {
    const delta = ratingDelta(
      previous_rating,
      performance,
      timeBonusV1(time_taken),
    );
    expect(delta).toBe(rating_change);
    expect(previous_rating + delta).toBe(new_rating);
  });

  it("covers gains, losses and the > 5 min zero", () => {
    const changes = history.map((r) => Math.sign(r.rating_change));
    expect(new Set(changes)).toEqual(new Set([-1, 0, 1]));
  });
});

describe("v2 formula (ADR-004)", () => {
  it("expects 0.5 against the 1500 test", () => {
    expect(expectedScore(1500)).toBe(0.5);
    expect(expectedScore(1900)).toBeCloseTo(10 / 11, 12);
  });

  it.each([
    // rating, perf, bonus, delta
    [1500, 1, 1, 48], // 48·0.5 ×2
    [1500, 0.8, 1, 29], // 48·0.3 = 14.4 ×2 = 28.8
    [1500, 0.79, 1, 14], // 13.92, no bonus under 0.8
    [1500, 0.5, 1, 0],
    [1500, 0, 1, -36], // −24 ×1.5
    [1500, 0.51, 1, 0], // 0.48 → 0
    [1500, 0.4, 1, -7], // −4.8 ×1.5 = −7.2
    [1500, 0, 0.5, -18],
    [1500, 1, 0.5, 24],
    [2400, 1, 1, 1], // 48·(1 − 0.9944)·2 = 0.54
    [1000, 0, 1, -4], // 48·(−0.053)·1.5 = −3.83
  ] as const)("R %i, perf %f, bonus %f → %i", (r, perf, bonus, delta) => {
    expect(ratingDelta(r, perf, bonus)).toBe(delta);
  });

  it("never returns −0", () => {
    expect(Object.is(ratingDelta(1500, 0.5, 1), 0)).toBe(true);
    expect(Object.is(ratingDelta(1500, 0.499, 1), 0)).toBe(true);
  });

  it("changes the rating on a zero score too", () => {
    expect(ratingDelta(1500, 0, timeBonusV2(600, 600))).toBeLessThan(0);
  });

  it.each([
    [0, 600, 1],
    [300, 600, 0.75],
    [600, 600, 0.5],
    [900, 600, 0.5],
    [-5, 600, 1],
    [200, 3000, 0.967],
    [1200, null, 1],
    [1200, 0, 1],
  ] as const)("time bonus %i s of %s s → %f", (taken, limit, bonus) => {
    expect(timeBonusV2(taken, limit)).toBe(bonus);
  });

  it("v1 time bonus hits zero after 5 minutes", () => {
    expect(timeBonusV1(150)).toBe(0.5);
    expect(timeBonusV1(300)).toBe(0);
    expect(timeBonusV1(1200)).toBe(0);
  });

  it("measures performance at stored precision", () => {
    expect(performance(1.75, 1.75)).toBe(1);
    expect(performance(0.5, 1.75)).toBe(0.286);
    expect(performance(1, 126)).toBe(0.008);
    expect(performance(3, 0)).toBe(0);
    expect(performance(-1, 10)).toBe(0);
    expect(performance(11, 10)).toBe(1);
  });
});

describe("applyRating", () => {
  it("tracks before/after, peak and the rated count", () => {
    const up = applyRating(INITIAL_RATING, 1, 1);
    expect(up).toEqual({
      before: 1500,
      delta: 48,
      after: 1548,
      state: { rating: 1548, peak: 1548, rated: 1 },
    });
    const down = applyRating(up.state, 0, 1);
    expect(down.after).toBeLessThan(1548);
    expect(down.state.peak).toBe(1548);
    expect(down.state.rated).toBe(2);
  });
});

describe("replayRatings", () => {
  const attempts = [
    { performance: 1, timeBonus: 1 },
    { performance: 0.286, timeBonus: 0.842 },
    { performance: 0, timeBonus: 0.5 },
    { performance: 0.9, timeBonus: 0.967 },
  ];

  function live(list: typeof attempts) {
    let state = INITIAL_RATING;
    return list.map((a) => {
      const s = applyRating(state, a.performance, a.timeBonus);
      state = s.state;
      return { formula: "v2", delta: s.delta, ...a, after: s.after };
    });
  }

  it("equals a fresh computation after deleting an attempt", () => {
    const events = live(attempts);
    const remaining = events.filter((_, i) => i !== 1);
    const fresh = live(attempts.filter((_, i) => i !== 1));
    const { state, steps } = replayRatings(remaining);
    expect(steps.map((s) => s.after)).toEqual(fresh.map((e) => e.after));
    expect(state.rating).toBe(fresh.at(-1)?.after);
    expect(state.rated).toBe(3);
  });

  it("replays unchanged events to the same rating", () => {
    const events = live(attempts);
    expect(replayRatings(events).state.rating).toBe(events.at(-1)?.after);
  });

  it("keeps migrated deltas and starts from any state", () => {
    const { state } = replayRatings(
      [
        {
          formula: "v1-legacy",
          delta: -38,
          performance: 0.008,
          timeBonus: null,
        },
        { formula: "v2", delta: 999, performance: null, timeBonus: null },
      ],
      { rating: 1550, peak: 1600, rated: 5 },
    );
    expect(state).toEqual({ rating: 2511, peak: 2511, rated: 7 });
  });
});

describe("replayWithout (delete attempt, S6-04)", () => {
  const inputs = [
    { performance: 1, timeBonus: 1 },
    { performance: 0.286, timeBonus: 0.842 },
    { performance: 0, timeBonus: 0.5 },
  ];

  /** Stored events as the submit transaction writes them, from `start`. */
  function stored(list: typeof inputs, start = INITIAL_RATING) {
    let state = start;
    return list.map((a, i) => {
      const s = applyRating(state, a.performance, a.timeBonus);
      state = s.state;
      return { id: i + 1, formula: "v2", ...a, ...s };
    });
  }

  it("equals a fresh computation without the removed event", () => {
    const events = stored(inputs);
    const { state, changed } = replayWithout(events, 2);
    const fresh = stored([inputs[0], inputs[2]] as typeof inputs);
    const last = fresh.at(-1);
    expect(state).toEqual(last?.state);
    // The first event is unchanged; only the third is rewritten.
    expect(changed).toEqual([
      {
        id: 3,
        before: fresh[1]?.before,
        delta: fresh[1]?.delta,
        after: fresh[1]?.after,
      },
    ]);
  });

  it("rewrites every later event when the first one goes", () => {
    const events = stored(inputs);
    const { state, changed } = replayWithout(events, 1);
    const fresh = stored(inputs.slice(1));
    expect(state).toEqual(fresh.at(-1)?.state);
    expect(changed.map((c) => c.id)).toEqual([2, 3]);
    expect(changed[0]?.before).toBe(1500);
  });

  it("changes nothing else when the last one goes", () => {
    const events = stored(inputs);
    expect(replayWithout(events, 3)).toEqual({
      state: events[1]?.state,
      changed: [],
    });
  });

  it("returns no state when no event remains", () => {
    expect(replayWithout(stored(inputs.slice(0, 1)), 1)).toEqual({
      state: null,
      changed: [],
    });
    expect(replayWithout([], 1)).toEqual({ state: null, changed: [] });
  });

  it("starts from the first event's rating (migrated history)", () => {
    const start = { rating: 1720, peak: 1720, rated: 0 };
    const events = [
      {
        id: 7,
        formula: "v1-legacy",
        delta: 30,
        before: 1720,
        after: 1750,
        performance: 0.9,
        timeBonus: null,
      },
      ...stored(inputs.slice(0, 2), { rating: 1750, peak: 1750, rated: 1 }).map(
        (e, i) => ({ ...e, id: 8 + i }),
      ),
    ];
    const { state } = replayWithout(events, 8);
    const fresh = stored(inputs.slice(1, 2), {
      ...start,
      rating: 1750,
      peak: 1750,
      rated: 1,
    });
    expect(state).toEqual(fresh.at(-1)?.state);
    expect(state?.rated).toBe(2);
  });
});

describe("tiers", () => {
  it.each([
    [1199, "bronze"],
    [1200, "silver"],
    [1399, "silver"],
    [1400, "gold"],
    [1600, "platinum"],
    [1800, "diamond"],
    [1999, "diamond"],
    [2000, "master"],
    [0, "bronze"],
  ] as const)("%i → %s", (rating, tier) => {
    expect(tierOf(rating)).toBe(tier);
  });
});

describe("replayWithPerformance (regrade, B-10)", () => {
  const inputs = [
    { performance: 1, timeBonus: 1 },
    { performance: 0.286, timeBonus: 0.842 },
    { performance: 0, timeBonus: 0.5 },
  ];
  function stored(list: typeof inputs) {
    let state = INITIAL_RATING;
    return list.map((a, i) => {
      const s = applyRating(state, a.performance, a.timeBonus);
      state = s.state;
      return { id: i + 1, formula: "v2", ...a, ...s };
    });
  }

  it("equals the history the student would have had with the new score", () => {
    const events = stored(inputs);
    const { state, changed } = replayWithPerformance(
      events,
      new Map([[2, 0.9]]),
    );
    const fresh = stored([
      inputs[0],
      { performance: 0.9, timeBonus: 0.842 },
      inputs[2],
    ] as typeof inputs);
    expect(state).toEqual(fresh.at(-1)?.state);
    expect(changed.map((c) => c.id)).toEqual([2, 3]);
    expect(changed[0]).toMatchObject({
      performance: 0.9,
      delta: fresh[1]?.delta,
    });
  });

  it("changes nothing for the same performance", () => {
    const events = stored(inputs);
    expect(replayWithPerformance(events, new Map([[3, 0]])).changed).toEqual(
      [],
    );
  });
});
