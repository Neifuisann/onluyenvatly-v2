import { ArrowRight, Clock, ListChecks, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { MathText } from "@/components/math-text/math-text";
import { QuestionImage } from "@/components/math-text/question-image";
import { buttonVariants } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PublicQuestion } from "../domain/public-question";
import { lessonTopic } from "../domain/topic";
import {
  catalogCopy,
  formatDuration,
  questionTypeLabels,
  shareCopy as t,
} from "../messages";
import type { SharePreview } from "../queries";
import { TopicGlyph } from "./topic-glyph";

const LETTERS = "ABCDEFGH";

/**
 * The public face of a lesson (S8-03): what it is, its first two questions
 * without answers (ADR-004: `toPublicQuestion` only), and a way in.
 */
export function SharePreviewContent({ lesson }: { lesson: SharePreview }) {
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="animate-rise space-y-4">
        <div className="flex items-center gap-3">
          <TopicGlyph
            topic={lessonTopic(lesson.chapter, lesson.title)}
            className="size-14 rounded-2xl [&>svg]:size-7"
          />
          <p className="text-muted-foreground text-sm leading-snug">
            <span className="block font-semibold text-foreground">
              {lesson.grade ? catalogCopy.grade(lesson.grade) : t.eyebrow}
            </span>
            {lesson.chapter}
          </p>
        </div>
        <h1 className="heading-page break-words sm:text-[2.5rem]">
          {lesson.title}
        </h1>
        {lesson.description && (
          <MathText
            text={lesson.description}
            className="max-w-prose text-muted-foreground sm:text-lg"
          />
        )}
        <ul aria-label={t.facts} className="flex flex-wrap gap-2">
          <li className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-medium text-sm">
            <ListChecks aria-hidden className="size-4 text-primary" />
            {catalogCopy.questions(lesson.questionCount)}
          </li>
          <li className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-medium text-sm">
            <Clock aria-hidden className="size-4 text-primary" />
            {lesson.timeLimitSec
              ? formatDuration(lesson.timeLimitSec)
              : t.noLimit}
          </li>
          {lesson.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground text-sm"
            >
              #{tag}
            </li>
          ))}
        </ul>
      </header>

      <section aria-labelledby="share-preview-title" className="space-y-4">
        <div className="space-y-1">
          <h2 id="share-preview-title" className="heading-section">
            {t.previewTitle(lesson.questions.length)}
          </h2>
          <p className="text-muted-foreground text-sm">{t.previewLead}</p>
        </div>
        {lesson.questions.length === 0 ? (
          <p
            className={cn(
              cardClass,
              "flex items-start gap-3 p-5 text-muted-foreground",
            )}
          >
            <LockKeyhole aria-hidden className="mt-0.5 size-5 shrink-0" />
            {t.noPreview}
          </p>
        ) : (
          <ol className="space-y-4">
            {lesson.questions.map((q, i) => (
              <li key={q.id} className={cn(cardClass, "space-y-4 p-5 sm:p-6")}>
                <PreviewQuestion question={q} index={i} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <aside className="relative isolate flex flex-col items-center gap-5 overflow-hidden rounded-2xl bg-ink px-6 py-8 text-center text-ink-foreground sm:flex-row sm:px-8 sm:text-left">
        <Mascot pose="rocket" size={112} className="shrink-0" />
        <div className="flex-1 space-y-1">
          <h2 className="font-bold font-display text-2xl tracking-tight">
            {t.ctaTitle}
          </h2>
          <p className="text-ink-muted">{t.ctaBody}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href={`/lessons/${lesson.id}`}
            prefetch={false}
            className={buttonVariants({ variant: "ink", size: "lg" })}
          >
            {t.ctaStart}
            <ArrowRight aria-hidden />
          </Link>
          <Link
            href="/register"
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center font-semibold text-ink-foreground text-sm underline-offset-4 hover:underline"
          >
            {t.ctaRegister}
          </Link>
        </div>
      </aside>
    </article>
  );
}

function PreviewQuestion({
  question: q,
  index,
}: {
  question: PublicQuestion;
  index: number;
}) {
  return (
    <>
      <p className="flex items-center gap-2">
        <span className="rounded-full bg-ink px-3 py-1 font-bold font-display text-ink-foreground text-sm">
          {t.question(index + 1)}
        </span>
        <span className="text-muted-foreground text-sm">
          {questionTypeLabels[q.type]}
        </span>
      </p>
      <div className="text-[1.0625rem] leading-relaxed">
        <MathText text={q.stem} />
        {q.image && <QuestionImage media={q.image} />}
      </div>
      {q.type === "mcq" && (
        <ul className="grid gap-2">
          {q.options.map((o, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed display order
              key={i}
              className="flex items-start gap-3 rounded-lg border-2 border-border px-3 py-2.5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-bold font-display text-sm">
                {LETTERS[i]}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <MathText text={o.text} />
                {o.image && <QuestionImage media={o.image} />}
              </div>
            </li>
          ))}
        </ul>
      )}
      {q.type === "tf" && (
        <ul className="grid gap-2">
          {q.statements.map((s, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed statement order
              key={i}
              className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5"
            >
              <span className="font-semibold">
                {LETTERS[i]?.toLowerCase()})
              </span>
              <MathText text={s.text} className="min-w-0 flex-1" />
            </li>
          ))}
        </ul>
      )}
      {q.type === "short" && (
        <p className="text-muted-foreground text-sm">{t.shortHint}</p>
      )}
    </>
  );
}
