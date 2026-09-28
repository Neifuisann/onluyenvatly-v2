"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { runnerCopy as t } from "../../messages";
import { useRunner } from "./store";

const LETTERS = "abcdefgh";

/**
 * One row per statement with two big toggles Đ / S (07 §5.3). Fits 360 px:
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
    <ul className="divide-y rounded-md border bg-surface">
      {statements.map((statement, i) => {
        const letter = LETTERS[i] as string;
        const value = row[i] ?? null;
        return (
          <li key={letter} className="flex items-center gap-2 py-2 pr-2 pl-3">
            <div className="flex min-w-0 flex-1 gap-1.5 break-words">
              <span className="font-semibold">{letter})</span>
              <div className="min-w-0 flex-1">{statement}</div>
            </div>
            <fieldset className="flex shrink-0 gap-1.5">
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
                      "flex size-11 items-center justify-center rounded-md border font-semibold transition-colors duration-150 hover:border-primary/60",
                      // The same "chosen" style for both: green/red would read as
                      // correct/wrong before the test is graded.
                      on && "border-primary bg-primary text-primary-foreground",
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
