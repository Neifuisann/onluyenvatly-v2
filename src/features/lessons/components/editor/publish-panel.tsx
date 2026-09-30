"use client";

import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  EyeOff,
  type LucideIcon,
  Save,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { formatScore } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { EditorStats } from "../../domain/editor-stats";
import { editorCopy, settingsCopy, publishCopy as t } from "../../messages";
import type { LessonConfig } from "../../schema";
import { LessonStatusBadge } from "../admin/lesson-status-badge";
import { SETTINGS_FORM_ID } from "./settings-step";

type Check = {
  ok: boolean | "pending";
  text: string;
  action?: React.ReactNode;
};

/**
 * Step 2's side panel: where the lesson stands, what still blocks "Xuất bản"
 * (the step's main button, in the work bar), a summary, and the secondary
 * actions: save settings only, unpublish, drop the draft.
 */
export function PublishPanel({
  status,
  hasDraft,
  hasPublished,
  stats,
  config,
  errors,
  settingsValid,
  settingsDirty,
  formError,
  pending,
  onFixContent,
  onUnpublish,
  onDiscard,
}: {
  status: "draft" | "published" | "archived";
  hasDraft: boolean;
  hasPublished: boolean;
  stats: EditorStats;
  config: LessonConfig;
  errors: number;
  settingsValid: boolean;
  settingsDirty: boolean;
  formError: string | undefined;
  pending: boolean;
  onFixContent: () => void;
  onUnpublish: () => void;
  onDiscard: () => void;
}) {
  const checks: Check[] = [
    {
      ok: stats.total > 0,
      text: stats.total ? t.checkQuestions(stats.total) : t.checkNoQuestions,
    },
    errors > 0
      ? {
          ok: false,
          text: t.checkContentErrors(errors),
          action: (
            <button
              type="button"
              onClick={onFixContent}
              className="font-semibold text-primary text-sm underline-offset-4 hover:underline"
            >
              {t.fixContent}
            </button>
          ),
        }
      : { ok: true, text: t.checkContentOk },
    !settingsValid
      ? { ok: false, text: t.checkSettingsInvalid }
      : settingsDirty
        ? { ok: "pending", text: t.checkSettingsUnsaved }
        : { ok: true, text: t.checkSettingsOk },
  ];
  const statusText =
    status === "archived"
      ? t.statusArchived
      : status === "published"
        ? hasDraft
          ? `${t.statusLive} ${t.statusDraftOnTop}`
          : t.statusLive
        : t.statusHidden;
  const minutes = config.timeLimitSec
    ? Math.round(config.timeLimitSec / 60)
    : null;

  return (
    <section
      aria-labelledby="publish-panel"
      className={cn(cardClass, "flex flex-col gap-5 p-5 sm:p-6")}
    >
      <div className="space-y-2">
        <p className="eyebrow text-muted-foreground">
          {editorCopy.stepNumber(2)}
        </p>
        <h2 id="publish-panel" className="heading-section">
          {t.panelTitle}
        </h2>
        <p className="text-muted-foreground text-sm">{t.panelLead}</p>
        <p className="flex flex-wrap items-center gap-2 pt-1 text-sm">
          <LessonStatusBadge status={status} />
          <span className="text-muted-foreground">{statusText}</span>
        </p>
      </div>

      <ul
        id="publish-checklist"
        aria-label={t.checklist}
        className="grid gap-2"
      >
        {checks.map((c) => {
          const Icon: LucideIcon =
            c.ok === true ? CircleCheck : c.ok ? CircleDot : CircleAlert;
          return (
            <li
              key={c.text}
              className={cn(
                "flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm",
                c.ok === true
                  ? "bg-success-soft text-success-text"
                  : c.ok
                    ? "bg-accent-soft text-accent-text"
                    : "bg-danger-soft text-danger-text",
              )}
            >
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{c.text}</span>
                {c.action && <span className="block">{c.action}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="space-y-3 border-y py-4 text-sm">
        <h3 className="font-semibold">{t.summary}</h3>
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-muted-foreground text-xs">
              <abbr title={editorCopy.statsTypes} className="no-underline">
                {t.summaryTypes}
              </abbr>
            </dt>
            <dd className="num font-bold font-display text-lg">
              {stats.counts.mcq}/{stats.counts.tf}/{stats.counts.short}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">{t.summaryTotal}</dt>
            <dd className="num font-bold font-display text-lg">
              {t.summaryPoints(formatScore(stats.points))}
            </dd>
          </div>
        </dl>
        <ul className="space-y-0.5 text-muted-foreground">
          <li>{t.summaryTime(minutes)}</li>
          <li>{t.summaryAttempts(config.maxAttempts)}</li>
          {stats.perAttempt && (
            <li>
              {editorCopy.perAttempt(
                stats.perAttempt.total,
                stats.perAttempt.points === null
                  ? null
                  : formatScore(stats.perAttempt.points),
              )}
            </li>
          )}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          form={SETTINGS_FORM_ID}
          variant="secondary"
          disabled={pending}
          className="w-full"
        >
          <Save aria-hidden />
          {pending ? t.saving : settingsCopy.save}
        </Button>
        {formError && <p className="text-danger-text text-sm">{formError}</p>}
        {status === "published" && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={onUnpublish}
            className="w-full"
          >
            <EyeOff aria-hidden />
            {t.unpublish}
          </Button>
        )}
        {hasDraft && hasPublished && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={onDiscard}
            className="w-full"
          >
            <Undo2 aria-hidden />
            {t.discardDraft}
          </Button>
        )}
      </div>
    </section>
  );
}
