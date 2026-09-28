/**
 * `/admin/results` and its CSV export (S6-04). Pure: the URL is the only
 * filter state, anything invalid falls back to "no filter", and dates are
 * Vietnam calendar days.
 */
import { z } from "zod";

/** Rows per "Xem thêm" step; the page shows at most 20 steps. */
export const RESULTS_PAGE_SIZE = 50;
export const RESULTS_MAX_PAGE = 20;
/** The CSV export stops here (a school year is well under it). */
export const EXPORT_LIMIT = 10_000;

export type ResultsFilters = {
  lessonId: number | null;
  q: string | null;
  /** `YYYY-MM-DD`, Vietnam days, both inclusive. */
  from: string | null;
  to: string | null;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.normalize("NFC").replace(/\s+/g, " ").trim();

/** A real calendar day written `YYYY-MM-DD` (what `<input type="date">` sends). */
export function isCalendarDay(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    y >= 2000 &&
    y <= 2100 &&
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}

const day = z.string().refine(isCalendarDay).nullable().catch(null);

const FiltersSchema = z.object({
  lessonId: z.coerce
    .number()
    .int()
    .positive()
    .max(2 ** 53)
    .nullable()
    .catch(null),
  q: z
    .string()
    .max(80)
    .nullable()
    .catch(null)
    .transform((s) => s || null),
  from: day,
  to: day,
  page: z.coerce.number().int().min(1).max(RESULTS_MAX_PAGE).catch(1),
});

/** Never throws. A reversed date range is swapped. */
export function parseResultsParams(params: RawParams): ResultsFilters {
  const f = FiltersSchema.parse({
    lessonId: first(params.lesson) || null,
    q: first(params.q) || null,
    from: first(params.from) || null,
    to: first(params.to) || null,
    page: first(params.page) || 1,
  });
  if (f.from && f.to && f.from > f.to) [f.from, f.to] = [f.to, f.from];
  return f;
}

function toSearchParams(f: ResultsFilters, withPage: boolean) {
  const params = new URLSearchParams();
  if (f.lessonId) params.set("lesson", String(f.lessonId));
  if (f.q) params.set("q", f.q);
  if (f.from) params.set("from", f.from);
  if (f.to) params.set("to", f.to);
  if (withPage && f.page > 1) params.set("page", String(f.page));
  return params.toString();
}

/**
 * `/admin/results?…` with defaults left out. Changing anything but the page
 * starts again from the first page.
 */
export function resultsHref(
  f: ResultsFilters,
  patch: Partial<ResultsFilters> = {},
): string {
  const changed = Object.keys(patch).some((k) => k !== "page");
  const next = { ...f, ...patch, page: patch.page ?? (changed ? 1 : f.page) };
  const qs = toSearchParams(next, true);
  return qs ? `/admin/results?${qs}` : "/admin/results";
}

/** The CSV of the same filters (every page). */
export function exportHref(f: ResultsFilters): string {
  const qs = toSearchParams(f, false);
  return qs ? `/admin/results/export?${qs}` : "/admin/results/export";
}

export const hasFilters = (f: ResultsFilters) =>
  Boolean(f.lessonId || f.q || f.from || f.to);

/** Midnight of a Vietnam day (UTC+7, no daylight saving) as an instant. */
export function vnDayStart(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00+07:00`);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** `submitted_at >= since` and `< before`, from the inclusive day range. */
export function submittedRange(f: Pick<ResultsFilters, "from" | "to">): {
  since: Date | null;
  before: Date | null;
} {
  return {
    since: f.from ? vnDayStart(f.from) : null,
    before: f.to ? new Date(vnDayStart(f.to).getTime() + DAY_MS) : null,
  };
}

/**
 * Student-name words, each LIKE-escaped, at most 5; all must match,
 * accent-insensitively, in any order.
 */
export function nameTerms(q: string | null): string[] {
  if (!q) return [];
  return q
    .split(" ")
    .filter(Boolean)
    .slice(0, 5)
    .map((w) => w.replace(/[\\%_]/g, "\\$&"));
}
