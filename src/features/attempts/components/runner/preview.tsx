"use client";

import { createContext, type ReactNode, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { AttemptAnswer } from "@/db/schema";
import { type ItemMark, summarize } from "@/features/grading/domain/grade";
import { formatScore } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { previewCopy as t } from "../../messages";
import { useRunner, useRunnerApi } from "./store";

/**
 * The runner in preview mode (S5-06, the editor's "Xem trước" tab): the same
 * screens, with each item's key and the teacher's explanation, graded in the
 * browser by the server's own `gradeItem`. Admin only: the keys come from
 * the editor, which already holds the full questions. Nothing is saved.
 */
export type RunnerPreview = {
  /** Grades one item's current answer, as the server would. */
  mark: (index: number, answer: AttemptAnswer | undefined) => ItemMark;
  /** Per item, pre-rendered: the key, and the explanation if any. */
  keys: ReactNode[];
  explanations: (ReactNode | null)[];
};

const PreviewContext = createContext<RunnerPreview | null>(null);
export const PreviewProvider = PreviewContext.Provider;
export const usePreview = () => useContext(PreviewContext);

const outcomeClass = {
  correct: "border-success/40 text-success-text",
  partial: "border-warning text-foreground",
  wrong: "border-danger/40 text-danger-text",
  blank: "text-muted-foreground",
} as const;

/** Under each question in preview: how the current answer scores, the key, the explanation. */
export function PreviewKey({ index }: { index: number }) {
  const preview = usePreview();
  const answer = useRunner((s) => s.answers[index]);
  if (!preview) return null;
  const m = preview.mark(index, answer);
  const explanation = preview.explanations[index];
  return (
    <div className="space-y-2 rounded-md border border-dashed bg-muted/50 p-3 text-sm">
      <p
        aria-live="polite"
        className={cn(
          "w-fit rounded-full border px-2 py-0.5 font-medium text-xs",
          outcomeClass[m.outcome],
        )}
      >
        {m.outcome === "partial"
          ? t.outcome.partial(formatScore(m.earned), formatScore(m.max))
          : t.outcome[m.outcome]}
      </p>
      <div>{preview.keys[index]}</div>
      {explanation && (
        <div>
          <p className="font-medium">{t.explanation}</p>
          {explanation}
        </div>
      )}
    </div>
  );
}

/** "Nộp bài" in preview: the score of what is on screen, and a restart. */
export function PreviewResult({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const preview = usePreview();
  const api = useRunnerApi();
  const answers = useRunner((s) => s.answers);
  if (!preview) return null;
  const marks = answers.map((a, i) => preview.mark(i, a));
  const result = summarize(marks);
  const correct = marks.filter((m) => m.outcome === "correct").length;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.resultTitle}
      closeLabel={t.close}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t.close}
          </Button>
          <Button
            type="button"
            onClick={() => {
              const n = answers.length;
              api.setState({
                answers: Array.from({ length: n }, () => null),
                flagged: [],
                current: 0,
              });
              onClose();
            }}
          >
            {t.restart}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <p className="font-semibold text-2xl tabular-nums">
          {t.resultScore(
            formatScore(result.score),
            formatScore(result.maxScore),
          )}
        </p>
        <p>
          {t.resultCounts(correct, marks.length)} ·{" "}
          {t.resultScore10(formatScore(result.score10))}
        </p>
        <p className="text-muted-foreground text-sm">{t.resultNote}</p>
      </div>
    </Dialog>
  );
}
