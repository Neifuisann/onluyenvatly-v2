"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { stateCopy as t } from "@/lib/messages";
import { reportClientError } from "@/lib/monitoring-bootstrap";

/** Last boundary for pages without their own (landing, auth, public). */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => reportClientError(error), [error]);
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-4">
      <ErrorState
        title={t.errorTitle}
        description={t.errorBody}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={retry}>{t.retry}</Button>
            <Link href="/" className={buttonVariants({ variant: "ghost" })}>
              {t.home}
            </Link>
          </div>
        }
      />
    </main>
  );
}
