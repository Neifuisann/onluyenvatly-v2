/**
 * `/admin/audit?area=&page=` (M11): the audit log's list state and how a row
 * is shown. Pure: the URL is the only filter state, and anything invalid
 * falls back to every area, page 1.
 */
import { z } from "zod";

/** Rows per page, and the deepest page (the log is kept 180 days). */
export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_MAX_PAGE = 100;
/** The count stops here, so it never walks the whole table. */
export const AUDIT_COUNT_CAP = AUDIT_PAGE_SIZE * AUDIT_MAX_PAGE;

/**
 * Each area is one or more action prefixes (the part before the dot), the
 * expression `audit_log_area_created_idx` indexes.
 */
export const AUDIT_AREAS = {
  lessons: ["lesson"],
  students: ["student"],
  results: ["attempt"],
  explanations: ["explanation"],
  accounts: ["account"],
  settings: ["settings", "admin"],
} as const satisfies Record<string, readonly [string, ...string[]]>;

export type AuditArea = keyof typeof AUDIT_AREAS;
export const AUDIT_AREA_KEYS = Object.keys(AUDIT_AREAS) as AuditArea[];

export type AuditFilters = {
  area: AuditArea | null;
  /** 1-based; clamped to the last page by `auditPages`. */
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim();

const FiltersSchema = z.object({
  area: z
    .enum(AUDIT_AREA_KEYS as [AuditArea, ...AuditArea[]])
    .nullable()
    .catch(null),
  page: z.coerce.number().int().min(1).max(AUDIT_MAX_PAGE).catch(1),
});

/** Never throws. */
export function parseAuditParams(params: RawParams): AuditFilters {
  return FiltersSchema.parse({
    area: first(params.area) || null,
    page: first(params.page) || 1,
  });
}

/** A new area starts again on page 1 unless `page` is patched. */
export function auditHref(
  f: AuditFilters,
  patch: Partial<AuditFilters> = {},
): string {
  const next = { ...f, page: 1, ...patch };
  const params = new URLSearchParams();
  if (next.area) params.set("area", next.area);
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/admin/audit?${qs}` : "/admin/audit";
}

/** The action prefixes to filter on, or null for every area. */
export function areaPrefixes(
  area: AuditArea | null,
): readonly [string, ...string[]] | null {
  return area ? AUDIT_AREAS[area] : null;
}

/**
 * Paging from a capped count (`counted` may be `AUDIT_COUNT_CAP + 1`, which
 * means "more than the cap"). A stale `?page=` past the end shows the last
 * page.
 */
export function auditPages(
  counted: number,
  requested: number,
): {
  total: number;
  capped: boolean;
  page: number;
  pageCount: number;
  offset: number;
} {
  const total = Math.min(Math.max(0, counted), AUDIT_COUNT_CAP);
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(requested) || 1), pageCount);
  return {
    total,
    capped: counted > AUDIT_COUNT_CAP,
    page,
    pageCount,
    offset: (page - 1) * AUDIT_PAGE_SIZE,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INT = /^\d{1,15}$/;

export type AuditTarget = {
  action: string;
  targetType: string | null;
  targetId: string | null;
};

/**
 * The admin page a row's target opens, or null: nothing to open, the action
 * deleted it, or the target has no page of its own (an admin account, an
 * explanation hash).
 */
export function auditTargetHref({
  action,
  targetType,
  targetId,
}: AuditTarget): string | null {
  if (targetType === "settings") return "/admin/settings";
  if (!targetId || action.endsWith(".delete")) return null;
  switch (targetType) {
    case "lesson":
      return INT.test(targetId) ? `/admin/lessons/${targetId}/edit` : null;
    case "user":
      return /^(student|account)\./.test(action) && UUID.test(targetId)
        ? `/admin/students/${targetId}`
        : null;
    case "attempt":
      return UUID.test(targetId) ? `/attempts/${targetId}/result` : null;
    default:
      return null;
  }
}

/** A target id short enough for a phone row: `#12`, or the first 8 characters. */
export function shortTargetId(id: string | null): string | null {
  if (!id) return null;
  return INT.test(id) ? `#${id}` : id.slice(0, 8);
}

const MAX_ENTRIES = 6;
const MAX_VALUE = 60;

function formatValue(
  v: unknown,
  words: { yes: string; no: string },
  depth = 0,
): string {
  if (v === null || v === undefined) return "–";
  if (typeof v === "boolean") return v ? words.yes : words.no;
  // Numbers stay raw: most are ids, which a "3.876" grouping would misread.
  if (typeof v === "number" || typeof v === "string") return String(v);
  if (Array.isArray(v) && depth === 0)
    return v.map((x) => formatValue(x, words, 1)).join(", ");
  return JSON.stringify(v);
}

const clip = (s: string) =>
  s.length > MAX_VALUE ? `${s.slice(0, MAX_VALUE - 1)}…` : s;

/**
 * `audit_log.data` (ids and counts only, 04 `audit_log`) as short
 * `key: value` pairs: at most 6, values clipped to 60 characters. Anything
 * but a plain object shows nothing.
 */
export function summarizeAuditData(
  data: unknown,
  words: { yes: string; no: string },
): { key: string; value: string }[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  return Object.entries(data)
    .slice(0, MAX_ENTRIES)
    .map(([key, value]) => ({ key, value: clip(formatValue(value, words)) }));
}
