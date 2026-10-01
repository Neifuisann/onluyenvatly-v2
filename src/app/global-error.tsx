"use client";

import "./globals.css";
import { useEffect } from "react";
import { stateCopy as t } from "@/lib/messages";
import { reportClientError } from "@/lib/monitoring-bootstrap";

/**
 * The root layout itself failed: its own document with the app CSS. The
 * layout's theme script and fonts don't run here, so it shows the light
 * tokens in the system font.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => reportClientError(error), [error]);
  return (
    <html lang="vi">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
        <title>{t.errorTitle}</title>
        <h1 className="heading-page">{t.errorTitle}</h1>
        <p className="max-w-sm text-muted-foreground">{t.errorBody}</p>
        <button
          type="button"
          onClick={retry}
          className="h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground text-sm"
        >
          {t.retry}
        </button>
      </body>
    </html>
  );
}
