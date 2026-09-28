/**
 * Catalog URL state (05 §1: `/lessons?q=&grade=&chapter=&tag=&sort=&page=`).
 * The URL is the only state, so filtered views are shareable and survive the
 * back button. Pure and dependency-free (the filter bar is a client component);
 * parsing untrusted params lives in catalog-params.ts.
 */
export const CATALOG_SORTS = ["order", "newest", "popular", "title"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

/** Cards per "Xem thêm" step (07 §5.5). */
export const PAGE_SIZE = 24;
export const MAX_PAGE = 20;

export type CatalogFilters = {
  q: string | null;
  grade: 10 | 11 | 12 | null;
  chapter: string | null;
  tag: string | null;
  sort: CatalogSort;
  /** Cumulative: page 2 shows the first 48 cards. */
  page: number;
};

export const DEFAULT_FILTERS: CatalogFilters = {
  q: null,
  grade: null,
  chapter: null,
  tag: null,
  sort: "order",
  page: 1,
};

export function hasFilters(f: CatalogFilters): boolean {
  return Boolean(f.q || f.grade || f.chapter || f.tag);
}

/** `/lessons?…` with defaults left out, for links and "Xem thêm". */
export function catalogHref(
  f: CatalogFilters,
  patch: Partial<CatalogFilters> = {},
): string {
  const next = { ...f, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.grade) params.set("grade", String(next.grade));
  if (next.chapter) params.set("chapter", next.chapter);
  if (next.tag) params.set("tag", next.tag);
  if (next.sort !== "order") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/lessons?${qs}` : "/lessons";
}

/**
 * Search words for SQL: at most 5, each LIKE-escaped. Every word must match
 * (so "dong dao" also finds "Dao động").
 */
export function searchTerms(q: string | null): string[] {
  if (!q) return [];
  return q
    .split(" ")
    .filter(Boolean)
    .slice(0, 5)
    .map((w) => w.replace(/[\\%_]/g, "\\$&"));
}
