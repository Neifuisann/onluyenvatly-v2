"use client";

import {
  Check,
  CircleAlert,
  CircleCheck,
  Lightbulb,
  PenLine,
  X,
} from "lucide-react";
import { QuestionImage } from "@/components/math-text/question-image";
import { formatScore } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { questionTypeLabels, editorCopy as t } from "../../messages";
import type { Question } from "../../schema";
import { workspaceCopy as w } from "./messages";
import { PreviewMathText } from "./preview-math";

const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

/**
 * One parsed question in the editor preview, drawn like the student's
 * question card plus its key and explanation (the teacher's view; 07 §5.6).
 * The header jumps to the question's line in the editor; with `onMark`,
 * an option's letter sets the key and a statement's pill flips it (the
 * text is edited, v1 `markAnswerCorrect`).
 */
export function PreviewQuestion({
  question: q,
  index,
  points,
  hasIssue,
  onGoTo,
  onMark,
  active = false,
  showExplanation = true,
}: {
  question: Question;
  index: number;
  points: number;
  hasIssue: boolean;
  onGoTo: () => void;
  /** Option or statement index clicked in the preview. */
  onMark?: ((item: number) => void) | undefined;
  /** The editor's cursor is in this question. */
  active?: boolean;
  showExplanation?: boolean;
}) {
  const Icon = hasIssue ? CircleAlert : CircleCheck;
  const heading = t.questionHeading(
    index + 1,
    questionTypeLabels[q.type],
    formatScore(points),
  );
  return (
    <article
      aria-label={heading}
      aria-current={active ? "location" : undefined}
      data-question={index}
      className={cn(
        "flex scroll-mt-3 flex-col gap-4 rounded-xl border bg-surface p-4 shadow-card transition-shadow sm:p-5",
        hasIssue
          ? "border-danger/50 dark:border-danger/50"
          : "border-border/70 dark:border-border",
        active && "ring-2 ring-primary/45",
      )}
    >
      <header>
        <button
          type="button"
          onClick={onGoTo}
          aria-label={t.goToQuestion(index + 1)}
          className="group -m-1.5 flex w-[calc(100%+0.75rem)] flex-wrap items-center gap-2 rounded-lg p-1.5 text-left text-muted-foreground text-sm transition-colors hover:bg-muted/60"
        >
          <span className="num rounded-full bg-ink px-3 py-1 font-bold font-display text-ink-foreground text-sm">
            {t.questionLabel(index + 1)}
          </span>
          <span className="font-medium">{questionTypeLabels[q.type]}</span>
          <span aria-hidden>·</span>
          <span className="num">{formatScore(points)}đ</span>
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1 font-semibold text-xs",
              hasIssue ? "text-danger-text" : "text-success-text",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {hasIssue && t.questionHasIssue}
          </span>
          <PenLine
            aria-hidden
            className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        </button>
      </header>
      <div className="break-words text-[1.0625rem] leading-relaxed">
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
                  "flex items-start gap-3 rounded-lg border-2 px-3 py-2.5",
                  key
                    ? "border-success/60 bg-success-soft"
                    : "border-border/70 dark:border-border",
                )}
              >
                <LetterBadge
                  letter={letter}
                  isKey={key}
                  onClick={onMark && (() => onMark(i))}
                />
                <span className="sr-only">{letter}.</span>
                <span className="min-w-0 flex-1 break-words pt-1">
                  <PreviewMathText text={o.text} />
                  {o.image && <QuestionImage media={o.image} />}
                </span>
                {key && (
                  <span className="shrink-0 pt-1.5 font-semibold text-success-text text-xs">
                    {t.correct}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {q.type === "tf" && (
        <ul className="grid gap-2">
          {q.statements.map((s, i) => {
            const letter = String.fromCharCode(97 + i);
            return (
              <li
                key={letter}
                className="flex items-start gap-3 rounded-lg border border-border/70 px-3 py-2.5 dark:border-border"
              >
                <span className="pt-0.5 font-bold font-display">{letter})</span>
                <PreviewMathText
                  text={s.text}
                  className="min-w-0 flex-1 pt-0.5"
                />
                <StatementPill
                  letter={letter}
                  answer={s.answer}
                  onClick={onMark && (() => onMark(i))}
                />
              </li>
            );
          })}
        </ul>
      )}
      {q.type === "short" && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-success-soft px-3.5 py-2.5 text-sm">
          <span className="font-medium text-success-text">
            {t.shortAnswer}:
          </span>
          <span className="num font-bold font-display text-base">
            {q.answer.replace(".", ",") || "—"}
          </span>
          {q.tolerance !== undefined && q.tolerance > 0 && (
            <span className="text-muted-foreground">
              ({t.tolerance(String(q.tolerance).replace(".", ","))})
            </span>
          )}
        </p>
      )}
      {showExplanation && q.explanation?.trim() && (
        <section className="rounded-lg bg-muted/70 p-3.5 text-sm">
          <h3 className="mb-1 flex items-center gap-1.5 font-semibold">
            <Lightbulb aria-hidden className="size-4 text-accent-text" />
            {t.explanation}
          </h3>
          <PreviewMathText text={q.explanation} />
        </section>
      )}
    </article>
  );
}

/** An option's letter; a button that sets the key when the preview edits. */
function LetterBadge({
  letter,
  isKey,
  onClick,
}: {
  letter: string;
  isKey: boolean;
  onClick: (() => void) | undefined;
}) {
  const className = cn(
    "flex size-8 shrink-0 items-center justify-center rounded-full font-bold font-display text-sm",
    isKey
      ? "bg-success text-success-foreground"
      : "bg-muted text-muted-foreground",
  );
  const body = isKey ? <Check className="size-4" strokeWidth={3} /> : letter;
  if (!onClick)
    return (
      <span aria-hidden className={className}>
        {body}
      </span>
    );
  const label = isKey ? w.unmarkOption(letter) : w.markOption(letter);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        className,
        "transition-[box-shadow,background-color] hover:ring-2 hover:ring-success/50",
        !isKey && "hover:bg-success-soft hover:text-success-text",
      )}
    >
      {body}
    </button>
  );
}

/** A statement's "Đúng"/"Sai"; a button that flips it when the preview edits. */
function StatementPill({
  letter,
  answer,
  onClick,
}: {
  letter: string;
  answer: boolean;
  onClick: (() => void) | undefined;
}) {
  const Icon = answer ? Check : X;
  const now = answer ? t.true : t.false;
  const className = cn(
    "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-xs",
    answer
      ? "bg-success-soft text-success-text"
      : "bg-danger-soft text-danger-text",
  );
  const body = (
    <>
      <Icon aria-hidden className="size-3.5" />
      {now}
    </>
  );
  if (!onClick) return <span className={className}>{body}</span>;
  const label = w.toggleStatement(letter, now);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        className,
        "min-h-8 transition-shadow hover:ring-2 hover:ring-current/30",
      )}
    >
      {body}
    </button>
  );
}
