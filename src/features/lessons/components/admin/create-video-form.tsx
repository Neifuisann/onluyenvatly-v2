"use client";

import { MonitorPlay } from "lucide-react";
import { useActionState, useState } from "react";
import { FormField, fieldA11y } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type CreateVideoState, createVideoLesson } from "../../admin-actions";
import { parseYoutubeId, youtubeThumbnail } from "../../domain/video";
import { createCopy } from "../../messages";

const t = createCopy.video;

/**
 * `/admin/lessons/create?mode=video`: paste a YouTube link, see the video's
 * thumbnail, create the lesson. The server checks the link again and opens
 * the editor.
 */
export function CreateVideoForm() {
  const [state, action, pending] = useActionState<CreateVideoState, FormData>(
    createVideoLesson,
    { error: null, url: "" },
  );
  const [url, setUrl] = useState(state.url);
  const id = parseYoutubeId(url);
  return (
    <form
      action={action}
      className={cn(cardClass, "flex flex-col gap-4 p-5 sm:p-6")}
    >
      <FormField
        id="video-url"
        label={t.label}
        hint={t.hint}
        error={state.error ?? undefined}
      >
        <Input
          {...fieldA11y("video-url", state.error ?? undefined, t.hint)}
          name="url"
          type="url"
          inputMode="url"
          autoComplete="off"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
        />
      </FormField>
      {id ? (
        // biome-ignore lint/performance/noImgElement: a remote YouTube thumbnail, not an optimizable asset
        <img
          src={youtubeThumbnail(id)}
          alt={t.preview}
          width={480}
          height={360}
          className="aspect-video w-full max-w-md rounded-lg bg-muted object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full max-w-md items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <MonitorPlay aria-hidden className="size-10" />
        </div>
      )}
      <div>
        <Button type="submit" size="lg" disabled={pending || !id}>
          {pending ? t.submitting : t.submit}
        </Button>
      </div>
    </form>
  );
}
