"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { auditCopy } from "@/features/audit/messages";
import { catalogCopy } from "@/features/lessons/messages";

export default function AdminAuditError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={auditCopy.errorTitle}
      description={catalogCopy.errorBody}
      action={<Button onClick={retry}>{catalogCopy.retry}</Button>}
    />
  );
}
