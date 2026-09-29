"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { OPTION_LETTERS } from "@/features/grading/domain/grade";
import { cn } from "@/lib/utils";
import { runnerCopy as t } from "../../messages";
import { useRunner } from "./store";

/**
 * Large tappable rows with a letter badge (07 §4). Toggle buttons rather than
 * radios so a second tap clears the choice; the selected row gets a check in
 * its badge as well as the lagoon border, never color alone.
 */
export function McqOptions({
  index,
  options,
}: {
  index: number;
  options: ReactNode[];
}) {
  const selected = useRunner((s) => s.answers[index]);
  const choose = useRunner((s) => s.choose);
  return (
    <fieldset className="grid gap-2.5">
      <legend className="sr-only">{t.optionsLabel(index + 1)}</legend>
      {options.map((option, i) => {
        const letter = OPTION_LETTERS[i] as string;
        const on = selected === letter;
        return (
          <button
            key={letter}
            type="button"
            aria-pressed={on}
            data-option={letter}
            onClick={() => choose(index, letter)}
            className={cn(
              "group flex min-h-14 w-full items-center gap-3.5 rounded-lg border-2 bg-surface px-3.5 py-3 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.99]",
              on
                ? "border-primary bg-primary-soft"
                : "border-border hover:border-primary/50 hover:bg-muted/40",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full font-bold font-display text-base transition-colors duration-150",
                on
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground group-hover:text-foreground",
              )}
            >
              {on ? <Check className="size-5" strokeWidth={3} /> : letter}
            </span>
            <span className="sr-only">{letter}.</span>
            <span className="min-w-0 flex-1 break-words text-[1.0625rem] leading-relaxed">
              {option}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}
