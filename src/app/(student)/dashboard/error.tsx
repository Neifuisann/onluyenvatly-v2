"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { dashboardCopy as t } from "@/features/dashboard/messages";

export default function DashboardError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={t.errorTitle}
      description={t.errorBody}
      action={<Button onClick={retry}>{t.retry}</Button>}
    />
  );
}
