"use client";

import { useState, useTransition } from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { updateSettings } from "../actions";
import {
  AI_DAILY_BUDGET_MAX,
  ANNOUNCEMENT_MAX,
  type AppSettings,
  normalizeAnnouncement,
} from "../domain/settings";
import { settingsCopy as t } from "../messages";

type Toggle = "registrationOpen" | "singleSession" | "aiEnabled";
type Message = { text: string; error: boolean };

/**
 * The global settings form (S6-03). Sends every field; the server writes and
 * audits only the ones that changed.
 */
export function SettingsForm({ initial }: { initial: AppSettings }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    registrationOpen: initial.registrationOpen,
    singleSession: initial.singleSession,
    aiEnabled: initial.aiEnabled,
    aiDailyBudget: String(initial.aiDailyBudget),
    announcement: initial.announcement ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Message>();

  const announcementLength =
    normalizeAnnouncement(form.announcement)?.length ?? 0;

  const submit = () => {
    const budget = Number(form.aiDailyBudget);
    const local: Record<string, string> = {};
    if (
      form.aiDailyBudget.trim() === "" ||
      !Number.isInteger(budget) ||
      budget < 0 ||
      budget > AI_DAILY_BUDGET_MAX
    )
      local.aiDailyBudget = t.aiDailyBudgetError;
    if (announcementLength > ANNOUNCEMENT_MAX)
      local.announcement = t.announcementError;
    setErrors(local);
    setMessage(undefined);
    if (Object.keys(local).length > 0) return;
    startTransition(async () => {
      const result = await updateSettings({
        registrationOpen: form.registrationOpen,
        singleSession: form.singleSession,
        aiEnabled: form.aiEnabled,
        aiDailyBudget: budget,
        announcement: form.announcement,
      });
      if (result.ok) {
        setMessage({
          text: result.data.changed.length > 0 ? t.saved : t.unchanged,
          error: false,
        });
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setMessage({ text: result.message, error: true });
    });
  };

  const toggle = (field: Toggle, hint: string) => (
    <div className="grid gap-1">
      <label className="flex min-h-11 items-center gap-3 font-medium text-sm">
        <input
          type="checkbox"
          name={field}
          checked={form[field]}
          aria-describedby={`settings-${field}-hint`}
          onChange={(e) => setForm({ ...form, [field]: e.target.checked })}
          className="size-5 shrink-0 accent-primary"
        />
        {t[field]}
      </label>
      <p
        id={`settings-${field}-hint`}
        className="pl-8 text-muted-foreground text-sm"
      >
        {hint}
      </p>
    </div>
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-5"
    >
      {toggle("registrationOpen", t.registrationOpenHint)}
      {toggle("singleSession", t.singleSessionHint)}
      {toggle("aiEnabled", t.aiEnabledHint)}
      <FormField
        id="settings-aiDailyBudget"
        label={t.aiDailyBudget}
        hint={t.aiDailyBudgetHint}
        error={errors.aiDailyBudget}
      >
        <Input
          {...fieldA11y(
            "settings-aiDailyBudget",
            errors.aiDailyBudget,
            t.aiDailyBudgetHint,
          )}
          name="aiDailyBudget"
          type="number"
          inputMode="numeric"
          min={0}
          max={AI_DAILY_BUDGET_MAX}
          step={1}
          value={form.aiDailyBudget}
          onChange={(e) => setForm({ ...form, aiDailyBudget: e.target.value })}
          className="sm:max-w-40"
        />
      </FormField>
      <FormField
        id="settings-announcement"
        label={t.announcement}
        hint={t.announcementHint}
        error={errors.announcement}
      >
        <textarea
          {...fieldA11y(
            "settings-announcement",
            errors.announcement,
            t.announcementHint,
          )}
          name="announcement"
          rows={3}
          value={form.announcement}
          onChange={(e) => setForm({ ...form, announcement: e.target.value })}
          className="min-h-20 w-full rounded-md border border-input bg-surface px-3 py-2 text-base focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/40 aria-invalid:border-danger-text"
        />
        <p
          aria-hidden
          className={cn(
            "text-right text-xs",
            announcementLength > ANNOUNCEMENT_MAX
              ? "text-danger-text"
              : "text-muted-foreground",
          )}
        >
          {t.announcementCount(announcementLength, ANNOUNCEMENT_MAX)}
        </p>
      </FormField>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t.saving : t.save}
        </Button>
        <output
          aria-live="polite"
          className={cn(
            "min-h-5 text-sm",
            message?.error ? "text-danger-text" : "text-muted-foreground",
          )}
        >
          {message?.text}
        </output>
      </div>
    </form>
  );
}
