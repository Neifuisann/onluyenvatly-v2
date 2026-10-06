"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { catalogCopy } from "@/features/lessons/messages";
import { settingsCopy } from "@/features/settings/messages";

export default function AdminSettingsError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      title={settingsCopy.errorTitle}
      description={catalogCopy.errorBody}
      action={<Button onClick={retry}>{catalogCopy.retry}</Button>}
    />
  );
}
