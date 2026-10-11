"use client";

import { Copy } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { FormField } from "@/components/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { shareLesson } from "@/features/classes/actions";
import { useOrigin } from "@/features/classes/components/admin/invite-panel";
import { cn } from "@/lib/utils";
import { adminLessonsCopy as t } from "../../messages";

export type ShareClass = { id: number; name: string };

/**
 * "Chia sẻ cho học sinh" (B-03): a lesson reaches students only through a
 * class, so the teacher picks one. The lesson is given to that class if it
 * isn't yet, and the copied link is the class's invite with the lesson
 * (`/join/<code>?bai=<id>`): whoever opens it joins the class and lands on
 * the lesson. The link is also shown, for browsers that refuse the copy
 * after the round trip.
 */
export function ShareLessonDialog({
  lesson,
  classes,
  onClose,
}: {
  lesson: { id: number; title: string } | null;
  classes: readonly ShareClass[];
  onClose: () => void;
}) {
  const origin = useOrigin();
  const selectId = useId();
  const [classId, setClassId] = useState(classes[0]?.id ?? 0);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const [pending, startTransition] = useTransition();

  const close = () => {
    setUrl("");
    setMessage(undefined);
    onClose();
  };

  const share = () =>
    startTransition(async () => {
      if (!lesson) return;
      const result = await shareLesson({ lessonId: lesson.id, classId });
      if (!result.ok) {
        setMessage({ text: result.message, error: true });
        return;
      }
      const link = `${origin}${result.data.path}`;
      setUrl(link);
      const name = classes.find((c) => c.id === classId)?.name ?? "";
      try {
        await navigator.clipboard.writeText(link);
        setMessage({
          text: t.shareCopied(result.data.assigned, name),
          error: false,
        });
      } catch {
        setMessage({ text: t.shareCopyFailed, error: true });
      }
    });

  return (
    <Dialog
      open={lesson !== null}
      onClose={close}
      title={t.shareTitle}
      closeLabel={t.close}
      footer={
        classes.length > 0 ? (
          <>
            <Button variant="secondary" onClick={close}>
              {t.close}
            </Button>
            <Button onClick={share} disabled={pending || !classId}>
              <Copy aria-hidden />
              {pending ? t.shareWorking : t.shareCopy}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="grid gap-4">
        {lesson && <p className="font-semibold">{lesson.title}</p>}
        {classes.length === 0 ? (
          <>
            <p className="text-muted-foreground">{t.shareNoClasses}</p>
            <Link
              href="/admin/classes"
              prefetch={false}
              className={cn(buttonVariants(), "justify-self-start")}
            >
              {t.shareToClasses}
            </Link>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">{t.shareLead}</p>
            <FormField id={selectId} label={t.shareClass}>
              <Select
                id={selectId}
                value={classId}
                onChange={(e) => {
                  setClassId(Number(e.target.value));
                  setUrl("");
                  setMessage(undefined);
                }}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
            {url && (
              <div className="grid gap-1">
                <p className="font-medium text-muted-foreground text-sm">
                  {t.shareLink}
                </p>
                <p className="select-all break-all rounded-lg bg-muted px-3 py-2 font-mono text-sm">
                  {url}
                </p>
              </div>
            )}
          </>
        )}
        <output
          aria-live="polite"
          className={cn(
            "min-h-5 text-sm empty:hidden",
            message?.error ? "text-danger-text" : "text-muted-foreground",
          )}
        >
          {message?.text}
        </output>
      </div>
    </Dialog>
  );
}
