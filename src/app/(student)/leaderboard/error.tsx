"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { leaderboardCopy as t } from "@/features/rating/messages";

export default function LeaderboardError({
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
