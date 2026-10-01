"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { editorCopy as t } from "@/features/lessons/messages";
import { stateCopy } from "@/lib/messages";

export default function EditorError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={t.errorTitle}
      description={t.errorBody}
      action={<Button onClick={retry}>{stateCopy.retry}</Button>}
    />
  );
}
