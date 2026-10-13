"use client";

import { Check, EyeOff, Flag, Search, Skull, X } from "lucide-react";
import { type ReactNode, useActionState, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GAME_SECONDS, type QuestionType } from "@/features/lessons/schema";
import { cn } from "@/lib/utils";
import { createGameAction } from "../../admin-actions";
import {
  DEFAULT_LIVES,
  DEFAULT_QUESTIONS,
  DEFAULT_ZOMBIE_SECONDS,
  GAME_MODES,
  type GameMode,
  MAX_LESSONS,
  MAX_LIVES,
  MAX_QUESTIONS,
  MIN_LIVES,
  MIN_QUESTIONS,
  PACE_NAMES,
  PACES,
  type Pace,
  ZOMBIE_LIVES,
  ZOMBIE_TYPES,
  type ZombieLives,
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
const DEFAULT_SECONDS = String(DEFAULT_ZOMBIE_SECONDS);
const TYPES: QuestionType[] = ["mcq", "tf", "short"];
const MODE_ICON = { race: Flag, zombie: Skull } as const;
const playable = (mode: GameMode, ty: QuestionType) =>
  mode === "race" || (ZOMBIE_TYPES as readonly QuestionType[]).includes(ty);
const LIFE_CHOICES = Array.from(
  { length: MAX_LIVES - MIN_LIVES + 1 },
  (_, i) => MIN_LIVES + i,
);

/** `YYYY-MM-DDTHH:mm` in this browser's time zone, for datetime-local. */
const localInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** A first suggestion: the next quarter hour at least 10 minutes away. */
function suggestedStart(now = new Date()) {
  const quarter = 15 * 60_000;
  return new Date(Math.ceil((now.getTime() + 10 * 60_000) / quarter) * quarter);
}

/** Lowercase without Vietnamese marks, so "dao dong" finds "Dao động". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

/**
 * One room rule (B-12): a checkbox posted as `name=on`, styled as a switch.
 * Uncontrolled unless `checked` is given; `children` show under it.
 */
function RuleToggle({
  name,
  label,
  hint,
  checked,
  onChange,
  children,
}: {
  name: string;
  label: string;
  hint: string;
  checked?: boolean;
  onChange?: (on: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border px-3.5 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={onChange && ((e) => onChange(e.target.checked))}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-input transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-surface after:shadow-card after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
        />
        <span className="flex-1">
          <span className="block font-semibold text-sm">{label}</span>
          <span className="block text-muted-foreground text-xs">{hint}</span>
        </span>
      </label>
      {children}
    </div>
  );
}

/**
 * "Tạo phòng thi đấu" (B-05): lessons, question types, size and pace, with a
 * live count of the questions the draw can use. A plain form: the action
 * reads checkboxes and radios, so it posts the same before hydration.
 * "Bắn zombie" (B-14) swaps the pace for the solo game's options (lives,
 * seconds per wave) and plays mcq and tf only. "Hẹn giờ" (B-15) needs
 * JavaScript: the browser turns its local time into an ISO instant.
 */
export function CreateGameForm({ lessons }: { lessons: LessonChoice[] }) {
  const [state, action, pending] = useActionState(createGameAction, null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [types, setTypes] = useState<QuestionType[]>(["mcq"]);
  const [mode, setMode] = useState<GameMode>("race");
  const [count, setCount] = useState(String(DEFAULT_QUESTIONS));
  const [pace, setPace] = useState<Pace>("normal");
  const [zombieLives, setZombieLives] = useState<ZombieLives>(3);
  const [seconds, setSeconds] = useState(String(DEFAULT_ZOMBIE_SECONDS));
  const [livesOn, setLivesOn] = useState(false);
  const [sameQuestion, setSameQuestion] = useState(false);
  const [scheduleOn, setScheduleOn] = useState(false);
  const [startLocal, setStartLocal] = useState("");
  const [lives, setLives] = useState<number>(DEFAULT_LIVES);
  const failed = state && !state.ok ? state : null;

  const shown = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    return lessons.filter((l) => {
      const text = fold(`${l.title} ${l.chapter ?? ""}`);
      return words.every((w) => text.includes(w));
    });
  }, [lessons, query]);

  const activeTypes = types.filter((ty) => playable(mode, ty));
  const pool = useMemo(
    () =>
      lessons
        .filter((l) => selected.includes(l.id))
        .reduce(
          (sum, l) =>
            sum +
            types
              .filter((ty) => playable(mode, ty))
              .reduce((s, ty) => s + l.counts[ty], 0),
          0,
        ),
    [lessons, selected, types, mode],
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

  // Same question in a zombie room runs on a clock (B-15).
  const sharedZombie = mode === "zombie" && sameQuestion;
  const startAt = startLocal ? new Date(startLocal) : null;
  const startIso =
    startAt && !Number.isNaN(startAt.getTime()) ? startAt.toISOString() : "";
  const scheduleOk = !scheduleOn || startIso !== "";

  const size = Number(count);
  const sizeOk =
    Number.isInteger(size) && size >= MIN_QUESTIONS && size <= MAX_QUESTIONS;
  const ready =
    selected.length > 0 &&
    activeTypes.length > 0 &&
    pool >= MIN_QUESTIONS &&
    sizeOk &&
    scheduleOk;
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
            // `relative`: the hidden (`sr-only`, absolute) checkboxes stay in
            // this scroll box instead of stretching the page below the form.
            className="relative max-h-96 overflow-y-auto rounded-md border"
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
          <fieldset className="grid gap-2">
            <legend className="mb-2 font-medium text-sm">{t.modeLabel}</legend>
            <div className="grid grid-cols-2 gap-2">
              {GAME_MODES.map((m) => {
                const Icon = MODE_ICON[m];
                return (
                  <label
                    key={m}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-md border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      mode === m
                        ? "border-primary bg-primary-soft"
                        : "border-border hover:bg-muted/60",
                    )}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={m}
                      checked={mode === m}
                      onChange={() => setMode(m)}
                      className="sr-only"
                    />
                    <span className="flex items-center gap-1.5 font-semibold text-sm">
                      <Icon aria-hidden className="size-4" />
                      {t.modes[m].name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {t.modes[m].hint}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

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
              {TYPES.filter((ty) => playable(mode, ty)).map((ty) => {
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
            {mode === "zombie" && (
              <p className="text-muted-foreground text-xs">{t.zombieTypes}</p>
            )}
          </fieldset>

          <div className="grid gap-2">
            <Label htmlFor="game-count">{t.countLabel}</Label>
            <Input
              id="game-count"
              name="count"
              type="number"
              inputMode="numeric"
              min={MIN_QUESTIONS}
              max={MAX_QUESTIONS}
              step={1}
              required
              value={count}
              onChange={(e) => setCount(e.target.value)}
              aria-invalid={!sizeOk || undefined}
              aria-describedby="game-count-hint"
              className="num sm:max-w-40"
            />
            <fieldset className="flex flex-wrap gap-1.5">
              <legend className="sr-only">{t.countPresets}</legend>
              {SIZES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(String(n))}
                  aria-pressed={size === n}
                  className={cn(
                    "num h-8 min-w-10 rounded-full border px-3 font-semibold text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    size === n
                      ? "border-primary bg-primary-soft"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
            </fieldset>
            <p
              id="game-count-hint"
              className={cn(
                "text-xs",
                sizeOk ? "text-muted-foreground" : "text-danger-text",
              )}
            >
              {t.countHint(MIN_QUESTIONS, MAX_QUESTIONS)}
            </p>
            {failed?.fieldErrors?.count && (
              <p className="text-danger-text text-sm">
                {failed.fieldErrors.count}
              </p>
            )}
          </div>

          {mode === "zombie" && (
            <>
              <fieldset className="grid gap-2">
                <legend className="mb-2 font-medium text-sm">
                  {t.zombieLives}
                </legend>
                {ZOMBIE_LIVES.map((n) => (
                  <label
                    key={n}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      zombieLives === n
                        ? "border-primary bg-primary-soft"
                        : "border-border hover:bg-muted/60",
                    )}
                  >
                    <input
                      type="radio"
                      name="zombieLives"
                      value={n}
                      checked={zombieLives === n}
                      onChange={() => setZombieLives(n)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "size-4 shrink-0 rounded-full border-2 border-input",
                        zombieLives === n && "border-[5px] border-primary",
                      )}
                    />
                    <span className="text-sm">{t.zombieLivesOptions[n]}</span>
                  </label>
                ))}
              </fieldset>
              <div className="grid gap-1.5">
                <Label htmlFor="game-seconds">{t.zombieSeconds}</Label>
                <Select
                  id="game-seconds"
                  name="seconds"
                  value={sharedZombie && !seconds ? DEFAULT_SECONDS : seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                  aria-describedby="game-seconds-hint"
                >
                  {GAME_SECONDS.map((n) => (
                    <option key={n} value={String(n)}>
                      {t.zombieSecondsOption(n)}
                    </option>
                  ))}
                  {!sharedZombie && (
                    <option value="">{t.zombieSecondsNone}</option>
                  )}
                </Select>
                <p
                  id="game-seconds-hint"
                  className="text-muted-foreground text-xs"
                >
                  {t.zombieSecondsHint}
                  {sharedZombie && ` ${t.zombieSharedClock}`}
                </p>
              </div>
            </>
          )}

          {mode === "race" && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 font-medium text-sm">
                {t.paceLabel}
              </legend>
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
          )}

          <fieldset className="grid gap-2">
            <legend className="mb-2 font-medium text-sm">{t.rulesLabel}</legend>
            <RuleToggle
              name="sameQuestion"
              label={t.sameQuestion}
              hint={t.sameQuestionHint}
              checked={sameQuestion}
              onChange={setSameQuestion}
            />
            <RuleToggle
              name="lockJoin"
              label={t.lockJoin}
              hint={t.lockJoinHint}
            />
            {mode === "race" && (
              <RuleToggle
                name="livesOn"
                label={t.lives}
                hint={t.livesHint(lives)}
                checked={livesOn}
                onChange={setLivesOn}
              >
                {livesOn && (
                  <div
                    role="radiogroup"
                    aria-label={t.livesCount}
                    className="mt-1 grid grid-cols-5 gap-1 rounded-full bg-muted p-1"
                  >
                    {LIFE_CHOICES.map((n) => (
                      <label
                        key={n}
                        className={cn(
                          "num flex h-8 cursor-pointer items-center justify-center rounded-full font-semibold text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                          lives === n
                            ? "bg-surface text-foreground shadow-card"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <input
                          type="radio"
                          name="lives"
                          value={n}
                          checked={lives === n}
                          onChange={() => setLives(n)}
                          className="sr-only"
                        />
                        {n}
                      </label>
                    ))}
                  </div>
                )}
              </RuleToggle>
            )}
            <RuleToggle
              name="scheduleOn"
              label={t.schedule}
              hint={t.scheduleHint}
              checked={scheduleOn}
              onChange={(on) => {
                setScheduleOn(on);
                if (on && !startLocal)
                  setStartLocal(localInput(suggestedStart()));
              }}
            >
              {scheduleOn && (
                <div className="mt-2 grid gap-1.5">
                  <Label htmlFor="game-start">{t.scheduleAt}</Label>
                  <Input
                    id="game-start"
                    type="datetime-local"
                    value={startLocal}
                    min={localInput(new Date())}
                    onChange={(e) => setStartLocal(e.target.value)}
                    required
                    aria-invalid={Boolean(failed?.fieldErrors?.scheduledAt)}
                    aria-describedby={
                      failed?.fieldErrors?.scheduledAt
                        ? "game-start-error"
                        : undefined
                    }
                  />
                  <input type="hidden" name="scheduledAt" value={startIso} />
                </div>
              )}
              {failed?.fieldErrors?.scheduledAt && (
                <p
                  id="game-start-error"
                  className="mt-1 text-danger-text text-sm"
                >
                  {failed.fieldErrors.scheduledAt}
                </p>
              )}
            </RuleToggle>
          </fieldset>

          <output className="block rounded-md bg-muted px-3.5 py-3 text-sm">
            {selected.length === 0
              ? t.lessonsHint(MAX_LESSONS)
              : sizeOk
                ? t.summary(size, pool)
                : t.countHint(MIN_QUESTIONS, MAX_QUESTIONS)}
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
