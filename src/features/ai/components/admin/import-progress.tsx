"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { importCopy as t } from "../../messages";

/** After this long with no question yet, say the AI is busy and retrying. */
const BUSY_AFTER_S = 60;
/** After this long, say long exams take a while. */
const LONG_AFTER_S = 20;

/**
 * What the import is doing while the teacher waits (S7-04): the three steps,
 * a sweeping bar, the time waited and the questions received so far, so a
 * slow model never looks like a frozen page. Only the stage sentence is
 * announced; the ticking clock and the count are not.
 */
export function ImportProgress({
  phase,
  startedAt,
  received,
}: {
  phase: "uploading" | "reading";
  /** `Date.now()` when the teacher pressed the button. */
  startedAt: number;
  /** Questions parsed from the stream so far. */
  received: number;
}) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));

  const step = phase === "uploading" ? 0 : received > 0 ? 2 : 1;
  const message =
    phase === "uploading"
      ? t.uploading
      : received > 0
        ? t.writing
        : seconds >= BUSY_AFTER_S
          ? t.busyRetry
          : seconds >= LONG_AFTER_S
            ? t.readingLong
            : t.readingStart;

  return (
    <section
      aria-label={t.progressLabel}
      className="flex flex-col gap-4 rounded-lg border border-primary/30 bg-primary-soft/40 p-5 shadow-card sm:p-6"
    >
      <div className="flex items-start gap-3">
        <LoaderCircle
          aria-hidden
          className="mt-0.5 size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
        />
        <output className="min-w-0 flex-1 font-semibold">{message}</output>
        <span className="num shrink-0 rounded-full bg-surface px-2.5 py-0.5 font-semibold text-muted-foreground text-xs shadow-card">
          {t.elapsed(seconds)}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
        <div className="h-full w-1/3 animate-indeterminate rounded-full bg-primary motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60" />
      </div>

      <ol className="grid gap-2 text-sm sm:grid-cols-3">
        {t.progressSteps.map((label, i) => {
          const state = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <li
              key={label}
              aria-current={state === "active" ? "step" : undefined}
              className={cn(
                "flex items-center gap-2",
                state === "todo" && "text-muted-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "num flex size-6 shrink-0 items-center justify-center rounded-full font-bold text-xs",
                  state === "done" && "bg-success text-success-foreground",
                  state === "active" && "bg-primary text-primary-foreground",
                  state === "todo" && "bg-surface text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn(state === "active" && "font-semibold")}>
                {label}
                {i === 2 && received > 0 && (
                  <span className="num font-normal text-muted-foreground">
                    {" "}
                    ({t.received(received)})
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
