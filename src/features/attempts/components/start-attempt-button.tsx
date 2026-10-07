"use client";

import { Play } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { startCopy as t } from "../messages";
import { useOpenRunner } from "./use-open-runner";

/** Posts to `/api/attempts/start`; works without JavaScript as a plain form. */
export function StartAttemptButton({ lessonId }: { lessonId: number }) {
  const { onSubmit, pending, error } = useOpenRunner(t.failed);
  return (
    <form
      action="/api/attempts/start"
      method="post"
      onSubmit={onSubmit}
      className="grid gap-3"
    >
      {error && <Alert variant="danger">{error}</Alert>}
      <input type="hidden" name="lessonId" value={lessonId} />
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        aria-disabled={pending}
        className="h-13 w-full text-base"
      >
        <Play aria-hidden className="fill-current" />
        {pending ? t.starting : t.start}
      </Button>
    </form>
  );
}
