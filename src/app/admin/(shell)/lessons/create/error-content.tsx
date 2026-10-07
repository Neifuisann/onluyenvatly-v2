"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { catalogCopy, createCopy } from "@/features/lessons/messages";

export default function CreateLessonError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={createCopy.title}
      description={catalogCopy.errorBody}
      action={<Button onClick={retry}>{catalogCopy.retry}</Button>}
    />
  );
}
