"use client";

import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { questionTypeNames, runnerCopy as t } from "../../messages";
import { McqOptions } from "./mcq-options";
import { PracticeCheck } from "./practice";
import { PreviewKey } from "./preview";
import { ShortAnswerInput } from "./short-answer-input";
import { useRunner } from "./store";
import { TrueFalseTable } from "./true-false-table";
import type { RunnerQuestion } from "./types";

/** One question while taking a test (07 §4 `QuestionCard`, variant taking). */
export function QuestionCard({
  index,
  question,
  showFlag,
}: {
  index: number;
  question: RunnerQuestion;
  /** List mode puts the flag on each card; one-per-screen has it in the bottom bar. */
  showFlag: boolean;
}) {
  const flagged = useRunner((s) => s.flagged.includes(index));
  const toggleFlag = useRunner((s) => s.toggleFlag);
  const headingId = `q-${index}-heading`;
  return (
    <section
      id={`q-${index}`}
      aria-labelledby={headingId}
      // Focus target when jumping here from the navigator.
      tabIndex={-1}
      className={cn(
        "scroll-mt-32 space-y-5 rounded-xl border border-border/70 bg-surface p-5 shadow-card outline-none transition-[border-color] focus-visible:ring-2 focus-visible:ring-ring sm:p-7 dark:border-border",
        flagged && "border-accent/70 dark:border-accent/50",
      )}
    >
      <header className="flex items-center gap-2">
        {/* Reads as "Câu 3 · Đúng/Sai · 1đ" (`t.questionHeading`). */}
        <h2
          id={headingId}
          className="flex flex-1 flex-wrap items-center gap-2 text-muted-foreground text-sm"
        >
          <span className="num rounded-full bg-ink px-3 py-1 font-bold font-display text-ink-foreground text-sm">
            {t.questionLabel(index + 1)}
          </span>
          <span className="sr-only"> · </span>
          <span className="font-medium">
            {questionTypeNames[question.type]}
          </span>
          <span aria-hidden>·</span>
          <span className="sr-only"> · </span>
          <span className="num">{t.points(question.points)}</span>
          {flagged && <span className="sr-only">, {t.flagged}</span>}
        </h2>
        {showFlag ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={flagged}
            onClick={() => toggleFlag(index)}
            className={cn(
              flagged && "bg-accent text-accent-foreground hover:bg-accent/90",
            )}
          >
            <Flag aria-hidden className={cn(flagged && "fill-current")} />
            {flagged ? t.flagged : t.flag}
          </Button>
        ) : (
          flagged && (
            <Flag
              aria-hidden
              className="size-5 fill-accent text-accent-foreground"
            />
          )
        )}
      </header>
      <div className="text-stem sm:text-[1.1875rem]">{question.stem}</div>
      {question.type === "mcq" && (
        <McqOptions index={index} options={question.options ?? []} />
      )}
      {question.type === "tf" && (
        <TrueFalseTable index={index} statements={question.statements ?? []} />
      )}
      {question.type === "short" && <ShortAnswerInput index={index} />}
      <PreviewKey index={index} />
      <PracticeCheck index={index} />
    </section>
  );
}
