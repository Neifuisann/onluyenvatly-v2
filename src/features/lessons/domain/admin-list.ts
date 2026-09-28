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
};

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
});

/** Never throws: anything invalid falls back to "no filter". */
export function parseAdminListParams(params: RawParams): AdminListFilters {
  return FiltersSchema.parse({
    q: first(params.q) || null,
    status: first(params.status) || null,
  });
}

export function adminListHref(
  f: AdminListFilters,
  patch: Partial<AdminListFilters> = {},
): string {
  const next = { ...f, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status) params.set("status", next.status);
  const qs = params.toString();
  return qs ? `/admin/lessons?${qs}` : "/admin/lessons";
}

/** Drag-reorder only makes sense on the whole, unfiltered list. */
export function canReorder(f: AdminListFilters): boolean {
  return !f.q && !f.status;
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
