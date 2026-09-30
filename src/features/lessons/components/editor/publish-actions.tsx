"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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

export type EditorMessage = { text: string; error: boolean };

type SaveDraftResult = { unchanged: boolean; errors: number };

/**
 * Save / publish of the lesson text (S5-04) for both editor steps. The server
 * re-parses and checks the text; the refresh after each action brings the
 * saved text and question ids back into the editor. `beforePublish` saves
 * changed settings first, so "Xuất bản" publishes what the teacher sees.
 */
export function usePublishActions({
  lessonId,
  status,
  text,
  textDirty,
  settingsDirty,
  hasDraft,
  hasPublished,
  errors,
  beforePublish,
  onMessage,
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
  /** Resolves false to stop (the reason is already shown). */
  beforePublish: () => Promise<boolean>;
  onMessage: (message: EditorMessage | undefined) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"publish" | "discard" | null>(null);

  const report = (result: Result<unknown>, success: string) =>
    onMessage(
      result.ok
        ? { text: success, error: false }
        : { text: result.message, error: true },
    );

  const draftMessage = (d: SaveDraftResult) =>
    d.unchanged
      ? t.unchanged
      : d.errors
        ? t.savedWithErrors(d.errors)
        : t.saved;

  /** Saves the text as the draft; resolves whether it worked. */
  const saveNow = async () => {
    const result = await saveDraft({ id: lessonId, sourceText: text });
    report(result, result.ok ? draftMessage(result.data) : "");
    return result.ok;
  };

  const archived = status === "archived";
  const canSave = textDirty && !pending && !archived;
  const nothingNew =
    status === "published" && !hasDraft && !textDirty && !settingsDirty;
  const canPublish = !archived && !pending && errors === 0 && !nothingNew;

  // Ctrl/Cmd+S saves the draft from anywhere in the editor.
  const saveRef = useRef(saveNow);
  saveRef.current = saveNow;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      if (canSave) {
        onMessage(undefined);
        startTransition(async () => {
          await saveRef.current();
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSave, onMessage]);

  const run = (work: () => Promise<unknown>) => {
    setDialog(null);
    onMessage(undefined);
    startTransition(async () => {
      await work();
    });
  };

  const actions = {
    pending,
    canSave,
    canPublish,
    save: () => run(saveNow),
    /** Saves the text when it changed, then calls `next` if that worked. */
    saveThen: (next: () => void) =>
      run(async () => {
        if (!textDirty || archived || (await saveNow())) next();
      }),
    askPublish: () => setDialog("publish"),
    unpublish: () =>
      run(async () => report(await unpublish(lessonId), t.unpublished)),
    askDiscard: () => setDialog("discard"),
  };

  const dialogs = (
    <>
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
                run(async () => {
                  if (!(await beforePublish())) return;
                  report(
                    await publish({ id: lessonId, sourceText: text }),
                    t.published,
                  );
                })
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
                run(async () =>
                  report(await discardDraft(lessonId), t.discarded),
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
    </>
  );

  return { ...actions, dialogs };
}
