"use server";

import { refresh, updateTag } from "next/cache";
import { requireAdmin } from "@/features/auth/guards";
import { fieldErrorsOf } from "@/features/auth/schemas";
import { tags } from "@/lib/cache-tags";
import { err, type Result } from "@/lib/result";
import { type SettingsKey, SettingsPatchSchema } from "./domain/settings";
import { updateSettings as updateSettingsService } from "./service";

/**
 * `updateSettings(partial)` (05 §2, S6-03): `requireAdmin()` first, Zod, one
 * transaction with its audit entry, then the `settings` tag, which every
 * login, registration and student page reads through `getSettings()`.
 */
export async function updateSettings(
  input: unknown,
): Promise<Result<{ changed: SettingsKey[] }>> {
  const user = await requireAdmin();
  const parsed = SettingsPatchSchema.safeParse(input);
  if (!parsed.success)
    return err("VALIDATION", { fieldErrors: fieldErrorsOf(parsed.error) });
  const result = await updateSettingsService(user, parsed.data);
  if (result.ok && result.data.changed.length > 0) {
    updateTag(tags.settings);
    refresh();
  }
  return result;
}
