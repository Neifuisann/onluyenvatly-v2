/**
 * Global settings (S6-03, 04 `settings`). Pure: the admin form's schema and
 * which keys an update changes. There is no device policy (no device
 * binding) and no rating-formula switch (v2 only): owner decisions 01 §7.
 */
import { z } from "zod";
import { settingsCopy as t } from "../messages";

export const AI_DAILY_BUDGET_MAX = 5000;
export const ANNOUNCEMENT_MAX = 300;

export type AppSettings = {
  registrationOpen: boolean;
  singleSession: boolean;
  aiEnabled: boolean;
  aiDailyBudget: number;
  announcement: string | null;
};

export const SETTINGS_KEYS = [
  "registrationOpen",
  "singleSession",
  "aiEnabled",
  "aiDailyBudget",
  "announcement",
] as const satisfies readonly (keyof AppSettings)[];
export type SettingsKey = (typeof SETTINGS_KEYS)[number];

export const DEFAULT_SETTINGS: AppSettings = {
  registrationOpen: true,
  singleSession: true,
  aiEnabled: true,
  aiDailyBudget: 200,
  announcement: null,
};

/**
 * Plain text on one line: control characters and line breaks become spaces,
 * runs of spaces collapse, and an empty text means "no announcement".
 */
export function normalizeAnnouncement(text: string): string | null {
  const clean = text
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    // `\s` also matches the Unicode line and paragraph separators.
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFC");
  return clean === "" ? null : clean;
}

/** Every key optional (a partial update), at least one present. */
export const SettingsPatchSchema = z
  .strictObject({
    registrationOpen: z.boolean(),
    singleSession: z.boolean(),
    aiEnabled: z.boolean(),
    aiDailyBudget: z
      .number(t.aiDailyBudgetError)
      .int(t.aiDailyBudgetError)
      .min(0, t.aiDailyBudgetError)
      .max(AI_DAILY_BUDGET_MAX, t.aiDailyBudgetError),
    announcement: z
      .string()
      .max(ANNOUNCEMENT_MAX * 4, t.announcementError)
      .nullable()
      .transform((s) => (s === null ? null : normalizeAnnouncement(s)))
      .refine(
        (s) => s === null || s.length <= ANNOUNCEMENT_MAX,
        t.announcementError,
      ),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0);
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;

/** The keys whose value the patch actually changes, in form order. */
export function changedKeys(
  current: AppSettings,
  patch: SettingsPatch,
): SettingsKey[] {
  return SETTINGS_KEYS.filter(
    (key) => patch[key] !== undefined && patch[key] !== current[key],
  );
}
