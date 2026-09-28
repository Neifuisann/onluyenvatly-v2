import "server-only";
import type { Executor } from "@/db/client";
import { auditLog } from "@/db/schema";

/**
 * One `audit_log` row per admin mutation (04 §2, kept 180 days). Pass the
 * transaction so the entry commits with the change. No personal data in
 * `data`: ids and counts only.
 */
export async function writeAudit(
  ex: Executor,
  entry: {
    actorId: string;
    /** `lesson.reorder`, `lesson.delete`… */
    action: string;
    targetType?: string;
    targetId?: string | number;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  await ex.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId === undefined ? null : String(entry.targetId),
    data: entry.data ?? null,
  });
}
