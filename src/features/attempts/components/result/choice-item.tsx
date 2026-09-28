import { Check } from "lucide-react";
import { MathText } from "@/components/math-text/math-text";
import { QuestionImage } from "@/components/math-text/question-image";
import type { AttemptAnswer } from "@/db/schema";
import { OPTION_LETTERS } from "@/features/grading/domain/grade";
import type { PublicQuestion } from "@/features/lessons/domain/public-question";
import { cn } from "@/lib/utils";
import { questionTypeNames, runnerCopy, reviewCopy as t } from "../../messages";

/**
 * A question and the student's own answer while the answers are hidden
 * (owner decision): built from the answer-free public question, with no
 * marks, no key and no explanation. Neutral styling, so nothing hints at
 * right or wrong.
 */
export function ChoiceItem({
  index,
  question: q,
  given,
}: {
  index: number;
  /** Options already in the attempt's display order. */
  question: PublicQuestion;
  given: AttemptAnswer;
}) {
  return (
    <article
      aria-labelledby={`choice-${index}`}
      className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card"
    >
      <h3 id={`choice-${index}`} className="font-semibold">
        {t.itemHeading(index + 1, questionTypeNames[q.type])}
      </h3>
      <div className="break-words">
        <MathText text={q.stem} />
        {q.image && <QuestionImage media={q.image} />}
      </div>
      {q.type === "mcq" && (
        <ul className="grid gap-2">
          {q.options.map((option, i) => {
            const letter = OPTION_LETTERS[i] as string;
            const chosen = given === letter;
            return (
              <li
                key={letter}
                className={cn(
                  "flex items-start gap-3 rounded-md border px-3 py-2.5",
                  chosen && "border-primary bg-primary-soft",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border font-semibold text-sm",
                    chosen &&
                      "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {letter}
                </span>
                <span className="sr-only">{letter}.</span>
                <span className="min-w-0 flex-1 break-words pt-0.5">
                  <MathText text={option.text} />
                  {option.image && <QuestionImage media={option.image} />}
                </span>
                {chosen && (
                  <span className="inline-flex shrink-0 items-center gap-1 pt-1 font-medium text-primary text-xs">
                    <Check aria-hidden className="size-3.5" />
                    {t.yourChoice}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {q.type === "tf" && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th scope="col" className="py-1.5 pr-2 text-left font-medium">
                {t.statement}
              </th>
              <th
                scope="col"
                className="w-16 px-1 py-1.5 text-center font-medium"
              >
                {t.you}
              </th>
            </tr>
          </thead>
          <tbody>
            {q.statements.map((s, i) => {
              const mine = Array.isArray(given) ? given[i] : null;
              const letter = String.fromCharCode(97 + i);
              return (
                <tr key={letter} className="border-b last:border-b-0">
                  <th scope="row" className="py-2 pr-2 text-left font-normal">
                    <span className="font-medium">{letter}) </span>
                    <MathText text={s.text} />
                  </th>
                  <td className="px-1 py-2 text-center font-semibold">
                    {mine === true
                      ? runnerCopy.trueShort
                      : mine === false
                        ? runnerCopy.falseShort
                        : t.none}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {q.type === "short" && (
        <p className="flex flex-wrap gap-1.5 text-sm">
          <span className="text-muted-foreground">{t.youAnswered}:</span>
          <span className="font-medium font-mono">
            {(typeof given === "string" && given.trim()) || t.noAnswer}
          </span>
        </p>
      )}
    </article>
  );
}
