"use client";

import { Search, Shuffle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { composeLesson } from "../../admin-actions";
import {
  type ComposeSource,
  composeProblem,
  composeTitle,
  composeTotal,
  MAX_COMPOSE_SOURCES,
  sumCounts,
} from "../../domain/compose";
import { stemKey } from "../../domain/parser";
import type { TypeCounts } from "../../domain/summary";
import {
  adminLessonsCopy,
  questionTypeLabels,
  composeCopy as t,
} from "../../messages";
import { MAX_QUESTIONS, QUESTION_TYPES } from "../../schema";
import { LessonStatusBadge } from "./lesson-status-badge";

const GRADES = [10, 11, 12] as const;

/**
 * "Tạo từ bài có sẵn" (S5-07): tick source lessons, set how many questions
 * of each type, and the server draws them at random into a new draft that
 * opens in the editor for review. Only counts reach the browser; the
 * questions stay on the server.
 */
export function ComposePanel({ sources }: { sources: ComposeSource[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [counts, setCounts] = useState<TypeCounts>({ mcq: 0, tf: 0, short: 0 });
  const [title, setTitle] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);
  const deferredQuery = useDeferredValue(query);
  const shown = useMemo(() => {
    const words = stemKey(deferredQuery).split(" ").filter(Boolean);
    return sources.filter(
      (s) =>
        (grade === null || s.grade === grade) &&
        words.every((w) => stemKey(s.title).includes(w)),
    );
  }, [sources, deferredQuery, grade]);

  const chosen = selected.flatMap((id) => byId.get(id) ?? []);
  const available = sumCounts(chosen);
  const total = composeTotal(counts);
  const problem =
    chosen.length === 0 ? t.pickFirst : composeProblem(counts, available);
  const name = title ?? (chosen.length ? composeTitle(chosen) : "");

  const toggle = (id: number) =>
    setSelected((list) =>
      list.includes(id)
        ? list.filter((x) => x !== id)
        : list.length < MAX_COMPOSE_SOURCES
          ? [...list, id]
          : list,
    );
  const selectShown = () =>
    setSelected((list) => {
      const add = shown.map((s) => s.id).filter((id) => !list.includes(id));
      return [...list, ...add].slice(0, MAX_COMPOSE_SOURCES);
    });
  const setCount = (type: keyof TypeCounts, value: number) =>
    setCounts((c) => ({
      ...c,
      [type]: Math.max(0, Math.min(MAX_QUESTIONS, Math.trunc(value) || 0)),
    }));

  const submit = () => {
    if (problem) return setError(problem);
    setError(undefined);
    startTransition(async () => {
      const result = await composeLesson({
        title: name.trim() || composeTitle(chosen),
        lessonIds: selected,
        counts,
      });
      if (!result.ok) return setError(result.message);
      router.push(`/admin/lessons/${result.data.id}/edit`);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <section
        aria-labelledby="compose-sources"
        className={cn(cardClass, "flex min-w-0 flex-col gap-4 p-5 sm:p-6")}
      >
        <div className="space-y-1">
          <h2 id="compose-sources" className="heading-section">
            {t.sourcesTitle}
          </h2>
          <p className="text-muted-foreground text-sm">{t.sourcesHint}</p>
        </div>
        {sources.length === 0 ? (
          <p className="text-muted-foreground">{t.noSources}</p>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Label htmlFor="compose-q" className="sr-only">
                  {t.search}
                </Label>
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="compose-q"
                  type="search"
                  autoComplete="off"
                  value={query}
                  maxLength={80}
                  placeholder={t.searchPlaceholder}
                  onChange={(e) => setQuery(e.target.value)}
                  className="rounded-full pl-11"
                />
              </div>
              <fieldset className="flex w-fit rounded-full bg-muted p-1">
                <legend className="sr-only">{t.gradeGroup}</legend>
                {[null, ...GRADES].map((g) => (
                  <button
                    key={g ?? "all"}
                    type="button"
                    aria-pressed={grade === g}
                    onClick={() => setGrade(g)}
                    className={cn(
                      "inline-flex h-9 items-center rounded-full px-3 font-medium text-sm transition-colors",
                      grade === g
                        ? "bg-surface text-foreground shadow-card"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {g ? t.grade(g) : t.gradeAll}
                  </button>
                ))}
              </fieldset>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <p className="num font-semibold">{t.selected(chosen.length)}</p>
              <Button
                type="button"
                variant="link"
                onClick={selectShown}
                disabled={shown.length === 0}
              >
                {t.selectShown}
              </Button>
              {selected.length > 0 && (
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setSelected([])}
                >
                  {t.clear}
                </Button>
              )}
            </div>
            {shown.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t.noMatch}</p>
            ) : (
              <ul className="-mx-2 max-h-[32rem] divide-y divide-border/70 overflow-y-auto overscroll-contain dark:divide-border">
                {shown.map((s) => {
                  const checked = selected.includes(s.id);
                  return (
                    <li key={s.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted/50",
                          checked && "bg-primary-soft/50 hover:bg-primary-soft",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(s.id)}
                          className="mt-0.5 size-5 shrink-0 accent-primary"
                        />
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="break-words font-semibold leading-snug">
                              {s.title}
                            </span>
                            {s.status !== "published" && (
                              <LessonStatusBadge status={s.status} />
                            )}
                          </span>
                          <span className="num block text-muted-foreground text-xs">
                            {[
                              s.grade && adminLessonsCopy.grade(s.grade),
                              t.sourceCounts(s),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn(
          cardClass,
          "flex flex-col gap-5 p-5 sm:p-6 lg:sticky lg:top-6",
        )}
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="heading-section mb-1">{t.countsTitle}</legend>
          {QUESTION_TYPES.map((type) => {
            const id = `compose-${type}`;
            const over = counts[type] > available[type];
            return (
              <div key={type} className="flex items-center gap-3">
                <Label htmlFor={id} className="min-w-0 flex-1">
                  {questionTypeLabels[type]}
                  <span
                    className={cn(
                      "num block font-normal text-xs",
                      over ? "text-danger-text" : "text-muted-foreground",
                    )}
                  >
                    {t.available(available[type])}
                  </span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={available[type] === 0}
                  onClick={() => setCount(type, available[type])}
                  aria-label={`${t.max}: ${questionTypeLabels[type]}`}
                >
                  {t.max}
                </Button>
                <Input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_QUESTIONS}
                  value={counts[type]}
                  aria-invalid={over || undefined}
                  onChange={(e) => setCount(type, e.target.valueAsNumber)}
                  onFocus={(e) => e.target.select()}
                  className="num w-20 text-center"
                />
              </div>
            );
          })}
          <p className="flex items-baseline justify-between border-t pt-3 font-semibold">
            {t.total}
            <span className="num font-display text-2xl">{total}</span>
          </p>
          <p className="text-muted-foreground text-xs">{t.countsHint}</p>
        </fieldset>

        <FormField id="compose-title" label={t.titleLabel}>
          <Input
            {...fieldA11y("compose-title")}
            value={name}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        </FormField>

        <div aria-live="polite" className="empty:hidden">
          {error && <Alert variant="danger">{error}</Alert>}
        </div>

        <Button type="submit" disabled={pending}>
          <Shuffle aria-hidden />
          {pending ? t.submitting : t.submit}
        </Button>
      </form>
    </div>
  );
}
