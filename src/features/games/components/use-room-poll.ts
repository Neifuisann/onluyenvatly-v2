"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Result } from "@/lib/result";
import type { RoomState } from "../types";

export type PollProblem = "offline" | "removed" | null;

/** After this long without a change, a quiet room is polled less often. */
export const QUIET_AFTER_MS = 5 * 60_000;
export const QUIET_INTERVAL_MS = 10_000;

/**
 * Polls `GET /api/games/[id]/state` (ADR-008) while `enabled`: every
 * `intervalMs`, only while the tab is visible, sending the last `rev` so an
 * unchanged room costs an empty 204. Errors back off to 10 s. It stops for
 * good once the room is finished (nothing changes after that), and slows to
 * every 10 s after five quiet minutes (a projector left on in the lobby).
 */
export function useRoomPoll(
  roomId: string,
  {
    intervalMs,
    enabled = true,
    initial = null,
  }: { intervalMs: number; enabled?: boolean; initial?: RoomState | null },
) {
  const [state, setState] = useState<RoomState | null>(initial);
  const [problem, setProblem] = useState<PollProblem>(null);
  const rev = useRef(initial?.rev ?? -1);
  const failures = useRef(0);
  /** Set by the running poll loop: poll again right now. */
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let changedAt = Date.now();
    const controller = new AbortController();

    const schedule = (ms: number) => {
      clearTimeout(timer);
      if (!stopped && !document.hidden) timer = setTimeout(tick, ms);
    };

    async function tick() {
      try {
        const res = await fetch(
          `/api/games/${roomId}/state?rev=${rev.current}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (res.status === 403) {
          setProblem("removed");
          stopped = true;
          return;
        }
        if (res.status === 200) {
          const body = (await res.json()) as Result<RoomState>;
          if (body.ok) {
            rev.current = body.data.rev;
            changedAt = Date.now();
            setState(body.data);
            // A finished room never changes again.
            if (body.data.status === "finished") stopped = true;
          }
        } else if (res.status !== 204) throw new Error(String(res.status));
        failures.current = 0;
        setProblem(null);
        schedule(
          Date.now() - changedAt > QUIET_AFTER_MS
            ? Math.max(intervalMs, QUIET_INTERVAL_MS)
            : intervalMs,
        );
      } catch {
        if (controller.signal.aborted) return;
        failures.current += 1;
        if (failures.current >= 2) setProblem("offline");
        schedule(Math.min(10_000, intervalMs * 2 ** failures.current));
      }
    }

    const onVisible = () => {
      if (!document.hidden) schedule(0);
      else clearTimeout(timer);
    };
    kick.current = () => schedule(0);
    document.addEventListener("visibilitychange", onVisible);
    schedule(0);
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [roomId, intervalMs, enabled]);

  /** Poll now, e.g. right after a host action. */
  const pollNow = useCallback(() => {
    rev.current = -1;
    kick.current();
  }, []);

  return { state, problem, pollNow };
}

/** Offset between the server clock and this device's, in ms. */
export function clockOffset(serverNow: string): number {
  return Date.parse(serverNow) - Date.now();
}
