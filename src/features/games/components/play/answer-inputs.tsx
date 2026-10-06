"use client";

import {
  Check,
  Circle,
  Diamond,
  Hexagon,
  type LucideIcon,
  Square,
  Star,
  Triangle,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AttemptAnswer } from "@/db/schema";
import { OPTION_LETTERS } from "@/features/grading/domain/grade";
import { cn } from "@/lib/utils";
import { gameCopy } from "../../messages";

const t = gameCopy.play;

const TILES: { bg: string; Icon: LucideIcon }[] = [
  { bg: "bg-game-a", Icon: Triangle },
  { bg: "bg-game-b", Icon: Diamond },
  { bg: "bg-game-c", Icon: Circle },
  { bg: "bg-game-d", Icon: Square },
  { bg: "bg-game-a", Icon: Star },
  { bg: "bg-game-b", Icon: Hexagon },
];

/**
 * Big colored answer tiles, each with its own shape (never color alone).
 * One tap answers. After the answer, `expected` lights the key and marks a
 * wrong pick.
 */
export function AnswerTiles({
  options,
  picked,
  expected,
  disabled,
  onPick,
  label,
}: {
  options: ReactNode[];
  picked: AttemptAnswer;
  expected: AttemptAnswer | undefined;
  disabled: boolean;
  onPick: (letter: string) => void;
  label: string;
}) {
  const revealed = expected !== undefined;
  return (
    <fieldset
      className={cn(
        "grid gap-2.5 sm:grid-cols-2 sm:gap-3",
        options.length === 2 && "grid-cols-2",
      )}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option, i) => {
        const letter = OPTION_LETTERS[i] as string;
        const tile = TILES[i] ?? (TILES[0] as (typeof TILES)[number]);
        const isKey = revealed && expected === letter;
        const isPick = picked === letter;
        return (
          <button
            key={letter}
            type="button"
            data-option={letter}
            aria-pressed={isPick}
            disabled={disabled}
            onClick={() => onPick(letter)}
            className={cn(
              "group relative flex min-h-16 w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left text-game-foreground border-b-4 border-ink/30 transition-[opacity,transform,box-shadow] duration-200 enabled:active:scale-[0.98] disabled:cursor-default sm:min-h-24",
              tile.bg,
              revealed && !isKey && !isPick && "opacity-35",
              revealed && isKey && "ring-4 ring-ink-foreground",
              revealed && isPick && !isKey && "animate-shake opacity-70",
              !revealed && isPick && "ring-4 ring-accent",
            )}
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ink/25"
            >
              {revealed && isKey ? (
                <Check className="size-6" strokeWidth={3.5} />
              ) : revealed && isPick ? (
                <X className="size-6" strokeWidth={3.5} />
              ) : (
                <tile.Icon className="size-5 fill-current" />
              )}
            </span>
            <span className="sr-only">
              {letter}.{isKey && ` ${t.keyWas}.`}
            </span>
            <span className="min-w-0 flex-1 break-words font-semibold text-[1.0625rem] leading-snug">
              {option}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}

/** Đúng/Sai per statement, then one "Chốt đáp án". */
export function TrueFalseAnswer({
  statements,
  expected,
  disabled,
  onSubmit,
  value,
  onChange,
}: {
  statements: ReactNode[];
  expected: AttemptAnswer | undefined;
  disabled: boolean;
  onSubmit: () => void;
  value: (boolean | null)[];
  onChange: (next: (boolean | null)[]) => void;
}) {
  const key = Array.isArray(expected) ? expected : null;
  return (
    <div className="grid gap-3">
      <ol className="grid gap-2">
        {statements.map((s, i) => {
          const letter = String.fromCharCode(97 + i);
          const mine = value[i] ?? null;
          const right = key ? key[i] : undefined;
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed a–h order
              key={i}
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-surface px-3.5 py-3 text-foreground",
                key && mine === right && "ring-2 ring-success",
                key && mine !== right && "ring-2 ring-danger",
              )}
            >
              <span className="min-w-0 flex-1 basis-48">
                <span className="mr-1 font-bold">{letter})</span>
                {s}
              </span>
              <fieldset className="flex gap-1.5">
                <legend className="sr-only">{t.statement(letter)}</legend>
                {[true, false].map((v) => {
                  const on = mine === v;
                  const isKey = right === v;
                  return (
                    <button
                      key={String(v)}
                      type="button"
                      aria-pressed={on}
                      disabled={disabled}
                      onClick={() => {
                        const next = statements.map((_, k) => value[k] ?? null);
                        next[i] = on ? null : v;
                        onChange(next);
                      }}
                      className={cn(
                        "inline-flex h-10 min-w-16 items-center justify-center gap-1 rounded-full border-2 px-3 font-semibold text-sm transition-colors",
                        on
                          ? v
                            ? "border-game-d bg-game-d text-game-foreground"
                            : "border-game-a bg-game-a text-game-foreground"
                          : "border-border bg-surface text-foreground",
                        key && isKey && !on && "border-success",
                      )}
                    >
                      {key && isKey && (
                        <Check aria-hidden className="size-4" strokeWidth={3} />
                      )}
                      {v ? t.tfTrue : t.tfFalse}
                      {key && isKey && (
                        <span className="sr-only"> ({t.keyWas})</span>
                      )}
                    </button>
                  );
                })}
              </fieldset>
            </li>
          );
        })}
      </ol>
      {!key && (
        <Button
          type="button"
          size="lg"
          disabled={disabled || value.every((v) => v === null)}
          onClick={onSubmit}
          className="h-14 bg-accent text-accent-foreground text-lg hover:bg-accent/90"
        >
          {t.submit}
        </Button>
      )}
    </div>
  );
}

/** One number, typed; Enter answers. Shows the key afterwards. */
export function ShortAnswer({
  expected,
  disabled,
  onSubmit,
  value,
  onChange,
  label,
}: {
  expected: AttemptAnswer | undefined;
  disabled: boolean;
  onSubmit: () => void;
  value: string;
  onChange: (next: string) => void;
  label: string;
}) {
  const [touched, setTouched] = useState(false);
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (value.trim()) onSubmit();
      }}
    >
      <label htmlFor="game-short" className="sr-only">
        {label}
      </label>
      <input
        id="game-short"
        inputMode="decimal"
        autoComplete="off"
        // The question just appeared: typing is the only thing to do.
        // biome-ignore lint/a11y/noAutofocus: one input per screen
        autoFocus
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.shortPlaceholder}
        aria-invalid={touched && !value.trim() ? true : undefined}
        aria-describedby="game-short-hint"
        className="num h-16 w-full rounded-lg border-2 border-transparent bg-surface px-4 text-center font-bold font-display text-3xl text-foreground focus-visible:border-accent focus-visible:outline-none"
      />
      <p id="game-short-hint" className="text-center text-ink-muted text-sm">
        {expected !== undefined
          ? `${t.keyWas}: ${String(expected)}`
          : t.shortHint}
      </p>
      {expected === undefined && (
        <Button
          type="submit"
          size="lg"
          disabled={disabled}
          className="h-14 bg-accent text-accent-foreground text-lg hover:bg-accent/90"
        >
          {t.submit}
        </Button>
      )}
    </form>
  );
}
