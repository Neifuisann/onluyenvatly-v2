import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { ok, type Result } from "@/lib/result";
import {
  changedKeys,
  type SettingsKey,
  type SettingsPatch,
} from "./domain/settings";

export type Actor = { id: string };

/**
 * Applies a settings patch to row 1 (S6-03). The row is locked, only the keys
 * whose value changes are written (with `updated_by/at`), and the audit entry
 * lists those keys, never their values. Nothing changed: no write, no audit.
 */
export async function updateSettings(
  actor: Actor,
  patch: SettingsPatch,
  now = new Date(),
): Promise<Result<{ changed: SettingsKey[] }>> {
  return db.transaction(async (tx) => {
    // Migration 0001 inserts the row; this only guards a hand-emptied table.
    await tx.insert(settings).values({ id: 1 }).onConflictDoNothing();
    const [current] = await tx
      .select({
        registrationOpen: settings.registrationOpen,
        singleSession: settings.singleSession,
        aiEnabled: settings.aiEnabled,
        aiDailyBudget: settings.aiDailyBudget,
        announcement: settings.announcement,
      })
      .from(settings)
      .where(eq(settings.id, 1))
      .for("update");
    if (!current) throw new Error("settings row missing");
    const changed = changedKeys(current, patch);
    if (changed.length === 0) return ok({ changed });

    await tx
      .update(settings)
      .set({
        ...Object.fromEntries(changed.map((key) => [key, patch[key]])),
        updatedAt: now,
        updatedBy: actor.id,
      })
      .where(eq(settings.id, 1));
    await writeAudit(tx, {
      actorId: actor.id,
      action: "settings.update",
      targetType: "settings",
      targetId: 1,
      data: { changed },
    });
    return ok({ changed });
  });
}
