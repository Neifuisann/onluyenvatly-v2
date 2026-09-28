"use client";

import { FileText, Shuffle, TriangleAlert } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { QuestionImage } from "@/components/math-text/question-image";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AttemptItem } from "@/db/schema";
import { Runner } from "@/features/attempts/components/runner/runner";
import type { RunnerQuestion } from "@/features/attempts/components/runner/types";
import { buildItems } from "@/features/attempts/domain/build-items";
import { createRng } from "@/features/attempts/domain/random";
import { previewCopy } from "@/features/attempts/messages";
import { expectedAnswer, gradeItem } from "@/features/grading/domain/grade";
import { toPublicQuestion } from "../../domain/public-question";
import { editorCopy as t } from "../../messages";
import type { LessonConfig, Question } from "../../schema";
import { PreviewMathText } from "./preview-math";

const LETTERS = "abcdefgh";
const decimal = (s: string) => s.replace(".", ",");

/** The runner's pre-rendered content, from the editor's parsed questions. */
function toRunnerQuestion(q: Question, item: AttemptItem): RunnerQuestion {
  const pub = toPublicQuestion(q, item.o);
  const stem = (
    <>
      <PreviewMathText text={pub.stem} />
      {pub.image && <QuestionImage media={pub.image} />}
    </>
  );
  switch (pub.type) {
    case "mcq":
      return {
        type: "mcq",
        points: item.p,
        stem,
        options: pub.options.map((o, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed display order
          <Fragment key={i}>
            <PreviewMathText text={o.text} />
            {o.image && <QuestionImage media={o.image} />}
          </Fragment>
        )),
      };
    case "tf":
      return {
        type: "tf",
        points: item.p,
        stem,
        statements: pub.statements.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed a–h order
          <PreviewMathText key={i} text={s.text} />
        )),
      };
    case "short":
      return { type: "short", points: item.p, stem };
  }
}

/** The key in the student's display terms (option order applied). */
function keyOf(q: Question, item: AttemptItem) {
  const expected = expectedAnswer(q, item);
  if (q.type === "tf" && Array.isArray(expected))
    return previewCopy.keyTf(
      expected
        .map((v, i) => `${LETTERS[i]}) ${v ? t.true : t.false}`)
        .join(" · "),
    );
  const tolerance =
    q.type === "short" && q.tolerance
      ? ` (${previewCopy.tolerance(decimal(String(q.tolerance)))})`
      : "";
  return `${previewCopy.key}: ${decimal(String(expected ?? "—"))}${tolerance}`;
}

const newSeed = () => Math.floor(Math.random() * 2 ** 32);

/**
 * "Làm thử" (S5-06): the real runner in preview mode on the text being
 * edited (saved or not), with the lesson's pool, shuffles and points as a
 * student would get them. Keys and explanations are shown; answers are
 * graded in the browser; nothing is saved and no attempt is created.
 */
export function PreviewTab({
  title,
  questions,
  config,
  errors,
}: {
  title: string;
  questions: Question[];
  config: LessonConfig;
  errors: number;
}) {
  const [seed, setSeed] = useState(newSeed);
  const [now] = useState(() => new Date().toISOString());
  const built = useMemo(() => {
    const byId = new Map(questions.map((q) => [q.id, q]));
    return buildItems(questions, config, createRng(seed)).flatMap((item) => {
      const q = byId.get(item.q);
      return q ? [{ q, item }] : [];
    });
  }, [questions, config, seed]);

  const runner = useMemo(
    () => ({
      questions: built.map(({ q, item }) => toRunnerQuestion(q, item)),
      preview: {
        mark: (i: number, answer: unknown) => {
          const b = built[i];
          return b
            ? gradeItem(b.q, b.item, answer, config.tfScoring)
            : { earned: 0, max: 0, outcome: "blank" as const };
        },
        keys: built.map(({ q, item }) => keyOf(q, item)),
        explanations: built.map(({ q }) =>
          q.explanation?.trim() ? (
            <PreviewMathText key={q.id} text={q.explanation} />
          ) : null,
        ),
      },
    }),
    [built, config.tfScoring],
  );

  if (built.length === 0)
    return (
      <EmptyState
        icon={FileText}
        title={t.emptyTitle}
        description={t.emptyBody}
      />
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-muted-foreground text-sm">
          {t.tryLead}
          {config.timeLimitSec
            ? ` ${previewCopy.timeLimit(Math.round(config.timeLimitSec / 60))}.`
            : ""}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setSeed(newSeed())}
        >
          <Shuffle aria-hidden />
          {t.tryAgain}
        </Button>
      </div>
      {errors > 0 && (
        <Alert variant="danger">
          <span className="flex items-center gap-1.5">
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            {t.tryHasErrors(errors)}
          </span>
        </Alert>
      )}
      <Runner
        key={seed}
        attemptId="preview"
        lessonId={null}
        title={title}
        questions={runner.questions}
        saved={{ answers: [], flagged: [] }}
        deadlineAt={null}
        serverNow={now}
        startedAt={now}
        examGuard={false}
        preview={runner.preview}
      />
    </div>
  );
}
