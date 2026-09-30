"use client";

import { Image as ImageIcon, ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  ACCEPT_ATTR,
  uploadImage,
} from "@/features/media/components/upload-image";
import { uploadCopy as t } from "@/features/media/messages";
import { mediaUrl } from "@/lib/media";
import { setCover } from "../../admin-actions";

/**
 * "Ảnh bìa" (S5-05): uploads like the editor's images and saves the path at
 * once. The refresh after `setCover` brings the new cover back as a prop.
 */
export function CoverPicker({
  lessonId,
  coverPath,
}: {
  lessonId: number;
  coverPath: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const src = coverPath ? mediaUrl(coverPath) : null;

  const save = (path: string | null, done: string) => {
    const result = setCover({ id: lessonId, path });
    return result.then((r) =>
      setMessage(
        r.ok ? { text: done, error: false } : { text: r.message, error: true },
      ),
    );
  };

  const onPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage(undefined);
    startTransition(async () => {
      const uploaded = await uploadImage(file);
      if (!uploaded.ok) {
        setMessage({ text: uploaded.message, error: true });
        return;
      }
      await save(uploaded.data.path, t.coverSaved);
    });
  };

  return (
    <section
      aria-labelledby="cover-title"
      className="flex flex-col gap-4 rounded-lg border border-border/70 bg-surface p-5 shadow-card sm:p-6 dark:border-border"
    >
      <div className="space-y-1">
        <h2
          id="cover-title"
          className="flex items-center gap-2.5 heading-section"
        >
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary"
          >
            <ImageIcon className="size-[1.125rem]" strokeWidth={2} />
          </span>
          {t.cover}
        </h2>
        <p className="text-muted-foreground text-sm">{t.coverHint}</p>
      </div>
      {coverPath ? (
        src ? (
          // biome-ignore lint/performance/noImgElement: lesson media skips next/image (ADR-006)
          <img
            src={src}
            alt={t.coverAlt}
            className="aspect-[16/7] w-full max-w-md rounded-lg border object-cover"
          />
        ) : (
          <p className="text-sm">{t.coverNoPreview}</p>
        )
      ) : (
        <p className="flex aspect-[16/7] w-full max-w-md items-center justify-center rounded-lg border border-dashed px-4 text-center text-muted-foreground text-sm">
          {t.coverNone}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => input.current?.click()}
        >
          <ImagePlus aria-hidden />
          {pending ? t.uploading(1) : coverPath ? t.coverChange : t.coverPick}
        </Button>
        {coverPath && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await save(null, t.coverRemoved);
              })
            }
          >
            <Trash2 aria-hidden />
            {t.coverRemove}
          </Button>
        )}
        <input
          ref={input}
          type="file"
          accept={ACCEPT_ATTR}
          hidden
          onChange={onPicked}
          aria-label={t.coverPick}
        />
      </div>
      {message && (
        <Alert variant={message.error ? "danger" : "success"}>
          {message.text}
        </Alert>
      )}
    </section>
  );
}
