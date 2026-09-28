"use client";

import { useEffect } from "react";
import { type GuardKind, guardSecond } from "../../domain/guard";
import { useRunnerApi } from "./store";

/**
 * Exam guard (S4-04, 06 §3), on only when the lesson asks for it: records
 * leaving the page (blur, hidden tab or app switch, leaving full screen) and
 * blocks copy, cut and the context menu inside the runner. The events go out
 * with the next save; teachers read them, nothing is penalized automatically.
 */
export function useExamGuard(
  enabled: boolean,
  startedAt: string,
  serverNow: string,
) {
  const api = useRunnerApi();
  useEffect(() => {
    if (!enabled) return;
    const start = Date.parse(startedAt);
    // The phone's clock may be off; measure against the server's.
    const offset = Date.parse(serverNow) - Date.now();
    const record = (k: GuardKind) =>
      api
        .getState()
        .recordGuard({ t: guardSecond(start, Date.now() + offset), k });

    const onBlur = () => record("blur");
    const onVisibility = () => {
      if (document.visibilityState === "hidden") record("hidden");
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) record("fs-exit");
    };
    const block = (e: Event) => {
      e.preventDefault();
      record("copy");
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("contextmenu", block);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("contextmenu", block);
    };
  }, [api, enabled, startedAt, serverNow]);
}
