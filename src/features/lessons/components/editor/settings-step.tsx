"use client";

import {
  Calculator,
  Clock,
  FileText,
  type LucideIcon,
  Send,
  Shuffle,
} from "lucide-react";
import type * as React from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Input, Select } from "@/components/ui/input";
import { mergeTags } from "@/features/ai/domain/lesson-helpers";
import { lessonHelpersCopy } from "@/features/ai/messages";
import { SUBJECT_CODES, SUBJECTS, type Subject } from "@/lib/subjects";
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

/** The form's id: "Lưu cài đặt" in the publish panel submits it. */
export const SETTINGS_FORM_ID = "lesson-settings";

/**
 * Step 2's form (S5-03): metadata and `LessonConfig`. Controlled by the
 * editor, which validates with `fromSettingsForm` on every change and shows
 * a field's message once it was touched or a save was tried.
 */
export function SettingsStep({
  form,
  onChange,
  errorOf,
  onTouch,
  available,
  onSave,
  sourceText,
}: {
  form: SettingsForm;
  onChange: Patch;
  errorOf: ErrorOf;
  onTouch: (field: SettingsField) => void;
  available: TypeCounts;
  onSave: () => void;
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
  const toggle = (
    field:
      | "shuffleQuestions"
      | "shuffleOptions"
      | "countsForRating"
      | "examGuard",
    hint?: string,
  ) => (
    <label className={rowClass}>
      <input
        type="checkbox"
        name={field}
        checked={form[field]}
        onChange={(e) => onChange({ [field]: e.target.checked })}
        aria-describedby={hint ? `settings-${field}-hint` : undefined}
        className="mt-0.5 size-5 shrink-0 accent-primary"
      />
      <span className="min-w-0">
        <span className="block font-medium">{t[field]}</span>
        {hint && (
          <span
            id={`settings-${field}-hint`}
            aria-hidden
            className="mt-0.5 block text-muted-foreground text-sm"
          >
            {hint}
          </span>
        )}
      </span>
    </label>
  );

  return (
    <form
      id={SETTINGS_FORM_ID}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="flex min-w-0 flex-col gap-5"
    >
      <Alert>{t.liveNote}</Alert>
      <Section id="settings-info" icon={FileText} title={t.info}>
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
          <FormField id="settings-subject" label={t.subject}>
            <Select
              id="settings-subject"
              name="subject"
              value={form.subject}
              onChange={(e) => onChange({ subject: e.target.value as Subject })}
            >
              {SUBJECT_CODES.map((code) => (
                <option key={code} value={code}>
                  {SUBJECTS[code]}
                </option>
              ))}
            </Select>
          </FormField>
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
          <div>
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

      <Section id="settings-timing" icon={Clock} title={t.timing}>
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
            className="sm:max-w-xs"
          />
        </FormField>
      </Section>

      <Section id="settings-questions" icon={Shuffle} title={t.questions}>
        <div className="grid gap-2">
          {toggle("shuffleQuestions", t.shuffleQuestionsHint)}
          {toggle("shuffleOptions")}
        </div>
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

      <Section id="settings-scoring" icon={Calculator} title={t.scoring}>
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

      <Section id="settings-after" icon={Send} title={t.after}>
        <Choice
          name="revealAnswers"
          legend={t.revealAnswers}
          value={form.revealAnswers}
          options={(["after_submit", "after_deadline", "never"] as const).map(
            (m) => [m, t.reveals[m]],
          )}
          onChange={(revealAnswers) => onChange({ revealAnswers })}
        />
        <div className="grid gap-2">
          {toggle("countsForRating")}
          {toggle("examGuard")}
        </div>
      </Section>
    </form>
  );
}

/** A large tappable row for a checkbox or radio (07 §4, like the review page). */
const rowClass =
  "flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-border/80 bg-surface px-3.5 py-3 text-sm transition-[border-color,background-color] duration-150 hover:border-primary/50 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:outline-2 has-focus-visible:outline-ring dark:border-border";

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-lg border border-border/70 bg-surface p-5 shadow-card sm:p-6 dark:border-border"
    >
      <h2 id={id} className="flex items-center gap-2.5 heading-section">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary"
        >
          <Icon className="size-[1.125rem]" strokeWidth={2} />
        </span>
        {title}
      </h2>
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
      className="grid gap-2"
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend
        className={cn("mb-2 font-semibold text-sm", hideLegend && "sr-only")}
      >
        {legend}
      </legend>
      {options.map(([v, label]) => (
        <label key={v} className={cn(rowClass, "items-center")}>
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
