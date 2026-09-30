/**
 * `/admin/lessons` list state and the rules behind its actions (S5-01). Pure:
 * the URL is the only filter state; reordering works on the full id list.
 */
import { z } from "zod";

export const LESSON_STATUSES = ["draft", "published", "archived"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export type AdminListFilters = {
  q: string | null;
  status: LessonStatus | null;
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
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

/** Never throws: anything invalid falls back to "no filter", page 1. */
export function parseAdminListParams(params: RawParams): AdminListFilters {
  return FiltersSchema.parse({
    q: first(params.q) || null,
    status: first(params.status) || null,
    page: first(params.page) || 1,
  });
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
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/admin/lessons?${qs}` : "/admin/lessons";
}

/** Drag-reorder only makes sense on the whole, unfiltered list. */
export function canReorder(f: Pick<AdminListFilters, "q" | "status">): boolean {
  return !f.q && !f.status;
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
