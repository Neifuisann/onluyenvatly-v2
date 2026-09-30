"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { accountCopy as t } from "@/features/account/messages";

export default function SettingsError({
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
