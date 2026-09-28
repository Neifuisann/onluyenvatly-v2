"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { QuestionImage } from "@/components/math-text/question-image";
import { formatScore } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { questionTypeLabels, editorCopy as t } from "../../messages";
import type { Question } from "../../schema";
import { PreviewMathText } from "./preview-math";

const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

/**
 * One parsed question in the editor preview, with its key and explanation
 * (the teacher's view; 07 §5.6). The header jumps to the question's line.
 */
export function PreviewQuestion({
  question: q,
  index,
  points,
  hasIssue,
  onGoTo,
}: {
  question: Question;
  index: number;
  points: number;
  hasIssue: boolean;
  onGoTo: () => void;
}) {
  const Icon = hasIssue ? CircleAlert : CircleCheck;
  return (
    <article
      aria-label={t.questionHeading(
        index + 1,
        questionTypeLabels[q.type],
        formatScore(points),
      )}
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-l-4 bg-surface p-4 shadow-card",
        hasIssue ? "border-l-danger" : "border-l-success",
      )}
    >
      <header>
        <button
          type="button"
          onClick={onGoTo}
          aria-label={t.goToQuestion(index + 1)}
          className="flex items-center gap-1.5 rounded-md font-semibold text-sm hover:underline"
        >
          <Icon
            aria-hidden
            className={cn(
              "size-4",
              hasIssue ? "text-danger-text" : "text-success-text",
            )}
          />
          {t.questionHeading(
            index + 1,
            questionTypeLabels[q.type],
            formatScore(points),
          )}
          {hasIssue && (
            <span className="font-normal text-danger-text">
              · {t.questionHasIssue}
            </span>
          )}
        </button>
      </header>
      <div className="break-words">
        <PreviewMathText text={q.stem} />
        {q.image && <QuestionImage media={q.image} />}
      </div>
      {q.type === "mcq" && (
        <ul className="grid gap-2">
          {q.options.map((o, i) => {
            const letter = LETTERS[i] ?? "?";
            const key = i === q.answer;
            return (
              <li
                key={letter}
                className={cn(
                  "flex items-start gap-3 rounded-md border px-3 py-2.5",
                  key && "border-success bg-success/10",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border font-semibold text-sm",
                    key && "border-success bg-success text-success-foreground",
                  )}
                >
                  {letter}
                </span>
                <span className="sr-only">{letter}.</span>
                <span className="min-w-0 flex-1 break-words pt-0.5">
                  <PreviewMathText text={o.text} />
                  {o.image && <QuestionImage media={o.image} />}
                </span>
                {key && (
                  <span className="shrink-0 pt-1 font-medium text-success-text text-xs">
                    {t.correct}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {q.type === "tf" && (
        <ul className="grid gap-1.5 text-sm">
          {q.statements.map((s, i) => {
            const letter = String.fromCharCode(97 + i);
            return (
              <li
                key={letter}
                className="flex items-start gap-2 border-b pb-1.5 last:border-b-0"
              >
                <span className="font-medium">{letter})</span>
                <PreviewMathText text={s.text} className="min-w-0 flex-1" />
                <span
                  className={cn(
                    "shrink-0 font-semibold",
                    s.answer ? "text-success-text" : "text-danger-text",
                  )}
                >
                  {s.answer ? t.true : t.false}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {q.type === "short" && (
        <p className="text-sm">
          <span className="text-muted-foreground">{t.shortAnswer}: </span>
          <span className="font-medium font-mono">
            {q.answer.replace(".", ",") || "—"}
          </span>
          {q.tolerance !== undefined && q.tolerance > 0 && (
            <span className="text-muted-foreground">
              {" "}
              ({t.tolerance(String(q.tolerance).replace(".", ","))})
            </span>
          )}
        </p>
      )}
      {q.explanation?.trim() && (
        <section className="rounded-md bg-muted p-3 text-sm">
          <h4 className="mb-1 font-medium">{t.explanation}</h4>
          <PreviewMathText text={q.explanation} />
        </section>
      )}
    </article>
  );
}
