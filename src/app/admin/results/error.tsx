"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { resultsCopy } from "@/features/attempts/messages";
import { catalogCopy } from "@/features/lessons/messages";

export default function AdminResultsError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={resultsCopy.errorTitle}
      description={catalogCopy.errorBody}
      action={<Button onClick={retry}>{catalogCopy.retry}</Button>}
    />
  );
}
