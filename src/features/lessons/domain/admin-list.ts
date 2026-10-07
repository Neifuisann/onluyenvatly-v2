/**
 * `/admin/lessons` list state and the rules behind its actions (S5-01). Pure:
 * the URL is the only filter state; reordering works on the full id list.
 */
import { z } from "zod";

export const LESSON_STATUSES = ["draft", "published", "archived"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

/**
 * List order: last change (the default), creation, title, or the teacher's
 * manual order (the catalog's default sort), the only one that can be
 * dragged.
 */
export const ADMIN_SORTS = ["updated", "created", "title", "manual"] as const;
export type AdminSort = (typeof ADMIN_SORTS)[number];
export type SortDir = "asc" | "desc";

export const DEFAULT_SORT: AdminSort = "updated";

/** Dates newest first, titles A–Z, the manual order top to bottom. */
export function defaultDir(sort: AdminSort): SortDir {
  return sort === "updated" || sort === "created" ? "desc" : "asc";
}

export type AdminListFilters = {
  q: string | null;
  status: LessonStatus | null;
  sort: AdminSort;
  /** Always `asc` for the manual order. */
  dir: SortDir;
  /** 1-based; clamped to the last page by `paginate`. */
  page: number;
};

/** Rows per page of `/admin/lessons`. */
export const ADMIN_PAGE_SIZE = 20;

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.normalize("NFC").replace(/\s+/g, " ").trim();

const FiltersSchema = z.object({
  q: z
    .string()
    .max(80)
    .nullable()
    .catch(null)
    .transform((s) => s || null),
  status: z.enum(LESSON_STATUSES).nullable().catch(null),
  sort: z.enum(ADMIN_SORTS).catch(DEFAULT_SORT),
  dir: z.enum(["asc", "desc"]).nullable().catch(null),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

/**
 * Never throws: anything invalid falls back to "no filter", the default
 * order and page 1.
 */
export function parseAdminListParams(params: RawParams): AdminListFilters {
  const { dir, ...f } = FiltersSchema.parse({
    q: first(params.q) || null,
    status: first(params.status) || null,
    sort: first(params.sort) || DEFAULT_SORT,
    dir: first(params.dir) || null,
    page: first(params.page) || 1,
  });
  return {
    ...f,
    dir: f.sort === "manual" ? "asc" : (dir ?? defaultDir(f.sort)),
  };
}

/** A new search or status starts again on page 1 unless `page` is patched. */
export function adminListHref(
  f: AdminListFilters,
  patch: Partial<AdminListFilters> = {},
): string {
  const next = { ...f, page: 1, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status) params.set("status", next.status);
  if (next.sort !== DEFAULT_SORT) params.set("sort", next.sort);
  if (next.sort !== "manual" && next.dir !== defaultDir(next.sort))
    params.set("dir", next.dir);
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/admin/lessons?${qs}` : "/admin/lessons";
}

/**
 * Clicking a column's arrow: the same column flips direction, another one
 * starts in its natural direction. Back to page 1 either way.
 */
export function sortHref(f: AdminListFilters, sort: AdminSort): string {
  const dir =
    f.sort === sort && sort !== "manual"
      ? f.dir === "asc"
        ? "desc"
        : "asc"
      : defaultDir(sort);
  return adminListHref(f, { sort, dir });
}

/** True when a search or status filter narrows the list. */
export function isFiltered(f: Pick<AdminListFilters, "q" | "status">): boolean {
  return Boolean(f.q || f.status);
}

/** Drag-reorder only makes sense on the whole list in the manual order. */
export function canReorder(
  f: Pick<AdminListFilters, "q" | "status" | "sort">,
): boolean {
  return !isFiltered(f) && f.sort === "manual";
}

type Sortable = { id: number; title: string; createdAt: Date; updatedAt: Date };

const titleCollator = new Intl.Collator("vi", {
  sensitivity: "base",
  numeric: true,
});

/**
 * `rows` (read in the manual order) in the chosen order. Ties fall back to
 * the id, so the order is stable between requests.
 */
export function sortAdminRows<T extends Sortable>(
  rows: readonly T[],
  sort: AdminSort,
  dir: SortDir,
): T[] {
  if (sort === "manual") return [...rows];
  const sign = dir === "asc" ? 1 : -1;
  const compare = (a: T, b: T): number => {
    switch (sort) {
      case "title":
        return titleCollator.compare(a.title.trim(), b.title.trim());
      case "created":
        return a.createdAt.getTime() - b.createdAt.getTime();
      case "updated":
        return a.updatedAt.getTime() - b.updatedAt.getTime();
    }
  };
  return [...rows].sort((a, b) => sign * (compare(a, b) || a.id - b.id));
}

/**
 * The full order after one page was reordered: `all` with the ids from
 * `offset` on replaced by `page`. Moves that cross a page edge are plain
 * `moveItem`s on the full list.
 */
export function withPageOrder(
  all: readonly number[],
  offset: number,
  page: readonly number[],
): number[] {
  const out = [...all];
  out.splice(offset, page.length, ...page);
  return out;
}

/** A copy of `list` with the item at `from` moved to index `to` (clamped). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length) return out;
  const [item] = out.splice(from, 1) as [T];
  const target = Math.max(0, Math.min(to, out.length));
  out.splice(target, 0, item);
  return out;
}

/** True when `proposed` is exactly a reordering of `current` (no dupes, none missing). */
export function isReorderOf(
  current: readonly number[],
  proposed: readonly number[],
): boolean {
  if (current.length !== proposed.length) return false;
  const set = new Set(current);
  const seen = new Set<number>();
  for (const id of proposed) {
    if (!set.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

export const COPY_SUFFIX = " (bản sao)";

/** Title of a duplicated lesson. */
export function copyTitle(title: string): string {
  return `${title}${COPY_SUFFIX}`;
}

export const LessonIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2 ** 53);

export const ReorderSchema = z.strictObject({
  ids: z
    .array(LessonIdSchema)
    .min(1)
    .max(2000)
    .refine((ids) => new Set(ids).size === ids.length),
});
