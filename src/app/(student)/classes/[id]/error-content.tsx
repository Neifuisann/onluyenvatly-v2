"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { catalogCopy as t } from "@/features/lessons/messages";

export default function LessonsError({
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
