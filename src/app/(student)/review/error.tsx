"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { reviewCopy as t } from "@/features/review/messages";
import { errorMessages } from "@/lib/messages";

export default function ReviewError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={t.errorTitle}
      description={errorMessages.INTERNAL}
      action={<Button onClick={retry}>{t.retry}</Button>}
    />
  );
}
