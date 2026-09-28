"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { localToRestore, retryDelayMs } from "../../domain/runner-state";
import { clearLocal, readLocal, writeLocal } from "./local-copy";
import { useRunnerApi } from "./store";

/** 08 §4: dirty-checked, at most every 30 s, plus a flush on page hide. */
export const AUTOSAVE_MS = 30_000;

export type SaveStatus =
  /** The server has everything. */
  | "saved"
  /** Changes are in localStorage, waiting for the next sync. */
  | "local"
  | "saving"
  /** The last sync failed on the network; retrying with backoff. */
  | "offline"
  /** The server no longer takes saves (submitted, expired or gone). */
  | "closed"
  | "signed-out";

type Json = { ok?: boolean };

/**
 * Autosave queue (S3-05). Every change goes to localStorage at once; the
 * server gets the whole (small) state when it changed: every 30 s, when the
 * tab is hidden, when the network comes back, and by `sendBeacon` on page
 * hide. Failures retry with backoff. A 409/404 means the attempt closed.
 */
export function useAutosave(attemptId: string, onClosed: () => void) {
  const api = useRunnerApi();
  const [status, setStatus] = useState<SaveStatus>("saved");
  const q = useRef({
    rev: 0,
    savedRev: 0,
    inFlight: false,
    failures: 0,
    stopped: false,
    retry: undefined as ReturnType<typeof setTimeout> | undefined,
  }).current;
  const closedRef = useRef(onClosed);
  useEffect(() => {
    closedRef.current = onClosed;
  }, [onClosed]);
  const url = `/api/attempts/${attemptId}/save`;

  /** The request body and how many guard events it carries. */
  const snapshot = useCallback(() => {
    const { answers, flagged, guard } = api.getState();
    const guardEvents = [...guard];
    return {
      data: JSON.stringify({ answers, flagged, guardEvents }),
      guardSent: guardEvents.length,
    };
  }, [api]);

  const sync = useCallback(async (): Promise<void> => {
    if (q.inFlight || q.stopped || q.rev === q.savedRev) return;
    const sent = q.rev;
    q.inFlight = true;
    clearTimeout(q.retry);
    setStatus("saving");
    let retry = false;
    const { data, guardSent } = snapshot();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: data,
        keepalive: true,
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as Json | null;
      if (res.ok && json?.ok) {
        q.savedRev = sent;
        q.failures = 0;
        if (guardSent > 0) api.getState().ackGuard(guardSent);
        if (q.rev === sent) {
          const { answers, flagged } = api.getState();
          writeLocal(attemptId, { answers, flagged, dirty: false });
          setStatus("saved");
        } else setStatus("local");
      } else if (res.status === 401) {
        setStatus("signed-out");
      } else if (res.status === 404 || res.status === 409) {
        q.stopped = true;
        setStatus("closed");
        closedRef.current();
      } else {
        retry = true;
        setStatus("local");
      }
    } catch {
      retry = true;
      setStatus("offline");
    } finally {
      q.inFlight = false;
    }
    if (retry && !q.stopped) {
      q.failures += 1;
      q.retry = setTimeout(() => void sync(), retryDelayMs(q.failures));
    }
  }, [api, attemptId, snapshot, q, url]);

  /** Last-chance flush while the page goes away; the response is never read. */
  const beacon = useCallback(() => {
    if (q.stopped || q.rev === q.savedRev) return;
    const { data } = snapshot();
    // text/plain keeps the beacon a "simple" request; the server reads any type.
    const sent = navigator.sendBeacon?.(
      url,
      new Blob([data], { type: "text/plain;charset=UTF-8" }),
    );
    if (!sent)
      void fetch(url, {
        method: "POST",
        body: data,
        keepalive: true,
        headers: { "content-type": "application/json" },
      }).catch(() => {});
  }, [snapshot, q, url]);

  useEffect(() => {
    // Unsynced answers from before a reload or a lost connection win.
    const restored = localToRestore(
      readLocal(attemptId),
      api.getState().answers.length,
    );
    if (restored) {
      api.setState(restored);
      q.rev += 1;
      setStatus("local");
    }
    const unsubscribe = api.subscribe((next, prev) => {
      // A new guard event needs a save too; acknowledging one doesn't.
      if (next.guard.length > prev.guard.length) q.rev += 1;
      if (next.answers === prev.answers && next.flagged === prev.flagged)
        return;
      q.rev += 1;
      writeLocal(attemptId, {
        answers: next.answers,
        flagged: next.flagged,
        dirty: true,
      });
      if (q.stopped || q.inFlight) return;
      if (!navigator.onLine) setStatus("offline");
      else
        setStatus((s) => (s === "offline" || s === "signed-out" ? s : "local"));
    });
    const interval = setInterval(() => void sync(), AUTOSAVE_MS);
    const onOnline = () => void sync();
    const onOffline = () => {
      if (q.rev !== q.savedRev) setStatus("offline");
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void sync();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("pagehide", beacon);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      clearInterval(interval);
      clearTimeout(q.retry);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("pagehide", beacon);
      document.removeEventListener("visibilitychange", onVisibility);
      // Leaving through an in-app link: no pagehide, so flush here.
      beacon();
    };
  }, [api, attemptId, beacon, q, sync]);

  return {
    status,
    /** Stops autosave for good (the attempt is being submitted). */
    stop: useCallback(() => {
      q.stopped = true;
      clearTimeout(q.retry);
    }, [q]),
    /** Undo `stop` when a submit could not be delivered. */
    resume: useCallback(() => {
      q.stopped = false;
    }, [q]),
    /** Forget the local copy once the server has graded the attempt. */
    forget: useCallback(() => clearLocal(attemptId), [attemptId]),
    /** Saves now if anything changed (e.g. the navigator's "save" moment). */
    sync,
  };
}
