"use client";

import { Play } from "lucide-react";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { startAttempt } from "../actions";
import { startCopy as t } from "../messages";

/** Posts `startAttempt`; works without JavaScript as a plain form. */
export function StartAttemptButton({ lessonId }: { lessonId: number }) {
  const [state, action, pending] = useActionState(startAttempt, null);
  const failed = state && !state.ok ? state : null;
  return (
    <form action={action} className="grid gap-3">
      {failed && <Alert variant="danger">{failed.message}</Alert>}
      <input type="hidden" name="lessonId" value={lessonId} />
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        aria-disabled={pending}
        className="w-full sm:w-auto"
      >
        <Play aria-hidden />
        {pending ? t.starting : t.start}
      </Button>
    </form>
  );
}
