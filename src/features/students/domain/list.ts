/**
 * `/admin/students` list state (S6-01). Pure: the URL is the only filter
 * state, and anything invalid falls back to "no filter".
 */
import { z } from "zod";

export const STUDENT_VIEWS = ["pending", "all"] as const;
export type StudentView = (typeof STUDENT_VIEWS)[number];

export const STUDENT_STATUSES = [
  "pending",
  "active",
  "rejected",
  "disabled",
] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const STUDENT_GRADES = [10, 11, 12] as const;
export type StudentGrade = (typeof STUDENT_GRADES)[number];

/** Rows per "Xem thêm" step of the "Tất cả" tab. */
export const PAGE_SIZE = 50;
export const MAX_PAGE = 20;
/** One bulk approve/reject and the pending tab show at most this many. */
export const BULK_LIMIT = 200;

export type StudentListFilters = {
  view: StudentView;
  q: string | null;
  status: StudentStatus | null;
  grade: StudentGrade | null;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.normalize("NFC").replace(/\s+/g, " ").trim();

const FiltersSchema = z.object({
  view: z.enum(STUDENT_VIEWS).catch("pending"),
  q: z
    .string()
    .max(80)
    .nullable()
    .catch(null)
    .transform((s) => s || null),
  status: z.enum(STUDENT_STATUSES).nullable().catch(null),
  grade: z.coerce
    .number()
    .pipe(z.union([z.literal(10), z.literal(11), z.literal(12)]))
    .nullable()
    .catch(null),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1),
});

/** Never throws. */
export function parseStudentListParams(params: RawParams): StudentListFilters {
  return FiltersSchema.parse({
    view: first(params.view) || "pending",
    q: first(params.q) || null,
    status: first(params.status) || null,
    grade: first(params.grade) || null,
    page: first(params.page) || 1,
  }) as StudentListFilters;
}

/**
 * `/admin/students?…` with defaults left out. Changing anything but the page
 * starts again from the first page.
 */
export function studentsHref(
  f: StudentListFilters,
  patch: Partial<StudentListFilters> = {},
): string {
  const changed = Object.keys(patch).some((k) => k !== "page");
  const next = { ...f, ...patch, page: patch.page ?? (changed ? 1 : f.page) };
  const params = new URLSearchParams();
  if (next.view !== "pending") params.set("view", next.view);
  if (next.view === "all") {
    if (next.q) params.set("q", next.q);
    if (next.status) params.set("status", next.status);
    if (next.grade) params.set("grade", String(next.grade));
    if (next.page > 1) params.set("page", String(next.page));
  }
  const qs = params.toString();
  return qs ? `/admin/students?${qs}` : "/admin/students";
}

export type StudentSearch =
  | { kind: "phone"; prefix: string }
  | { kind: "name"; terms: string[] };

/**
 * A query of digits (`0912 345`, `+84 912…`, `0912.345`) is a phone prefix;
 * anything else is name words, each LIKE-escaped, at most 5 (all must match,
 * accent-insensitively, in any order).
 */
export function parseSearch(q: string | null): StudentSearch | null {
  if (!q) return null;
  if (/^\+?[\d\s.-]+$/.test(q)) {
    const digits = q.replace(/\D/g, "");
    const local = digits.startsWith("84") ? `0${digits.slice(2)}` : digits;
    if (local.length >= 3) return { kind: "phone", prefix: local };
  }
  const terms = q
    .split(" ")
    .filter(Boolean)
    .slice(0, 5)
    .map((w) => w.replace(/[\\%_]/g, "\\$&"));
  return terms.length ? { kind: "name", terms } : null;
}
