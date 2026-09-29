import { MathText } from "@/components/math-text/math-text";
import { QuestionImage } from "@/components/math-text/question-image";
import { questionTypeNames } from "@/features/attempts/messages";
import type { Question } from "@/features/lessons/schema";
import type { LessonExplanations } from "../../admin-queries";
import { adminExplanationsCopy as t } from "../../messages";
import { ExplanationCard } from "./explanation-card";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** The key as one Markdown-lite line (or one line per statement). */
function keyText(q: Question): string {
  if (q.type === "mcq")
    return `**${t.key}:** ${LETTERS[q.answer]}. ${q.options[q.answer]?.text ?? ""}`;
  if (q.type === "tf")
    return [
      `**${t.key}:**`,
      ...q.statements.map(
        (s, i) =>
          `${String.fromCharCode(97 + i)}) ${s.answer ? "Đúng" : "Sai"}`,
      ),
    ].join("\n");
  return `**${t.key}:** ${q.answer}`;
}

/** Every published question of a lesson with its explanation (S7-03). */
export function LessonExplanationList({
  rows,
}: {
  rows: LessonExplanations["rows"];
}) {
  return (
    <ol className="flex flex-col gap-4">
      {rows.map(({ position, question: q, hash, explanation }) => (
        <li key={q.id}>
          <article
            aria-labelledby={`expl-q-${position}`}
            className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card"
          >
            <h3 id={`expl-q-${position}`} className="font-semibold">
              {t.question(position, questionTypeNames[q.type])}
            </h3>
            <div className="break-words">
              <MathText text={q.stem} />
              {q.image && <QuestionImage media={q.image} />}
            </div>
            <MathText
              text={keyText(q)}
              className="text-muted-foreground text-sm"
            />
            {hash === null ? (
              <section className="rounded-md bg-muted p-3 text-sm">
                <h4 className="font-medium">{t.teacherInLesson}</h4>
                <MathText text={q.explanation ?? ""} />
                <p className="mt-1 text-muted-foreground text-xs">
                  {t.teacherInLessonHint}
                </p>
              </section>
            ) : explanation ? (
              <ExplanationCard explanation={explanation} />
            ) : (
              <p className="rounded-md border border-dashed p-3 text-muted-foreground text-sm">
                {t.none}
              </p>
            )}
          </article>
        </li>
      ))}
    </ol>
  );
}
