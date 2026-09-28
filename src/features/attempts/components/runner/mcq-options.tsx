"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { OPTION_LETTERS } from "@/features/grading/domain/grade";
import { cn } from "@/lib/utils";
import { runnerCopy as t } from "../../messages";
import { useRunner } from "./store";

/**
 * Large tappable rows with a letter badge (07 §4). Toggle buttons rather than
 * radios so a second tap clears the choice; the selected row has a check icon
 * as well as the primary border, never color alone.
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
    <fieldset className="grid gap-2">
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
              "flex min-h-12 w-full items-start gap-3 rounded-md border bg-surface px-3 py-2.5 text-left transition-colors duration-150",
              "hover:border-primary/60",
              on && "border-primary bg-primary-soft ring-1 ring-primary",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border font-semibold text-sm",
                on && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {letter}
            </span>
            <span className="sr-only">{letter}.</span>
            <span className="min-w-0 flex-1 break-words pt-0.5">{option}</span>
            {on && (
              <Check
                aria-hidden
                className="mt-1 size-5 shrink-0 text-primary"
              />
            )}
          </button>
        );
      })}
    </fieldset>
  );
}
