"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { runnerCopy as t } from "@/features/attempts/messages";

/**
 * A failed load (DB down, timeout) is not a missing attempt: offer a retry
 * instead of a 404. Unsynced answers wait in localStorage meanwhile.
 */
export default function AttemptError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <ErrorState
        title={t.errorTitle}
        description={t.errorBody}
        action={<Button onClick={retry}>{t.retry}</Button>}
      />
    </main>
  );
}
