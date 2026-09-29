"use client";

import type * as React from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { mergeTags } from "@/features/ai/domain/lesson-helpers";
import { lessonHelpersCopy } from "@/features/ai/messages";
import { cn } from "@/lib/utils";
import { generateDescription, suggestTags } from "../../admin-actions";
import type {
  PoolMode,
  SettingsField,
  SettingsForm,
} from "../../domain/settings-form";
import type { TypeCounts } from "../../domain/summary";
import { settingsCopy as t } from "../../messages";
import { QUESTION_TYPES } from "../../schema";
import { AiHelper } from "./ai-helper";

type Patch = (patch: Partial<SettingsForm>) => void;
type ErrorOf = (field: SettingsField) => string | undefined;

/**
 * "Cài đặt" tab (S5-03): metadata and `LessonConfig`. Controlled by the
 * editor, which validates with `fromSettingsForm` on every change and shows
 * a field's message once it was touched or a save was tried.
 */
export function SettingsTab({
  form,
  onChange,
  errorOf,
  onTouch,
  available,
  onSave,
  pending,
  message,
  sourceText,
}: {
  form: SettingsForm;
  onChange: Patch;
  errorOf: ErrorOf;
  onTouch: (field: SettingsField) => void;
  available: TypeCounts;
  onSave: () => void;
  pending: boolean;
  message: { text: string; error: boolean } | undefined;
  /** The text being edited, for the AI helpers (S7-05). */
  sourceText: string;
}) {
  const total = QUESTION_TYPES.reduce((s, q) => s + available[q], 0);
  const text = (
    field: Exclude<
      SettingsField,
      `${string}.${string}` | "form" | "grade" | "poolMode" | "pointsMode"
    >,
  ) => ({
    ...fieldA11y(`settings-${field}`, errorOf(field)),
    name: field,
    value: form[field] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ [field]: e.target.value }),
    onBlur: () => onTouch(field),
  });
  // What the AI helpers read: the form's title, grade, chapter and the text.
  const helperInput = () => {
    if (!form.title.trim()) return lessonHelpersCopy.noTitle;
    return {
      title: form.title.trim(),
      grade: form.grade ? (Number(form.grade) as 10 | 11 | 12) : null,
      chapter: form.chapter.trim() || null,
      sourceText,
    };
  };
  const check = (
    field:
      | "shuffleQuestions"
      | "shuffleOptions"
      | "countsForRating"
      | "examGuard",
  ) => (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input
        type="checkbox"
        name={field}
        checked={form[field]}
        onChange={(e) => onChange({ [field]: e.target.checked })}
        className="size-5 accent-primary"
      />
      {t[field]}
    </label>
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="mx-auto flex max-w-3xl flex-col gap-6"
    >
      <Alert>{t.liveNote}</Alert>
      <Section title={t.info}>
        <FormField id="settings-title" label={t.title} error={errorOf("title")}>
          <Input {...text("title")} maxLength={200} required />
        </FormField>
        <FormField
          id="settings-description"
          label={t.description}
          hint={t.descriptionHint}
          error={errorOf("description")}
        >
          <textarea
            {...text("description")}
            {...fieldA11y(
              "settings-description",
              errorOf("description"),
              t.descriptionHint,
            )}
            rows={3}
            maxLength={2000}
            className="min-h-20 w-full rounded-md border border-input bg-surface px-3 py-2 text-base focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/40 aria-invalid:border-danger-text"
          />
        </FormField>
        <AiHelper
          id="ai-describe"
          label={lessonHelpersCopy.describe}
          run={() => {
            const input = helperInput();
            return typeof input === "string"
              ? input
              : generateDescription(input);
          }}
          onResult={({ description }) => {
            onChange({ description });
            return lessonHelpersCopy.described;
          }}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="settings-grade" label={t.grade}>
            <Select
              id="settings-grade"
              name="grade"
              value={form.grade}
              onChange={(e) =>
                onChange({ grade: e.target.value as SettingsForm["grade"] })
              }
            >
              <option value="">{t.gradeNone}</option>
              {([10, 11, 12] as const).map((g) => (
                <option key={g} value={String(g)}>
                  {t.gradeOption(g)}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField
              id="settings-chapter"
              label={t.chapter}
              hint={t.chapterHint}
              error={errorOf("chapter")}
            >
              <Input
                {...text("chapter")}
                {...fieldA11y(
                  "settings-chapter",
                  errorOf("chapter"),
                  t.chapterHint,
                )}
                maxLength={100}
              />
            </FormField>
          </div>
        </div>
        <FormField
          id="settings-tags"
          label={t.tags}
          hint={t.tagsHint}
          error={errorOf("tags")}
        >
          <Input
            {...text("tags")}
            {...fieldA11y("settings-tags", errorOf("tags"), t.tagsHint)}
          />
        </FormField>
        <AiHelper
          id="ai-tags"
          label={lessonHelpersCopy.suggestTags}
          run={() => {
            const input = helperInput();
            return typeof input === "string" ? input : suggestTags(input);
          }}
          onResult={({ tags }) => {
            const merged = mergeTags(form.tags, tags);
            if (merged.added > 0) onChange({ tags: merged.value });
            return lessonHelpersCopy.tagsAdded(merged.added);
          }}
        />
      </Section>

      <Section title={t.timing}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="settings-timeLimitMin"
            label={t.timeLimit}
            hint={t.timeLimitHint}
            error={errorOf("timeLimitMin")}
          >
            <Input
              {...text("timeLimitMin")}
              {...fieldA11y(
                "settings-timeLimitMin",
                errorOf("timeLimitMin"),
                t.timeLimitHint,
              )}
              inputMode="decimal"
            />
          </FormField>
          <FormField
            id="settings-maxAttempts"
            label={t.maxAttempts}
            hint={t.maxAttemptsHint}
            error={errorOf("maxAttempts")}
          >
            <Input
              {...text("maxAttempts")}
              {...fieldA11y(
                "settings-maxAttempts",
                errorOf("maxAttempts"),
                t.maxAttemptsHint,
              )}
              inputMode="numeric"
            />
          </FormField>
        </div>
        <FormField
          id="settings-startsAt"
          label={t.startsAt}
          hint={t.startsAtHint}
          error={errorOf("startsAt")}
        >
          <Input
            {...text("startsAt")}
            {...fieldA11y(
              "settings-startsAt",
              errorOf("startsAt"),
              t.startsAtHint,
            )}
            type="datetime-local"
          />
        </FormField>
      </Section>

      <Section title={t.questions}>
        {check("shuffleQuestions")}
        <p className="-mt-3 text-muted-foreground text-sm">
          {t.shuffleQuestionsHint}
        </p>
        {check("shuffleOptions")}
        <Choice
          name="poolMode"
          legend={t.pool}
          value={form.poolMode}
          options={(["off", "size", "byType"] as PoolMode[]).map((m) => [
            m,
            t.poolModes[m],
          ])}
          onChange={(poolMode) => onChange({ poolMode })}
          error={errorOf("poolMode")}
        />
        {form.poolMode === "size" && (
          <FormField
            id="settings-poolSize"
            label={t.poolSize}
            hint={t.poolAvailable(total)}
            error={errorOf("poolSize")}
          >
            <Input
              {...text("poolSize")}
              {...fieldA11y(
                "settings-poolSize",
                errorOf("poolSize"),
                t.poolAvailable(total),
              )}
              inputMode="numeric"
              className="sm:max-w-40"
            />
          </FormField>
        )}
        {form.poolMode === "byType" && (
          <PerType
            prefix="poolByType"
            values={form.poolByType}
            hint={(q) => t.poolByTypeAvailable(available[q])}
            errorOf={errorOf}
            onTouch={onTouch}
            onChange={(poolByType) => onChange({ poolByType })}
            inputMode="numeric"
          />
        )}
      </Section>

      <Section title={t.scoring}>
        <Choice
          name="pointsMode"
          legend={t.scoring}
          hideLegend
          value={form.pointsMode}
          options={(["per-question", "per-type-total"] as const).map((m) => [
            m,
            t.pointsModes[m],
          ])}
          onChange={(pointsMode) => onChange({ pointsMode })}
          error={errorOf("pointsMode")}
        />
        {form.pointsMode === "per-type-total" && (
          <>
            <PerType
              prefix="pointsByType"
              values={form.pointsByType}
              label={(q) => `${t.pointsTotal} ${t.types[q].toLowerCase()}`}
              errorOf={errorOf}
              onTouch={onTouch}
              onChange={(pointsByType) => onChange({ pointsByType })}
              inputMode="decimal"
            />
            <p className="-mt-2 text-muted-foreground text-sm">
              {t.pointsTotalHint}
            </p>
          </>
        )}
        <Choice
          name="tfScoring"
          legend={t.tfScoring}
          value={form.tfScoring}
          options={(["thpt2025", "proportional"] as const).map((m) => [
            m,
            t.tfScorings[m],
          ])}
          onChange={(tfScoring) => onChange({ tfScoring })}
        />
      </Section>

      <Section title={t.after}>
        <Choice
          name="revealAnswers"
          legend={t.revealAnswers}
          value={form.revealAnswers}
          options={(["after_submit", "after_deadline", "never"] as const).map(
            (m) => [m, t.reveals[m]],
          )}
          onChange={(revealAnswers) => onChange({ revealAnswers })}
        />
        {check("countsForRating")}
        {check("examGuard")}
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        {message && (
          <Alert variant={message.error ? "danger" : "success"}>
            {message.text}
          </Alert>
        )}
        {errorOf("form") && (
          <p className="text-danger-text text-sm">{errorOf("form")}</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? t.saving : t.save}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Choice<V extends string>({
  name,
  legend,
  hideLegend,
  value,
  options,
  onChange,
  error,
}: {
  name: string;
  legend: string;
  hideLegend?: boolean;
  value: V;
  options: [V, string][];
  onChange: (value: V) => void;
  error?: string | undefined;
}) {
  const errorId = `settings-${name}-error`;
  return (
    <fieldset
      className="grid gap-1"
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend
        className={cn("mb-1 font-medium text-sm", hideLegend && "sr-only")}
      >
        {legend}
      </legend>
      {options.map(([v, label]) => (
        <label key={v} className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="radio"
            name={name}
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
            className="size-5 shrink-0 accent-primary"
          />
          {label}
        </label>
      ))}
      {error && (
        <p id={errorId} className="text-danger-text text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function PerType({
  prefix,
  values,
  label = (q) => t.types[q],
  hint,
  errorOf,
  onTouch,
  onChange,
  inputMode,
}: {
  prefix: "poolByType" | "pointsByType";
  values: SettingsForm["poolByType"];
  label?: (q: (typeof QUESTION_TYPES)[number]) => string;
  hint?: (q: (typeof QUESTION_TYPES)[number]) => string;
  errorOf: ErrorOf;
  onTouch: (field: SettingsField) => void;
  onChange: (values: SettingsForm["poolByType"]) => void;
  inputMode: "numeric" | "decimal";
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {QUESTION_TYPES.map((q) => {
        const field = `${prefix}.${q}` as const;
        const id = `settings-${prefix}-${q}`;
        return (
          <FormField
            key={q}
            id={id}
            label={label(q)}
            {...(hint && { hint: hint(q) })}
            error={errorOf(field)}
          >
            <Input
              {...fieldA11y(id, errorOf(field), hint?.(q))}
              name={field}
              inputMode={inputMode}
              value={values[q]}
              onChange={(e) => onChange({ ...values, [q]: e.target.value })}
              onBlur={() => onTouch(field)}
            />
          </FormField>
        );
      })}
    </div>
  );
}
