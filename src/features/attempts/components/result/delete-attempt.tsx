"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { deleteAttempt } from "../../admin-actions";
import { deleteAttemptCopy as t } from "../../messages";

/**
 * "Xóa bài làm" on the result page (admins only, S6-04): a confirm dialog,
 * then the results list, since this page no longer exists.
 */
export function DeleteAttempt({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await deleteAttempt(attemptId);
      if (result.ok) {
        router.replace("/admin/results");
        return;
      }
      setOpen(false);
      setError(result.message);
    });

  return (
    <section
      aria-labelledby="attempt-admin-heading"
      className="flex flex-col gap-3 rounded-lg border border-border/70 bg-surface p-5 shadow-card dark:border-border"
    >
      <h2 id="attempt-admin-heading" className="font-semibold">
        {t.section}
      </h2>
      <Button
        variant="secondary"
        className="w-fit text-danger-text"
        disabled={pending}
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden />
        {t.button}
      </Button>
      <output aria-live="polite" className="min-h-5 text-danger-text text-sm">
        {error}
      </output>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t.title}
        closeLabel={t.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t.cancel}
            </Button>
            <Button variant="danger" disabled={pending} onClick={confirm}>
              {pending ? t.deleting : t.confirm}
            </Button>
          </>
        }
      >
        <p>{t.body}</p>
      </Dialog>
    </section>
  );
}
