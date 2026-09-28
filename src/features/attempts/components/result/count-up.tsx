"use client";

import { useEffect, useState } from "react";
import { formatScore } from "@/lib/dates";

/**
 * Counts up to `value` once (07 §5.4). The server HTML already holds the
 * final number; motion only starts after hydration and never with reduced
 * motion.
 */
export function CountUp({
  value,
  durationMs = 700,
}: {
  value: number;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      // Ease out: fast start, gentle landing.
      setShown(value * (1 - (1 - p) ** 3));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);
  return <>{formatScore(shown)}</>;
}
