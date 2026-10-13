"use client";

import { useEffect, useRef, useState } from "react";
import { clockOffset } from "./use-room-poll";

/**
 * Whole seconds left until `target` on the server's clock (B-15), ticking
 * four times a second; 0 once it has passed, null without a target.
 * `serverNow` aligns this device's clock with the server's.
 */
export function useCountdown(
  target: string | null,
  serverNow: string,
): number | null {
  // Measured when a new server time arrives, not on every render.
  const synced = useRef({ serverNow, offset: clockOffset(serverNow) });
  if (synced.current.serverNow !== serverNow)
    synced.current = { serverNow, offset: clockOffset(serverNow) };
  const at = target ? Date.parse(target) : null;
  const left = () =>
    at === null
      ? null
      : Math.max(
          0,
          Math.ceil((at - (Date.now() + synced.current.offset)) / 1000),
        );
  const [seconds, setSeconds] = useState<number | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `left` reads only `at` and a ref
  useEffect(() => {
    setSeconds(left());
    if (at === null) return;
    const id = setInterval(() => setSeconds(left()), 250);
    return () => clearInterval(id);
  }, [at]);

  return seconds;
}
