"use client";

import { EyeOff, Save, Send, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Result } from "@/lib/result";
import {
  discardDraft,
  publish,
  saveDraft,
  unpublish,
} from "../../admin-actions";
import { publishCopy as t } from "../../messages";

type Message = { text: string; error: boolean };

/**
 * Save / publish controls of the editor (S5-04). The server re-parses and
 * checks the text; the refresh after each action brings the saved text and
 * question ids back into the editor.
 */
export function PublishBar({
  lessonId,
  status,
  text,
  textDirty,
  settingsDirty,
  hasDraft,
  hasPublished,
  errors,
}: {
  lessonId: number;
  status: "draft" | "published" | "archived";
  text: string;
  textDirty: boolean;
  settingsDirty: boolean;
  hasDraft: boolean;
  hasPublished: boolean;
  /** Parse errors in the live text: publishing is blocked until they are fixed. */
  errors: number;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message>();
  const [dialog, setDialog] = useState<"publish" | "discard" | null>(null);

  const run = (
    action: () => Promise<Result<unknown>>,
    success: (data: unknown) => string,
  ) => {
    setDialog(null);
    setMessage(undefined);
    startTransition(async () => {
      const result = await action();
      setMessage(
        result.ok
          ? { text: success(result.data), error: false }
          : { text: result.message, error: true },
      );
    });
  };

  const save = () =>
    run(
      () => saveDraft({ id: lessonId, sourceText: text }),
      (data) => {
        const d = data as { unchanged: boolean; errors: number };
        if (d.unchanged) return t.unchanged;
        return d.errors ? t.savedWithErrors(d.errors) : t.saved;
      },
    );

  // Ctrl/Cmd+S saves the draft from anywhere in the editor.
  const canSave = textDirty && !pending && status !== "archived";
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      if (canSave) saveRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSave]);

  const nothingNew = status === "published" && !hasDraft && !textDirty;
  const canPublish =
    status !== "archived" && !pending && errors === 0 && !nothingNew;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={save}
          disabled={!canSave}
          title={t.shortcut}
        >
          <Save aria-hidden />
          {pending ? t.saving : t.saveDraft}
        </Button>
        <Button
          type="button"
          onClick={() => setDialog("publish")}
          disabled={!canPublish}
          aria-describedby={errors > 0 ? "publish-blocked" : undefined}
        >
          <Send aria-hidden />
          {t.publish}
        </Button>
        {status === "published" && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(
                () => unpublish(lessonId),
                () => t.unpublished,
              )
            }
          >
            <EyeOff aria-hidden />
            {t.unpublish}
          </Button>
        )}
        {hasDraft && hasPublished && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => setDialog("discard")}
          >
            <Undo2 aria-hidden />
            {t.discardDraft}
          </Button>
        )}
      </div>
      {errors > 0 && status !== "archived" && (
        <p id="publish-blocked" className="text-muted-foreground text-sm">
          {t.hasErrors(errors)}
        </p>
      )}
      {/* Alert is a live region itself (status, or alert for errors). */}
      {message && (
        <Alert variant={message.error ? "danger" : "success"}>
          {message.text}
        </Alert>
      )}

      <Dialog
        open={dialog === "publish"}
        onClose={() => setDialog(null)}
        title={t.publishTitle}
        closeLabel={t.close}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialog(null)}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              onClick={() =>
                run(
                  () => publish({ id: lessonId, sourceText: text }),
                  () => t.published,
                )
              }
            >
              {t.publishConfirm}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p>{hasPublished ? t.publishBody : t.publishFirstBody}</p>
          {settingsDirty && (
            <p className="text-muted-foreground text-sm">
              {t.publishSettingsDirty}
            </p>
          )}
        </div>
      </Dialog>
      <Dialog
        open={dialog === "discard"}
        onClose={() => setDialog(null)}
        title={t.discardTitle}
        closeLabel={t.close}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialog(null)}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() =>
                run(
                  () => discardDraft(lessonId),
                  () => t.discarded,
                )
              }
            >
              {t.discardConfirm}
            </Button>
          </>
        }
      >
        <p>{t.discardBody}</p>
      </Dialog>
    </div>
  );
}
