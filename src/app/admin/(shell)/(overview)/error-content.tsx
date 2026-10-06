"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { overviewCopy } from "@/features/admin/messages";
import { catalogCopy } from "@/features/lessons/messages";

export default function AdminHomeError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={overviewCopy.errorTitle}
      description={catalogCopy.errorBody}
      action={<Button onClick={retry}>{catalogCopy.retry}</Button>}
    />
  );
}
