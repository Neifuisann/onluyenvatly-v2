"use client";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { stateCopy as t } from "@/lib/messages";

export default function ShareError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="px-4 py-8">
      <ErrorState
        title={t.errorTitle}
        description={t.errorBody}
        action={<Button onClick={retry}>{t.retry}</Button>}
      />
    </div>
  );
}
