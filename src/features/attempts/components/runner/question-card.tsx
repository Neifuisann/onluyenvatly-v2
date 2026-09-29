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
      className="scroll-mt-28 space-y-4 rounded-lg border bg-surface p-4 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
    >
      <header className="flex items-start gap-2">
        <h2
          id={headingId}
          className="flex-1 pt-2 font-medium text-muted-foreground text-sm"
        >
          {t.questionHeading(
            index + 1,
            questionTypeNames[question.type],
            question.points,
          )}
          {flagged && <span className="sr-only">, {t.flagged}</span>}
        </h2>
        {showFlag && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={flagged}
            onClick={() => toggleFlag(index)}
            className={cn(flagged && "text-accent-foreground bg-accent")}
          >
            <Flag aria-hidden className={cn(flagged && "fill-current")} />
            {flagged ? t.flagged : t.flag}
          </Button>
        )}
      </header>
      <div className="text-stem">{question.stem}</div>
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
