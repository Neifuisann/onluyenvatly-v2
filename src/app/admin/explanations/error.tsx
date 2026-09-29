"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { adminExplanationsCopy } from "@/features/ai/messages";
import { catalogCopy } from "@/features/lessons/messages";

export default function AdminExplanationsError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={adminExplanationsCopy.errorTitle}
      description={catalogCopy.errorBody}
      action={<Button onClick={retry}>{catalogCopy.retry}</Button>}
    />
  );
}
