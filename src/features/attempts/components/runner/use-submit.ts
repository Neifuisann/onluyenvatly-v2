"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { retryDelayMs } from "../../domain/runner-state";
import { submitCopy } from "../../messages";
import { useRunnerApi } from "./store";
import type { useAutosave } from "./use-autosave";

type Json = {
  ok?: boolean;
  message?: string;
  data?: { resultUrl?: string };
};

/**
 * Submits the answers on screen (S3-06). Network failures retry with backoff
 * until the server answers; the server keeps a 30 s grace after the deadline
 * and grades later arrivals with the last saved answers. One idempotency key
 * per page, so a retry can't grade twice.
 */
export function useSubmit(
  attemptId: string,
  { stop, resume, forget }: ReturnType<typeof useAutosave>,
  /** Opens the result without the leave prompt (`useLeaveGuard`). */
  leave: (href: string) => void,
) {
  const api = useRunnerApi();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const submit = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    key.current ??= crypto.randomUUID();
    stop();
    setSubmitting(true);
    setError(null);
    for (let failures = 0; alive.current; ) {
      const { answers, flagged, guard } = api.getState();
      try {
        const res = await fetch(`/api/attempts/${attemptId}/submit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            answers,
            flagged,
            guardEvents: guard,
            clientSubmitId: key.current,
          }),
          keepalive: true,
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as Json | null;
        if (res.ok && json?.ok && json.data?.resultUrl) {
          forget();
          leave(json.data.resultUrl);
          return;
        }
        if (res.status === 404) {
          router.refresh();
          return;
        }
        if (res.status >= 500) throw new Error(`submit ${res.status}`);
        // 400/401/403: retrying won't help; let the student act.
        setError(json?.message ?? submitCopy.failed);
        break;
      } catch {
        failures += 1;
        setError(submitCopy.retrying);
        await new Promise((r) => setTimeout(r, retryDelayMs(failures)));
      }
    }
    busy.current = false;
    resume();
    if (alive.current) setSubmitting(false);
  }, [api, attemptId, forget, leave, resume, router, stop]);

  return { submit, submitting, error };
}
