import "server-only";
import type { Executor } from "@/db/client";
import { auditLog } from "@/db/schema";

export type AuditEntry = {
  actorId: string;
  /** `lesson.reorder`, `lesson.delete`… */
  action: string;
  targetType?: string;
  targetId?: string | number;
  data?: Record<string, unknown>;
};

const toRow = (entry: AuditEntry) => ({
  actorId: entry.actorId,
  action: entry.action,
  targetType: entry.targetType ?? null,
  targetId: entry.targetId === undefined ? null : String(entry.targetId),
  data: entry.data ?? null,
});

/**
 * One `audit_log` row per admin mutation (04 §2, kept 180 days). Pass the
 * transaction so the entry commits with the change. No personal data in
 * `data`: ids and counts only.
 */
export async function writeAudit(
  ex: Executor,
  entry: AuditEntry,
): Promise<void> {
  await ex.insert(auditLog).values(toRow(entry));
}

/** Several entries in one INSERT (bulk actions write one row per target). */
export async function writeAuditMany(
  ex: Executor,
  entries: readonly AuditEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  await ex.insert(auditLog).values(entries.map(toRow));
}
