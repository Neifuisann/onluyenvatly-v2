/**
 * Leaderboard rules (S4-05, 01 R6). Pure: the cached query hands over rows
 * already sorted by the database; these rank them, pick what the page shows
 * and find the viewer's own row without another query.
 */
import { z } from "zod";

export const LEADERBOARD_PERIODS = ["all", "week"] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export type LeaderboardFilters = {
  grade: 10 | 11 | 12 | null;
  /** `all`: by current rating. `week`: most improved over the last 7 days. */
  period: LeaderboardPeriod;
};

export const DEFAULT_LEADERBOARD: LeaderboardFilters = {
  grade: null,
  period: "all",
};

/** Rows rendered on the page. */
export const SHOWN_ROWS = 100;
/**
 * Rows the cached query keeps, so a student below the shown rows still finds
 * their rank without a per-user query. v1 has 273 rated students.
 */
export const MAX_ROWS = 1000;

export type LeaderboardEntry = {
  userId: string;
  fullName: string;
  className: string | null;
  rating: number;
  /** Sum of rating changes in the last 7 days. */
  weekDelta: number;
};

export type RankedEntry = LeaderboardEntry & { rank: number };

/** The value a period ranks by. */
export const rankKey = (e: LeaderboardEntry, period: LeaderboardPeriod) =>
  period === "week" ? e.weekDelta : e.rating;

/**
 * Competition ranking ("1, 2, 2, 4"): equal values share a rank, so the
 * order of a tie never decides who is higher. Rows must be sorted by the key,
 * highest first.
 */
export function withRanks(
  rows: readonly LeaderboardEntry[],
  period: LeaderboardPeriod,
): RankedEntry[] {
  let rank = 0;
  let previous: number | undefined;
  return rows.map((row, i) => {
    const key = rankKey(row, period);
    if (key !== previous) rank = i + 1;
    previous = key;
    return { ...row, rank };
  });
}

export type LeaderboardView = {
  shown: RankedEntry[];
  /** The viewer, when ranked. */
  me: RankedEntry | null;
  /** True when `me` falls below `shown` and is rendered after it. */
  meBelow: boolean;
};

/** The rows to render plus the viewer's own row. */
export function leaderboardView(
  rows: readonly RankedEntry[],
  userId: string,
  shownRows = SHOWN_ROWS,
): LeaderboardView {
  const shown = rows.slice(0, shownRows);
  const index = rows.findIndex((r) => r.userId === userId);
  return {
    shown,
    me: rows[index] ?? null,
    meBelow: index >= shownRows,
  };
}

/** Avatar letters: family and given name, "Nguyễn Văn Huy" → "NH". */
export function initials(fullName: string): string {
  const words = fullName.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  const last = words.at(-1);
  if (!first || !last) return "?";
  const letter = (w: string) => Array.from(w)[0]?.toLocaleUpperCase("vi");
  return words.length > 1
    ? `${letter(first)}${letter(last)}`
    : `${letter(first)}`;
}

/** `/leaderboard` URL for the filters with `patch` applied; defaults omitted. */
export function leaderboardHref(
  filters: LeaderboardFilters,
  patch: Partial<LeaderboardFilters> = {},
): string {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (next.grade) params.set("grade", String(next.grade));
  if (next.period !== "all") params.set("period", next.period);
  const query = params.toString();
  return query ? `/leaderboard?${query}` : "/leaderboard";
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() || null;

const ParamsSchema = z.object({
  grade: z.coerce
    .number()
    .pipe(z.union([z.literal(10), z.literal(11), z.literal(12)]))
    .nullable()
    .catch(null),
  period: z.enum(LEADERBOARD_PERIODS).catch("all"),
});

/** Untrusted search params → filters. Never throws: bad values use defaults. */
export function parseLeaderboardParams(params: RawParams): LeaderboardFilters {
  return ParamsSchema.parse({
    grade: first(params.grade),
    period: first(params.period) ?? "all",
  }) as LeaderboardFilters;
}
