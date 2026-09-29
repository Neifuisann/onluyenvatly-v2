import {
  Check,
  CircleCheck,
  CircleDashed,
  CircleX,
  Lightbulb,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { MathText } from "@/components/math-text/math-text";
import { QuestionImage } from "@/components/math-text/question-image";
import type { AttemptAnswer } from "@/db/schema";
import { OPTION_LETTERS, type Outcome } from "@/features/grading/domain/grade";
import type { McqQuestion, TfQuestion } from "@/features/lessons/schema";
import { formatScore } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ReviewEntry } from "../../domain/review";
import { questionTypeNames, runnerCopy, reviewCopy as t } from "../../messages";

const tone: Record<Outcome, { icon: typeof Check; pill: string }> = {
  correct: { icon: CircleCheck, pill: "bg-success-soft text-success-text" },
  partial: { icon: CircleCheck, pill: "bg-accent-soft text-accent-text" },
  wrong: { icon: CircleX, pill: "bg-danger-soft text-danger-text" },
  blank: { icon: CircleDashed, pill: "bg-muted text-muted-foreground" },
};

/**
 * One reviewed question (07 §4 `ReviewItem`). Server-rendered, and only built
 * once `revealFor` allows it: it carries the answer key and the explanation.
 * Every mark has an icon and words, never color alone. `ai` is the AI
 * explanation (S7-02), shown only when the teacher wrote none.
 */
export function ReviewItem({
  entry,
  ai,
}: {
  entry: ReviewEntry;
  ai?: ReactNode;
}) {
  const { question: q, item, index, outcome } = entry;
  const { icon: Icon, pill } = tone[outcome];
  return (
    <article
      aria-labelledby={`review-${index}`}
      className="flex flex-col gap-4 rounded-xl border border-border/70 bg-surface p-5 shadow-card sm:p-6 dark:border-border"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 id={`review-${index}`} className="font-display font-semibold">
          {t.itemHeading(index + 1, questionTypeNames[q.type])}
        </h3>
        <p className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold",
              pill,
            )}
          >
            <Icon aria-hidden className="size-4" />
            {t.outcome[outcome]}
          </span>
          <span className="num text-muted-foreground">
            {t.marks(formatScore(entry.earned), formatScore(item.p))}
          </span>
        </p>
      </header>
      <div className="break-words">
        <MathText text={q.stem} />
        {q.image && <QuestionImage media={q.image} />}
      </div>
      {q.type === "mcq" && (
        <McqReview q={q} order={item.o} given={entry.given} />
      )}
      {q.type === "tf" && <TfReview q={q} given={entry.given} />}
      {q.type === "short" && (
        <ShortReview given={entry.given} expected={entry.expected} />
      )}
      {q.explanation?.trim() ? (
        <section className="rounded-lg bg-primary-soft/60 p-4 text-sm leading-relaxed">
          <h4 className="mb-1.5 flex items-center gap-1.5 font-semibold">
            <Lightbulb aria-hidden className="size-4 text-primary" />
            {t.explanation}
          </h4>
          <MathText text={q.explanation} />
        </section>
      ) : (
        ai
      )}
    </article>
  );
}

function McqReview({
  q,
  order,
  given,
}: {
  q: McqQuestion;
  order: number[] | undefined;
  given: AttemptAnswer;
}) {
  return (
    <ul className="grid gap-2">
      {q.options.map((_, shown) => {
        const original = order ? (order[shown] ?? shown) : shown;
        const option = q.options[original];
        const letter = OPTION_LETTERS[shown] as string;
        const isKey = original === q.answer;
        const chosen = given === letter;
        return (
          <li
            key={letter}
            className={cn(
              "flex items-start gap-3 rounded-lg border-2 border-border px-3.5 py-3",
              isKey && "border-success/70 bg-success-soft",
              chosen && !isKey && "border-danger/60 bg-danger-soft",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-bold font-display text-sm",
                isKey && "bg-success text-success-foreground",
                chosen && !isKey && "bg-danger text-danger-foreground",
              )}
            >
              {letter}
            </span>
            <span className="sr-only">{letter}.</span>
            <span className="min-w-0 flex-1 break-words pt-1">
              {option && <MathText text={option.text} />}
              {option?.image && <QuestionImage media={option.image} />}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1 pt-1 text-xs">
              {chosen && <Tag ok={isKey}>{t.yourChoice}</Tag>}
              {isKey && <Tag ok>{t.correctAnswer}</Tag>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Tag({ ok, children }: { ok: boolean; children: ReactNode }) {
  const Icon = ok ? Check : X;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold",
        ok ? "text-success-text" : "text-danger-text",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {children}
    </span>
  );
}

const tfWord = (v: boolean | null | undefined) =>
  v === true
    ? runnerCopy.trueShort
    : v === false
      ? runnerCopy.falseShort
      : t.none;

function TfReview({ q, given }: { q: TfQuestion; given: AttemptAnswer }) {
  const answers = Array.isArray(given) ? given : [];
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-muted-foreground text-xs">
          <th scope="col" className="py-1.5 pr-2 text-left font-medium">
            {t.statement}
          </th>
          <th scope="col" className="w-14 px-1 py-1.5 text-center font-medium">
            {t.you}
          </th>
          <th scope="col" className="w-14 px-1 py-1.5 text-center font-medium">
            {t.key}
          </th>
        </tr>
      </thead>
      <tbody>
        {q.statements.map((s, i) => {
          const mine = answers[i];
          const ok = mine === s.answer;
          const letter = String.fromCharCode(97 + i);
          return (
            <tr key={letter} className="border-b last:border-b-0">
              <th scope="row" className="py-2 pr-2 text-left font-normal">
                <span className="font-medium">{letter}) </span>
                <MathText text={s.text} />
              </th>
              <td
                className={cn(
                  "px-1 py-2 text-center font-semibold",
                  ok ? "text-success-text" : "text-danger-text",
                )}
              >
                <span className="inline-flex items-center gap-0.5">
                  {ok ? (
                    <Check aria-hidden className="size-3.5" />
                  ) : (
                    <X aria-hidden className="size-3.5" />
                  )}
                  {tfWord(mine)}
                  <span className="sr-only">
                    {ok ? t.outcome.correct : t.outcome.wrong}
                  </span>
                </span>
              </td>
              <td className="px-1 py-2 text-center font-semibold">
                {tfWord(s.answer)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ShortReview({
  given,
  expected,
}: {
  given: AttemptAnswer;
  expected: AttemptAnswer;
}) {
  const mine = typeof given === "string" ? given.trim() : "";
  return (
    <dl className="grid gap-1 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <dt className="text-muted-foreground">{t.youAnswered}:</dt>
        <dd className="font-medium num">{mine || t.noAnswer}</dd>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <dt className="text-muted-foreground">{t.key}:</dt>
        <dd className="font-medium num text-success-text">
          {typeof expected === "string" ? expected : ""}
        </dd>
      </div>
    </dl>
  );
}
