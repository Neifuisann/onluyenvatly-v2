"use client";

import { Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { timerCopy as t } from "../../messages";

const WARN_S = 5 * 60;
const DANGER_S = 60;

/**
 * Countdown against the server's `deadline_at` (07 §4, 08: no polling). The
 * phone's clock may be off, so the offset to the server clock is measured
 * once at mount. Screen readers hear 5 and 1 minute left, not every second.
 */
export function TestTimer({
  deadlineAt,
  serverNow,
  onExpire,
}: {
  deadlineAt: string;
  serverNow: string;
  onExpire: () => void;
}) {
  const deadline = Date.parse(deadlineAt);
  // SSR and hydration both start from the server's clock: no mismatch.
  const [left, setLeft] = useState(() =>
    Math.max(0, (deadline - Date.parse(serverNow)) / 1000),
  );
  const [announce, setAnnounce] = useState("");
  const expireRef = useRef(onExpire);
  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const offset = Date.parse(serverNow) - Date.now();
    const start = (deadline - Date.parse(serverNow)) / 1000;
    let announced = start <= DANGER_S ? DANGER_S : start <= WARN_S ? WARN_S : 0;
    let expired = false;
    const tick = () => {
      const s = Math.max(0, (deadline - (Date.now() + offset)) / 1000);
      setLeft(s);
      for (const mark of [WARN_S, DANGER_S])
        if (s <= mark && s > 0 && (announced === 0 || mark < announced)) {
          announced = mark;
          setAnnounce(t.left(mark / 60));
        }
      if (s <= 0 && !expired) {
        expired = true;
        setAnnounce(t.timeUp);
        expireRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, serverNow]);

  return (
    <>
      <p
        role="timer"
        aria-label={t.label}
        className={cn(
          "num flex h-9 items-center gap-1.5 rounded-full px-3 font-display font-semibold text-base transition-colors duration-300",
          left > WARN_S && "bg-muted text-foreground",
          left <= WARN_S &&
            left > DANGER_S &&
            "bg-warning text-warning-foreground",
          left <= DANGER_S && "bg-danger text-danger-foreground",
        )}
      >
        <Timer aria-hidden className="size-4" />
        {formatClock(Math.ceil(left))}
      </p>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </>
  );
}
