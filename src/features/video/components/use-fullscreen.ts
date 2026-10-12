"use client";

import { type RefObject, useCallback, useEffect, useState } from "react";

/** How long a full screen request may take before the window is filled instead. */
const FALLBACK_MS = 1000;

/**
 * Full screen for the video and its questions together. Uses the
 * Fullscreen API where an element can go full screen; iPhones can't, so
 * there it fills the window instead (`pseudo`), and Escape leaves.
 */
export function useFullscreen(target: RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false);
  const [pseudo, setPseudo] = useState(false);

  useEffect(() => {
    const onChange = () =>
      setNative(
        document.fullscreenElement !== null &&
          document.fullscreenElement === target.current,
      );
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [target]);

  useEffect(() => {
    if (!pseudo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPseudo(false);
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [pseudo]);

  const toggle = useCallback(() => {
    const el = target.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    if (pseudo) {
      setPseudo(false);
      return;
    }
    if (!document.fullscreenEnabled || !el.requestFullscreen) {
      setPseudo(true);
      return;
    }
    // Refused, or left pending by an embedding browser: fill the window.
    let settled = false;
    el.requestFullscreen().then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
        setPseudo(true);
      },
    );
    setTimeout(() => {
      if (!settled && !document.fullscreenElement) setPseudo(true);
    }, FALLBACK_MS);
  }, [target, pseudo]);

  return { active: native || pseudo, pseudo, toggle };
}
