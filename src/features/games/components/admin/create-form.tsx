"use client";

import { Check, EyeOff, Search, X } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { QuestionType } from "@/features/lessons/schema";
import { cn } from "@/lib/utils";
import { createGameAction } from "../../admin-actions";
import {
  DEFAULT_QUESTIONS,
  MAX_LESSONS,
  MIN_QUESTIONS,
  PACE_NAMES,
  PACES,
  type Pace,
} from "../../domain/rules";
import { gameCopy, paceCopy } from "../../messages";

const t = gameCopy.create;

export type LessonChoice = {
  id: number;
  title: string;
  grade: number | null;
  chapter: string | null;
  counts: Record<QuestionType, number>;
  /** False when the lesson's keys are hidden right now (`lessonAllowsGame`). */
  allowed: boolean;
};

const SIZES = [5, 10, 15, 20, 30, 40] as const;
const TYPES: QuestionType[] = ["mcq", "tf", "short"];

/** Lowercase without Vietnamese marks, so "dao dong" finds "Dao động". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

/**
 * "Tạo phòng thi đấu" (B-05): lessons, question types, size and pace, with a
 * live count of the questions the draw can use. A plain form: the action
 * reads checkboxes and radios, so it posts the same before hydration.
 */
export function CreateGameForm({ lessons }: { lessons: LessonChoice[] }) {
  const [state, action, pending] = useActionState(createGameAction, null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [types, setTypes] = useState<QuestionType[]>(["mcq"]);
  const [count, setCount] = useState<number>(DEFAULT_QUESTIONS);
  const [pace, setPace] = useState<Pace>("normal");
  const failed = state && !state.ok ? state : null;

  const shown = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    return lessons.filter((l) => {
      const text = fold(`${l.title} ${l.chapter ?? ""}`);
      return words.every((w) => text.includes(w));
    });
  }, [lessons, query]);

  const pool = useMemo(
    () =>
      lessons
        .filter((l) => selected.includes(l.id))
        .reduce(
          (sum, l) => sum + types.reduce((s, ty) => s + l.counts[ty], 0),
          0,
        ),
    [lessons, selected, types],
  );
  const typeTotals = useMemo(() => {
    const totals: Record<QuestionType, number> = { mcq: 0, tf: 0, short: 0 };
    for (const l of lessons)
      if (selected.includes(l.id))
        for (const ty of TYPES) totals[ty] += l.counts[ty];
    return totals;
  }, [lessons, selected]);

  const toggleLesson = (id: number) =>
    setSelected((s) =>
      s.includes(id)
        ? s.filter((x) => x !== id)
        : s.length < MAX_LESSONS
          ? [...s, id]
          : s,
    );
  const toggleType = (ty: QuestionType) =>
    setTypes((s) => (s.includes(ty) ? s.filter((x) => x !== ty) : [...s, ty]));

  const ready =
    selected.length > 0 && types.length > 0 && pool >= MIN_QUESTIONS;
  const chosen = lessons.filter((l) => selected.includes(l.id));

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="grid content-start gap-6">
        <section className="grid gap-3 rounded-lg border border-border/70 bg-surface p-5 shadow-card dark:border-border">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="heading-section">{t.lessonsLabel}</h2>
            <p className="text-muted-foreground text-sm">
              {t.lessonsHint(MAX_LESSONS)}
            </p>
          </div>
          {chosen.length > 0 && (
            <ul
              aria-label={t.selected(chosen.length)}
              className="flex flex-wrap gap-2"
            >
              {chosen.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => toggleLesson(l.id)}
                    className="inline-flex max-w-72 items-center gap-1.5 rounded-full bg-primary-soft py-1 pr-2 pl-3 font-medium text-sm transition-colors hover:bg-primary-soft/70"
                  >
                    <span className="truncate">{l.title}</span>
                    <X aria-hidden className="size-4 shrink-0" />
                    <span className="sr-only">({t.clear})</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="relative">
            <Label htmlFor="lesson-search" className="sr-only">
              {t.lessonSearch}
            </Label>
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="lesson-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.lessonSearchPlaceholder}
              className="pl-10"
            />
          </div>
          <fieldset
            aria-describedby={
              failed?.fieldErrors?.lessonIds ? "lessons-error" : undefined
            }
            className="max-h-96 overflow-y-auto rounded-md border"
          >
            <legend className="sr-only">{t.lessonsLabel}</legend>
            {shown.length === 0 ? (
              <p className="p-4 text-center text-muted-foreground text-sm">
                {t.lessonNone}
              </p>
            ) : (
              <ul className="divide-y">
                {shown.map((l) => {
                  const on = selected.includes(l.id);
                  return (
                    <li key={l.id}>
                      <label
                        className={cn(
                          "flex min-h-14 cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors has-[:focus-visible]:bg-primary-soft",
                          on ? "bg-primary-soft/60" : "hover:bg-muted/50",
                          !l.allowed && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <input
                          type="checkbox"
                          name="lessonIds"
                          value={l.id}
                          checked={on}
                          disabled={!l.allowed}
                          onChange={() => toggleLesson(l.id)}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded border-2 border-input",
                            on &&
                              "border-primary bg-primary text-primary-foreground",
                          )}
                        >
                          {on && <Check className="size-3.5" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {l.title}
                          </span>
                          <span className="num block truncate text-muted-foreground text-xs">
                            {[
                              l.grade && `Lớp ${l.grade}`,
                              l.chapter,
                              t.lessonCounts(
                                l.counts.mcq,
                                l.counts.tf,
                                l.counts.short,
                              ),
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </span>
                        {!l.allowed && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                            <EyeOff aria-hidden className="size-3.5" />
                            {t.lessonHidden}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>
          {failed?.fieldErrors?.lessonIds && (
            <p id="lessons-error" className="text-danger-text text-sm">
              {failed.fieldErrors.lessonIds}
            </p>
          )}
          {lessons.some((l) => !l.allowed) && (
            <p className="text-muted-foreground text-xs">
              {t.lessonHiddenHint}
            </p>
          )}
        </section>
      </div>

      <div className="grid content-start gap-6">
        <section className="grid gap-5 rounded-lg border border-border/70 bg-surface p-5 shadow-card lg:sticky lg:top-6 dark:border-border">
          <div className="grid gap-1.5">
            <Label htmlFor="game-title">{t.nameLabel}</Label>
            <Input
              id="game-title"
              name="title"
              maxLength={80}
              placeholder={t.namePlaceholder}
              aria-describedby="game-title-hint"
            />
            <p id="game-title-hint" className="text-muted-foreground text-xs">
              {t.nameHint}
            </p>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-2 font-medium text-sm">{t.typesLabel}</legend>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((ty) => {
                const on = types.includes(ty);
                return (
                  <label
                    key={ty}
                    className={cn(
                      "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      on
                        ? "border-primary bg-primary-soft font-semibold"
                        : "border-border hover:bg-muted/60",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="types"
                      value={ty}
                      checked={on}
                      onChange={() => toggleType(ty)}
                      className="sr-only"
                    />
                    {on && (
                      <Check aria-hidden className="size-4 text-primary" />
                    )}
                    {t.typeNames[ty]}
                    {selected.length > 0 && (
                      <span className="num text-muted-foreground">
                        {typeTotals[ty]}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-2 font-medium text-sm">{t.countLabel}</legend>
            <div className="grid grid-cols-6 gap-1 rounded-full bg-muted p-1">
              {SIZES.map((n) => (
                <label
                  key={n}
                  className={cn(
                    "num flex h-9 cursor-pointer items-center justify-center rounded-full font-semibold text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    count === n
                      ? "bg-surface text-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="count"
                    value={n}
                    checked={count === n}
                    onChange={() => setCount(n)}
                    className="sr-only"
                  />
                  {n}
                </label>
              ))}
            </div>
            {failed?.fieldErrors?.count && (
              <p className="text-danger-text text-sm">
                {failed.fieldErrors.count}
              </p>
            )}
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-2 font-medium text-sm">{t.paceLabel}</legend>
            {PACE_NAMES.map((p) => (
              <label
                key={p}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  pace === p
                    ? "border-primary bg-primary-soft"
                    : "border-border hover:bg-muted/60",
                )}
              >
                <input
                  type="radio"
                  name="pace"
                  value={p}
                  checked={pace === p}
                  onChange={() => setPace(p)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 rounded-full border-2 border-input",
                    pace === p && "border-[5px] border-primary",
                  )}
                />
                <span className="flex-1">
                  <span className="block font-semibold text-sm">
                    {paceCopy[p].name}
                  </span>
                  <span className="num block text-muted-foreground text-xs">
                    {paceCopy[p].hint(PACES[p].mcq)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <output className="block rounded-md bg-muted px-3.5 py-3 text-sm">
            {selected.length === 0
              ? t.lessonsHint(MAX_LESSONS)
              : t.summary(count, pool)}
          </output>
          {failed && !failed.fieldErrors && (
            <Alert variant="danger">{failed.message}</Alert>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={!ready || pending}
            aria-disabled={!ready || pending}
          >
            {pending ? t.submitting : t.submit}
          </Button>
        </section>
      </div>
    </form>
  );
}
