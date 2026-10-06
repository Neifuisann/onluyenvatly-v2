/**
 * Race standings and the teacher's per-question report (B-05). Pure: the
 * service reads the room's players once and these shape every view of them.
 */
import type { GameMark, MarkKind } from "./scoring.ts";

export type StandingInput = {
  /** `game_players.id`: public, unlike the user id. */
  id: number;
  name: string;
  racer: string;
  color: number;
  score: number;
  answered: number;
  correct: number;
  bestStreak: number;
  finishedAt: Date | null;
};

export type Standing = Omit<StandingInput, "finishedAt"> & {
  rank: number;
  finished: boolean;
};

/**
 * Highest score first; equal scores share a rank ("1, 2, 2, 4"). Inside a
 * tie, more correct answers, then whoever crossed the line first, are listed
 * first, but the rank stays shared.
 */
export function rankPlayers(rows: readonly StandingInput[]): Standing[] {
  const finishMs = (r: StandingInput) =>
    r.finishedAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const sorted = [...rows].sort(
    (a, b) =>
      b.score - a.score ||
      b.correct - a.correct ||
      finishMs(a) - finishMs(b) ||
      a.id - b.id,
  );
  let rank = 0;
  let previous: number | undefined;
  return sorted.map(({ finishedAt, ...row }, i) => {
    if (row.score !== previous) rank = i + 1;
    previous = row.score;
    return { ...row, rank, finished: finishedAt !== null };
  });
}

/** Leaders shown on a phone during the race. */
export const PHONE_TOP = 5;

export type PlayerView = {
  top: Standing[];
  me: Standing | null;
  /** The player just ahead of me and how many points behind I am. */
  ahead: { name: string; gap: number } | null;
  total: number;
};

/** What one player's screen shows: the top 5, themselves and the gap ahead. */
export function playerView(
  ranked: readonly Standing[],
  myId: number,
  top = PHONE_TOP,
): PlayerView {
  const index = ranked.findIndex((r) => r.id === myId);
  const me = ranked[index] ?? null;
  const before = index > 0 ? ranked[index - 1] : undefined;
  return {
    top: ranked.slice(0, top),
    me,
    ahead:
      me && before && before.score > me.score
        ? { name: before.name, gap: before.score - me.score }
        : null,
    total: ranked.length,
  };
}

export type QuestionStat = {
  /** Bank index. */
  index: number;
  answered: number;
  counts: Record<MarkKind, number>;
  /** Correct share of the players who reached it, 0–1; null when nobody did. */
  accuracy: number | null;
};

/**
 * Per bank question: how the players did. `marks` holds each player's
 * `game_players.marks` (bank-aligned, null where not reached).
 */
export function questionStats(
  bankSize: number,
  marks: readonly (readonly (GameMark | null)[])[],
): QuestionStat[] {
  return Array.from({ length: bankSize }, (_, index) => {
    const counts: Record<MarkKind, number> = {
      correct: 0,
      partial: 0,
      wrong: 0,
      blank: 0,
      timeout: 0,
    };
    let answered = 0;
    for (const m of marks) {
      const mark = m[index];
      if (!mark) continue;
      answered += 1;
      counts[mark.k] += 1;
    }
    return {
      index,
      answered,
      counts,
      accuracy: answered > 0 ? counts.correct / answered : null,
    };
  });
}

/** The questions the class found hardest: lowest accuracy, at least one answer. */
export function hardestQuestions(
  stats: readonly QuestionStat[],
  limit = 3,
): QuestionStat[] {
  return stats
    .filter((s) => s.accuracy !== null)
    .sort(
      (a, b) =>
        (a.accuracy ?? 0) - (b.accuracy ?? 0) ||
        b.answered - a.answered ||
        a.index - b.index,
    )
    .slice(0, limit);
}
