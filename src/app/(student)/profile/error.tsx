"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { profileCopy as t } from "@/features/profile/messages";

export default function ProfileError({
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
