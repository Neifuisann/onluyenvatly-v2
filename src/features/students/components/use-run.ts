"use client";

import { useState, useTransition } from "react";
import type { Result } from "@/lib/result";

export type RunMessage = { text: string; error: boolean };

/**
 * Runs an admin action and keeps its outcome in an `aria-live` message. The
 * server action already refreshed the page (`refresh()`), so nothing else is
 * needed to show the new state.
 */
export function useRun() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<RunMessage>();

  const run = <T>(
    action: () => Promise<Result<T>>,
    success: (data: T) => string,
    after?: (data: T) => void,
  ) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMessage({ text: success(result.data), error: false });
        after?.(result.data);
      } else setMessage({ text: result.message, error: true });
    });

  return { pending, message, setMessage, run };
}
