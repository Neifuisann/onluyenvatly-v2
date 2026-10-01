"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { resultCopy } from "@/features/attempts/messages";
import { stateCopy } from "@/lib/messages";

export default function ResultError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={resultCopy.errorTitle}
      description={stateCopy.errorBody}
      action={<Button onClick={retry}>{stateCopy.retry}</Button>}
    />
  );
}
