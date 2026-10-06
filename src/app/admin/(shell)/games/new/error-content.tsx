"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { gameCopy } from "@/features/games/messages";
import { catalogCopy } from "@/features/lessons/messages";

export default function NewGameError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={gameCopy.create.errorTitle}
      description={catalogCopy.errorBody}
      action={<Button onClick={retry}>{catalogCopy.retry}</Button>}
    />
  );
}
