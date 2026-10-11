"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { archiveClass, deleteClass } from "../../actions";
import { classesCopy as t } from "../../messages";
import { ConfirmButton } from "./confirm-button";

/** Archive / restore and delete a class (B-03). */
export function ClassDanger({
  classId,
  name,
  archived,
}: {
  classId: number;
  name: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const run = (action: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const result = await action();
      setError(result.ok ? undefined : result.message);
    });
  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-sm">{t.archiveLead}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(() => archiveClass({ id: classId, archived: !archived }))
          }
        >
          {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {archived ? t.restore : t.archive}
        </Button>
        <ConfirmButton
          label={
            <>
              <Trash2 aria-hidden />
              {t.deleteClass}
            </>
          }
          title={t.deleteClass}
          body={t.deleteConfirm(name)}
          confirmLabel={t.deleteClass}
          variant="secondary"
          disabled={pending}
          onConfirm={() => run(() => deleteClass(classId))}
        />
      </div>
      <output aria-live="polite" className="min-h-5 text-danger-text text-sm">
        {error}
      </output>
    </div>
  );
}
