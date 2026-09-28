import "server-only";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { tags } from "@/lib/cache-tags";

export type AppSettings = {
  registrationOpen: boolean;
  singleSession: boolean;
  aiEnabled: boolean;
  aiDailyBudget: number;
  announcement: string | null;
};

const DEFAULTS: AppSettings = {
  registrationOpen: true,
  singleSession: true,
  aiEnabled: true,
  aiDailyBudget: 200,
  announcement: null,
};

/** Global settings row, shared-cached (tag `settings`, 05 §4). */
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
  return row ?? DEFAULTS;
}
