import { Check, X } from "lucide-react";
import { MathText } from "@/components/math-text/math-text";
import { QuestionImage } from "@/components/math-text/question-image";
import { OPTION_LETTERS } from "@/features/grading/domain/grade";
import { cn } from "@/lib/utils";
import type {
  McqDetail,
  QuestionStats,
  ShortDetail,
  TfDetail,
} from "../../domain/stats";
import { questionTypeLabels, statsCopy as t } from "../../messages";
import type { McqQuestion, TfQuestion } from "../../schema";
import type { StatsQuestion } from "../../stats-queries";

const pct = t.percent;

/** A count as a bar over the attempts that had the question (decorative). */
function Bar({
  value,
  total,
  good,
}: {
  value: number;
  total: number;
  good?: boolean;
}) {
  return (
    <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full",
          good ? "bg-success" : "bg-primary",
        )}
        style={{ width: total ? pct(value / total) : "0" }}
      />
    </div>
  );
}

function KeyMarker() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 font-medium text-success-text text-xs">
      <Check aria-hidden className="size-3.5" />
      {t.key}
    </span>
  );
}

/**
 * One question of the stats page (S6-05): full-marks rate, average share,
 * and how the answers split. The key is marked with a word and an icon, not
 * color alone. Admin only: it shows the answer key.
 */
export function QuestionStatsCard({
  entry,
  question,
}: {
  entry: QuestionStats;
  question: StatsQuestion;
}) {
  const n = entry.position;
  const headingId = `stats-q-${entry.id}`;
  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card"
    >
      <header className="flex flex-col gap-1">
        <h3 id={headingId} className="font-semibold">
          {t.questionHeading(n, questionTypeLabels[entry.type])}
        </h3>
        {entry.seen > 0 && entry.fullMarksRate !== null ? (
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-sm">
            <span className="font-medium text-foreground">
              {t.fullMarks(
                pct(entry.fullMarksRate),
                entry.fullMarks,
                entry.seen,
              )}
            </span>
            <span>{t.averageShare(pct(entry.averageShare ?? 0))}</span>
            <span>{t.answered(entry.answered, entry.seen)}</span>
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">{t.notSeen}</p>
        )}
      </header>
      <div className="break-words">
        <MathText text={question.stem} />
        {question.image && <QuestionImage media={question.image} />}
      </div>
      {entry.detail.type === "mcq" && question.type === "mcq" && (
        <McqBreakdown n={n} q={question} d={entry.detail} seen={entry.seen} />
      )}
      {entry.detail.type === "tf" && question.type === "tf" && (
        <TfBreakdown n={n} q={question} d={entry.detail} seen={entry.seen} />
      )}
      {entry.detail.type === "short" && question.type === "short" && (
        <ShortBreakdown
          n={n}
          answer={question.answer}
          d={entry.detail}
          seen={entry.seen}
        />
      )}
    </article>
  );
}

function McqBreakdown({
  n,
  q,
  d,
  seen,
}: {
  n: number;
  q: Omit<McqQuestion, "explanation">;
  d: McqDetail;
  seen: number;
}) {
  return (
    <>
      <ul aria-label={t.optionsLabel(n)} className="flex flex-col gap-2">
        {d.options.map((o) => {
          const option = q.options[o.index];
          return (
            <li
              key={o.index}
              className={cn(
                "flex flex-col gap-1.5 rounded-md border p-2",
                o.isKey && "border-success bg-success/10",
              )}
            >
              <div className="flex items-start gap-2 text-sm">
                <span className="font-semibold">
                  {OPTION_LETTERS[o.index]}.
                </span>
                <div className="min-w-0 flex-1 break-words">
                  {option?.text.trim() ? <MathText text={option.text} /> : null}
                  {option?.image && <QuestionImage media={option.image} />}
                </div>
                {o.isKey && <KeyMarker />}
                <span className="shrink-0 font-mono tabular-nums">
                  {t.count(o.count)}
                  {seen > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {pct(o.count / seen)}
                    </span>
                  )}
                </span>
              </div>
              <Bar value={o.count} total={seen} good={o.isKey} />
            </li>
          );
        })}
        <li className="flex items-center justify-between gap-2 px-2 text-muted-foreground text-sm">
          <span>{t.blank}</span>
          <span className="font-mono tabular-nums">{t.count(d.blank)}</span>
        </li>
      </ul>
      {seen > 0 && (
        <details className="rounded-md border p-2 text-sm">
          <summary className="cursor-pointer font-medium">
            {t.studentsPerOption}
          </summary>
          <dl className="mt-2 flex flex-col gap-2">
            {d.options.map((o) => (
              <div key={o.index}>
                <dt className="font-medium">
                  {OPTION_LETTERS[o.index]}
                  {o.isKey && ` (${t.key})`} · {t.count(o.count)}
                </dt>
                <dd className="text-muted-foreground">
                  {o.students.length ? o.students.join(", ") : t.nobody}
                </dd>
              </div>
            ))}
            <div>
              <dt className="font-medium">
                {t.blank} · {t.count(d.blank)}
              </dt>
              <dd className="text-muted-foreground">
                {d.blankStudents.length ? d.blankStudents.join(", ") : t.nobody}
              </dd>
            </div>
          </dl>
        </details>
      )}
    </>
  );
}

function TfBreakdown({
  n,
  q,
  d,
  seen,
}: {
  n: number;
  q: Omit<TfQuestion, "explanation">;
  d: TfDetail;
  seen: number;
}) {
  return (
    <ul aria-label={t.statementsLabel(n)} className="flex flex-col gap-2">
      {d.statements.map((s) => (
        <li
          key={s.index}
          className="flex flex-col gap-1.5 rounded-md border p-2"
        >
          <div className="flex items-start gap-2 text-sm">
            <span className="font-semibold">
              {t.statement(String.fromCharCode(97 + s.index))}
            </span>
            <div className="min-w-0 flex-1 break-words">
              <MathText text={q.statements[s.index]?.text ?? ""} />
            </div>
          </div>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <span>
              {t.keyColumn}:{" "}
              <span className="font-medium">
                {s.answer ? t.trueLabel : t.falseLabel}
              </span>
            </span>
            <span>
              {t.correctColumn}:{" "}
              <span className="font-mono font-medium tabular-nums">
                {s.correctRate === null ? "–" : pct(s.correctRate)}
              </span>{" "}
              <span className="text-muted-foreground">
                ({s.correct}/{seen})
              </span>
            </span>
            <span className="text-muted-foreground">
              {t.blankColumn}: {s.blank}
            </span>
          </p>
          <Bar value={s.correct} total={seen} good />
        </li>
      ))}
    </ul>
  );
}

function ShortBreakdown({
  n,
  answer,
  d,
  seen,
}: {
  n: number;
  answer: string;
  d: ShortDetail;
  seen: number;
}) {
  const more = d.distinct - d.top.length;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        <KeyMarker /> <span className="font-mono">{t.shortKey(answer)}</span>
      </p>
      <ul aria-label={t.topAnswers(n)} className="flex flex-col gap-2">
        {d.top.map((a) => (
          <li
            key={a.answer}
            className={cn(
              "flex flex-col gap-1.5 rounded-md border p-2",
              a.correct && "border-success bg-success/10",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 break-all font-mono">
                {a.answer}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  a.correct ? "text-success-text" : "text-danger-text",
                )}
              >
                {a.correct ? (
                  <Check aria-hidden className="size-3.5" />
                ) : (
                  <X aria-hidden className="size-3.5" />
                )}
                {a.correct ? t.correct : t.wrong}
              </span>
              <span className="shrink-0 font-mono tabular-nums">
                {t.count(a.count)}
              </span>
            </div>
            <Bar value={a.count} total={seen} good={a.correct} />
          </li>
        ))}
        <li className="flex items-center justify-between gap-2 px-2 text-muted-foreground">
          <span>{t.blank}</span>
          <span className="font-mono tabular-nums">{t.count(d.blank)}</span>
        </li>
      </ul>
      {more > 0 && (
        <p className="text-muted-foreground">{t.moreAnswers(more)}</p>
      )}
    </div>
  );
}
