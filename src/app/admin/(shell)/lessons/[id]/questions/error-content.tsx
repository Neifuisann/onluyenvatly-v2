"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { catalogCopy, questionsCopy } from "@/features/lessons/messages";

export default function LessonQuestionsError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={questionsCopy.errorTitle}
      description={catalogCopy.errorBody}
      action={<Button onClick={retry}>{catalogCopy.retry}</Button>}
    />
  );
}
