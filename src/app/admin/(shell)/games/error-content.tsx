"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { gameCopy } from "@/features/games/messages";
import { catalogCopy } from "@/features/lessons/messages";

export default function AdminGamesError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={gameCopy.admin.errorTitle}
      description={catalogCopy.errorBody}
      action={<Button onClick={retry}>{catalogCopy.retry}</Button>}
    />
  );
}
