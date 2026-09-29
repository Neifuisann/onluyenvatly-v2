"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { runnerCopy as t } from "../../messages";
import { useRunner } from "./store";

const LETTERS = "abcdefgh";

/**
 * One row per statement with a two-way Đ / S switch (07 §5.3). Fits 360 px:
 * the text takes the free width, each toggle is 44 px.
 */
export function TrueFalseTable({
  index,
  statements,
}: {
  index: number;
  statements: ReactNode[];
}) {
  const answer = useRunner((s) => s.answers[index]);
  const set = useRunner((s) => s.setStatement);
  const row = Array.isArray(answer) ? answer : [];
  return (
    <ul className="grid gap-2.5">
      {statements.map((statement, i) => {
        const letter = LETTERS[i] as string;
        const value = row[i] ?? null;
        return (
          <li
            key={letter}
            className={cn(
              "flex items-center gap-3 rounded-lg border-2 py-2.5 pr-2.5 pl-4 transition-colors duration-150",
              value === null ? "border-border" : "border-primary/40",
            )}
          >
            <div className="flex min-w-0 flex-1 gap-2 break-words leading-relaxed">
              <span className="font-bold font-display">{letter})</span>
              <div className="min-w-0 flex-1">{statement}</div>
            </div>
            <fieldset className="flex shrink-0 gap-1 rounded-full bg-muted p-1">
              <legend className="sr-only">{t.statementLabel(letter)}</legend>
              {([true, false] as const).map((v) => {
                const on = value === v;
                const label = v ? t.true : t.false;
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    aria-label={t.statementChoice(letter, label)}
                    onClick={() => set(index, i, v, statements.length)}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-full font-bold font-display text-base transition-[background-color,color,box-shadow] duration-150",
                      // The same "chosen" style for both: green/red would read as
                      // correct/wrong before the test is graded.
                      on
                        ? "bg-primary text-primary-foreground shadow-card"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground",
                    )}
                  >
                    {v ? t.trueShort : t.falseShort}
                  </button>
                );
              })}
            </fieldset>
          </li>
        );
      })}
    </ul>
  );
}
