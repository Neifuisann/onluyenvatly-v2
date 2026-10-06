"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const SENTINEL = "__runnerGuard";
/**
 * This page load. After a reload the entries behind the runner belong to the
 * old document (Back from them is a full load, no `popstate`), so an extra
 * entry is reused only if this load pushed it.
 */
const LOAD = Math.random().toString(36).slice(2);

/**
 * Asks before the student leaves a test in progress: the browser's or the
 * phone's Back, the X in the header, reload and closing the tab. Back is
 * caught with an extra history entry (same URL) on top of the runner, pushed
 * on the first tap or key press: browsers skip entries a page adds without
 * user activation, and `beforeunload` needs activation too. Reload and close
 * get the browser's own prompt; its text can't be changed.
 */
export function useLeaveGuard(enabled: boolean, exitHref: string) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  // `on`: the extra entry is the current one. Survives the dev double mount.
  const s = useRef({ on: false, leaving: false }).current;

  useEffect(() => {
    if (!enabled) return;
    s.leaving = false;
    const push = () => {
      // No URL: Next keeps its own state and doesn't navigate.
      window.history.pushState({ [SENTINEL]: LOAD }, "");
      s.on = true;
    };
    const arm = () => {
      if (s.on || s.leaving) return;
      if (window.history.state?.[SENTINEL] === LOAD) s.on = true;
      else push();
    };
    const onPop = () => {
      if (s.leaving || !s.on) return;
      // Back from the extra entry: still on the runner. Re-arm and ask.
      push();
      setAsking(true);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!s.leaving) e.preventDefault();
    };
    window.addEventListener("pointerdown", arm, true);
    window.addEventListener("keydown", arm, true);
    window.addEventListener("popstate", onPop);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pointerdown", arm, true);
      window.removeEventListener("keydown", arm, true);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [enabled, s]);

  /**
   * Leaves for `href` without asking (submitted, or confirmed). Drops the
   * extra entry first, so Back from there doesn't land on a stale runner.
   */
  const leave = useCallback(
    (href: string) => {
      s.leaving = true;
      if (!s.on) return router.replace(href);
      s.on = false;
      window.addEventListener("popstate", () => router.replace(href), {
        once: true,
      });
      window.history.back();
    },
    [router, s],
  );

  /**
   * "Thoát" in the dialog, after the X or Back alike: to the lesson, freshly
   * rendered. Going further back isn't reliable (after a reload the entry
   * behind is the runner again, and a cached lesson page says "Bắt đầu"
   * instead of "Tiếp tục").
   */
  const confirm = useCallback(() => {
    setAsking(false);
    leave(exitHref);
  }, [exitHref, leave]);

  return {
    asking,
    /** The X: ask first. */
    exit: useCallback(() => setAsking(true), []),
    stay: useCallback(() => setAsking(false), []),
    confirm,
    leave,
  };
}
