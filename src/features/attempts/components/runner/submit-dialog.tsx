"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { summarize } from "../../domain/runner-state";
import { runnerCopy, submitCopy as t } from "../../messages";
import { useRunner } from "./store";

/** Lists unanswered and flagged questions before submitting (07 §4). */
export function SubmitDialog({
  open,
  onClose,
  onConfirm,
  onPick,
  submitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onPick: (index: number) => void;
  submitting: boolean;
  error: string | null;
}) {
  const answers = useRunner((s) => s.answers);
  const flagged = useRunner((s) => s.flagged);
  const summary = summarize({ answers, flagged, current: 0 });
  const jumpList = (label: string, list: number[]) =>
    list.length > 0 && (
      <div className="space-y-2">
        <p className="font-medium text-sm">{label}</p>
        <ul className="flex flex-wrap gap-2">
          {list.map((i) => (
            <li key={i}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label={t.goTo(i + 1)}
                onClick={() => onPick(i)}
                className="min-w-11 num"
              >
                {i + 1}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.title}
      closeLabel={runnerCopy.close}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t.keepGoing}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            aria-disabled={submitting}
          >
            {submitting ? t.submitting : t.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <p>{t.summary(summary.answered, summary.total)}</p>
        {summary.unanswered.length === 0 && (
          <p className="text-muted-foreground text-sm">{t.allDone}</p>
        )}
        {jumpList(t.unanswered, summary.unanswered)}
        {jumpList(t.flagged, summary.flagged)}
      </div>
    </Dialog>
  );
}
