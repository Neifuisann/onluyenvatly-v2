import "server-only";
import { count, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, users } from "@/db/schema";
import {
  AUDIT_COUNT_CAP,
  AUDIT_PAGE_SIZE,
  type AuditFilters,
  areaPrefixes,
  auditPages,
} from "./domain/audit-log";

/**
 * `/admin/audit` (M11). Per request and uncached: admins only, and a new
 * entry should show at once. Newest first; the ORDER BY is served by
 * `audit_log_created_at_idx` scanned backward (every area) or by
 * `audit_log_area_created_idx` (one area, migration 0011), both ending with
 * a short incremental sort at most. The count stops at the cap.
 */

/** Same expression as `audit_log_area_created_idx`. */
const area = sql<string>`split_part(${auditLog.action}, '.', 1)`;

function auditWhere(f: Pick<AuditFilters, "area">): SQL | undefined {
  const prefixes = areaPrefixes(f.area);
  if (!prefixes) return undefined;
  return prefixes.length === 1
    ? eq(area, prefixes[0])
    : inArray(area, [...prefixes]);
}

export type AuditRow = {
  id: number;
  action: string;
  targetType: string | null;
  targetId: string | null;
  data: unknown;
  createdAt: Date;
  actorId: string | null;
  /** null once the account was deleted (`actor_id` set null). */
  actorName: string | null;
  actorRole: "student" | "teacher" | "admin" | null;
};

/** One page of entries; exported for the EXPLAIN test. */
export function auditRowsQuery(f: Pick<AuditFilters, "area">, offset: number) {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      data: auditLog.data,
      createdAt: auditLog.createdAt,
      actorId: auditLog.actorId,
      actorName: users.fullName,
      actorRole: users.role,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(auditWhere(f))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(AUDIT_PAGE_SIZE)
    .offset(offset);
}

/** Matching entries, counted up to `AUDIT_COUNT_CAP + 1`. */
async function countAudit(f: Pick<AuditFilters, "area">): Promise<number> {
  const capped = db
    .select({ one: sql`1` })
    .from(auditLog)
    .where(auditWhere(f))
    .limit(AUDIT_COUNT_CAP + 1)
    .as("capped");
  const [row] = await db.select({ n: count() }).from(capped);
  return row?.n ?? 0;
}

export type AuditPage = ReturnType<typeof auditPages> & { rows: AuditRow[] };

/**
 * The requested page and the count in parallel; a stale `?page=` past the
 * end (rare) reads the last page again.
 */
export async function getAuditLog(f: AuditFilters): Promise<AuditPage> {
  const requested = auditPages(AUDIT_COUNT_CAP, f.page);
  const [counted, rows] = await Promise.all([
    countAudit(f),
    auditRowsQuery(f, requested.offset),
  ]);
  const pages = auditPages(counted, f.page);
  return {
    ...pages,
    rows:
      pages.offset === requested.offset
        ? rows
        : await auditRowsQuery(f, pages.offset),
  };
}
