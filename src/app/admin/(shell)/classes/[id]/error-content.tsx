"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { classesCopy } from "@/features/classes/messages";
import { catalogCopy } from "@/features/lessons/messages";

export default function AdminClassesError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={classesCopy.errorTitle}
      description={catalogCopy.errorBody}
      action={<Button onClick={retry}>{catalogCopy.retry}</Button>}
    />
  );
}
