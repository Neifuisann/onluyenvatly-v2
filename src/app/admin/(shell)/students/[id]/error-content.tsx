"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { catalogCopy } from "@/features/lessons/messages";
import { studentsCopy } from "@/features/students/messages";

export default function AdminStudentError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={studentsCopy.detailErrorTitle}
      description={catalogCopy.errorBody}
      action={<Button onClick={retry}>{catalogCopy.retry}</Button>}
    />
  );
}
