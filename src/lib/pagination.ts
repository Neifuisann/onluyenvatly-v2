/**
 * Numbered pagination (pure). Pages are 1-based; out-of-range requests are
 * clamped so a stale `?page=9` after deletions still shows the last page.
 */

export type PageSlice<T> = {
  items: T[];
  page: number;
  pageCount: number;
  /** Index of `items[0]` in the whole list. */
  offset: number;
  total: number;
};

export function paginate<T>(
  all: readonly T[],
  page: number,
  size: number,
): PageSlice<T> {
  const pageCount = Math.max(1, Math.ceil(all.length / size));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);
  const offset = (current - 1) * size;
  return {
    items: all.slice(offset, offset + size),
    page: current,
    pageCount,
    offset,
    total: all.length,
  };
}

/**
 * The page numbers to show: first, last, and `current ± 1`, with `null`
 * where a run of pages is skipped. Never skips a single page (shows it
 * instead of "…"), so the list is stable in width: at most 7 slots.
 */
export function pageWindow(current: number, count: number): (number | null)[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const from = Math.max(2, Math.min(current - 1, count - 4));
  const to = Math.min(count - 1, Math.max(current + 1, 5));
  const out: (number | null)[] = [1];
  if (from > 2) out.push(from === 3 ? 2 : null);
  for (let p = from; p <= to; p++) out.push(p);
  if (to < count - 1) out.push(to === count - 2 ? count - 1 : null);
  out.push(count);
  return out;
}
