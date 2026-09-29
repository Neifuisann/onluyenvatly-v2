"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { lessonHelpersCopy as t } from "@/features/ai/messages";
import type { Result } from "@/lib/result";
import { cn } from "@/lib/utils";

/**
 * A small "ask the AI" button under a settings field (S7-05). It runs the
 * given server action and reports in a live region; `onResult` puts the
 * answer into the form and returns the message to show.
 */
export function AiHelper<T>({
  id,
  label,
  run,
  onResult,
}: {
  id: string;
  label: string;
  /** null: something is missing locally; the string says what. */
  run: () => Promise<Result<T>> | string;
  onResult: (data: T) => string;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ text: string; error: boolean }>();

  const click = () => {
    const call = run();
    if (typeof call === "string") {
      setStatus({ text: call, error: true });
      return;
    }
    setStatus(undefined);
    startTransition(async () => {
      const result = await call;
      setStatus(
        result.ok
          ? { text: onResult(result.data), error: false }
          : { text: result.message, error: true },
      );
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={click}
        disabled={pending}
        aria-describedby={`${id}-status`}
      >
        <Sparkles aria-hidden />
        {pending ? t.working : label}
      </Button>
      <p
        id={`${id}-status`}
        aria-live="polite"
        className={cn(
          "text-sm",
          status?.error ? "text-danger-text" : "text-muted-foreground",
        )}
      >
        {status?.text}
      </p>
    </div>
  );
}
