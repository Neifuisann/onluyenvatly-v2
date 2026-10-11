"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { classesCopy } from "@/features/classes/messages";
import { catalogCopy as t } from "@/features/lessons/messages";

export default function ClassesError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={classesCopy.errorTitle}
      description={t.errorBody}
      action={<Button onClick={retry}>{t.retry}</Button>}
    />
  );
}
