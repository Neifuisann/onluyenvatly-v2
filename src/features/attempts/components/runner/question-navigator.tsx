"use client";

import { cn } from "@/lib/utils";
import { isAnswered } from "../../domain/runner-state";
import { runnerCopy as t } from "../../messages";
import { useRunner } from "./store";

/**
 * Grid of question numbers (07 §4): answered = filled, flagged = amber dot,
 * current = ring. Each button says all three in words for screen readers.
 */
export function QuestionNavigator({
  onPick,
}: {
  onPick: (index: number) => void;
}) {
  const answers = useRunner((s) => s.answers);
  const flagged = useRunner((s) => s.flagged);
  const current = useRunner((s) => s.current);
  const answered = answers.filter(isAnswered).length;
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {t.progress(answered, answers.length)}
      </p>
      <ol className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
        {answers.map((a, i) => {
          const done = isAnswered(a);
          const flag = flagged.includes(i);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: items never reorder
            <li key={i}>
              <button
                type="button"
                aria-label={t.navItem(i + 1, done, flag)}
                aria-current={i === current ? "step" : undefined}
                onClick={() => onPick(i)}
                className={cn(
                  "relative flex h-11 w-full items-center justify-center rounded-md border font-medium font-mono text-sm transition-colors duration-150",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-surface hover:border-primary/60",
                  i === current &&
                    "ring-2 ring-ring ring-offset-2 ring-offset-background",
                )}
              >
                {i + 1}
                {flag && (
                  <span
                    aria-hidden
                    className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-surface bg-accent"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-primary" />
          {t.legendAnswered}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm border bg-surface" />
          {t.legendUnanswered}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-full bg-accent" />
          {t.legendFlagged}
        </li>
      </ul>
    </div>
  );
}
