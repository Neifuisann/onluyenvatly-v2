"use client";

import { Check, Pencil, RefreshCw } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Result } from "@/lib/result";
import {
  approveExplanation,
  regenerateExplanation,
  updateExplanation,
} from "../../admin-actions";
import { adminExplanationsCopy as t } from "../../messages";

/**
 * Sửa / Duyệt / Tạo lại on one stored explanation (S7-03). The actions
 * refresh the page, which renders the new text and badges.
 */
export function ExplanationActions({
  hash,
  contentMd,
  reviewed,
}: {
  hash: string;
  contentMd: string;
  reviewed: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(contentMd);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const fieldId = useId();

  const run = (action: () => Promise<Result<unknown>>, after?: () => void) =>
    startTransition(async () => {
      setError(undefined);
      const result = await action();
      if (result.ok) after?.();
      else setError(result.message);
    });

  if (editing)
    return (
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => updateExplanation({ hash, contentMd: text }),
            () => setEditing(false),
          );
        }}
      >
        <label htmlFor={fieldId} className="font-medium text-sm">
          {t.editLabel}
        </label>
        <textarea
          id={fieldId}
          aria-describedby={`${fieldId}-hint`}
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-40 w-full rounded-md border border-input bg-surface px-3 py-2 font-mono text-sm focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/40"
        />
        <p id={`${fieldId}-hint`} className="text-muted-foreground text-xs">
          {t.editHint}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending || !text.trim()}>
            {pending ? t.saving : t.save}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setText(contentMd);
              setEditing(false);
              setError(undefined);
            }}
          >
            {t.cancel}
          </Button>
        </div>
        <output aria-live="polite" className="text-danger-text text-sm">
          {error}
        </output>
      </form>
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => setEditing(true)}
        >
          <Pencil aria-hidden />
          {t.edit}
        </Button>
        {!reviewed && (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => run(() => approveExplanation({ hash }))}
          >
            <Check aria-hidden />
            {t.approve}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => setConfirm(true)}
        >
          <RefreshCw aria-hidden />
          {pending ? t.working : t.regenerate}
        </Button>
      </div>
      <output aria-live="polite" className="text-danger-text text-sm">
        {error}
      </output>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t.regenerateTitle}
        closeLabel={t.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t.cancel}
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                setConfirm(false);
                run(() => regenerateExplanation({ hash }));
              }}
            >
              {t.regenerate}
            </Button>
          </>
        }
      >
        <p>{t.regenerateBody}</p>
      </Dialog>
    </div>
  );
}
