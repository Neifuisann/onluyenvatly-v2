"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { importCopy } from "@/features/ai/messages";
import { catalogCopy } from "@/features/lessons/messages";

export default function AdminImportError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={importCopy.title}
      description={catalogCopy.errorBody}
      action={<Button onClick={retry}>{catalogCopy.retry}</Button>}
    />
  );
}
