import { MathText } from "@/components/math-text/math-text";
import { QuestionImage } from "@/components/math-text/question-image";
import type { Question } from "@/features/lessons/schema";
import type { QuestionStat } from "../../domain/standings";
import { gameCopy } from "../../messages";

const t = gameCopy.host;

/**
 * After the race (B-05): the questions the class missed most, each with
 * its key and how many got it right. Server-rendered with KaTeX; admin only.
 */
export function HostReport({
  items,
  players,
}: {
  items: { stat: QuestionStat; question: Question }[];
  /** Players in the room, for "x/y answered". */
  players: number;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="host-hardest" className="space-y-4">
      <h2 id="host-hardest" className="font-display font-semibold text-xl">
        {t.hardest}
      </h2>
      <ol className="grid gap-4 lg:grid-cols-3">
        {items.map(({ stat, question }) => {
          const pct = Math.round((stat.accuracy ?? 0) * 100);
          return (
            <li
              key={stat.index}
              className="flex flex-col gap-3 rounded-xl bg-surface p-5 text-foreground shadow-raised"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="num font-bold font-display text-2xl text-danger-text">
                  {t.accuracy(pct)}
                </span>
                <span className="num text-muted-foreground text-sm">
                  {t.answeredOf(stat.answered, players)}
                </span>
              </div>
              <div
                aria-hidden
                className="h-2 overflow-hidden rounded-full bg-danger-soft"
              >
                <div
                  className="h-full rounded-full bg-success"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[1.0625rem]">
                <MathText text={question.stem} />
                {question.image && <QuestionImage media={question.image} />}
              </div>
              <div className="mt-auto rounded-lg bg-success-soft p-3 text-success-text">
                <p className="font-semibold text-sm">{t.key}</p>
                <Key question={question} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Key({ question }: { question: Question }) {
  switch (question.type) {
    case "mcq": {
      const option = question.options[question.answer];
      return option ? (
        <div>
          <MathText text={option.text} />
          {option.image && <QuestionImage media={option.image} />}
        </div>
      ) : null;
    }
    case "tf":
      return (
        <ol className="space-y-1">
          {question.statements.map((s, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed a–h order
            <li key={i} className="flex gap-2">
              <span className="font-bold">
                {String.fromCharCode(97 + i)}){" "}
                {s.answer ? gameCopy.play.tfTrue : gameCopy.play.tfFalse}
              </span>
              <MathText text={s.text} className="min-w-0 flex-1" />
            </li>
          ))}
        </ol>
      );
    case "short":
      return <p className="num font-bold text-lg">{question.answer}</p>;
  }
}
