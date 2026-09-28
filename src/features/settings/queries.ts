import "server-only";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { tags } from "@/lib/cache-tags";
import { type AppSettings, DEFAULT_SETTINGS } from "./domain/settings";

export type { AppSettings } from "./domain/settings";

/**
 * Global settings row, shared-cached (tag `settings`, 05 §4). `updateSettings`
 * invalidates the tag, so login and register read the new policy next time.
 */
export async function getSettings(): Promise<AppSettings> {
  "use cache";
  cacheTag(tags.settings);
  cacheLife("hours");
  const [row] = await db
    .select({
      registrationOpen: settings.registrationOpen,
      singleSession: settings.singleSession,
      aiEnabled: settings.aiEnabled,
      aiDailyBudget: settings.aiDailyBudget,
      announcement: settings.announcement,
    })
    .from(settings)
    .where(eq(settings.id, 1));
  return row ?? DEFAULT_SETTINGS;
}
