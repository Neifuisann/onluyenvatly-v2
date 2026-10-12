"use client";

import { Clock, LoaderCircle, MapPinPlus, MonitorPlay, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import { formatVideoTime, videoTimeOf } from "@/features/lessons/domain/video";
import type { Question } from "@/features/lessons/schema";
import { cn } from "@/lib/utils";
import { videoEditorCopy as t } from "../messages";
import { useYoutube } from "./use-youtube";

/**
 * Where the editor's video is, shared with the question cards' chips
 * without re-rendering the cards themselves.
 */
export type VideoClock = {
  get: () => number;
  set: (seconds: number) => void;
  subscribe: (listener: () => void) => () => void;
  /** Set by the panel once its player is ready. */
  seek: ((seconds: number) => void) | null;
};

export function createVideoClock(): VideoClock {
  let now = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => now,
    set: (seconds) => {
      const whole = Math.floor(seconds);
      if (whole === now) return;
      now = whole;
      for (const l of listeners) l();
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    seek: null,
  };
}

const useClock = (clock: VideoClock) =>
  useSyncExternalStore(clock.subscribe, clock.get, () => 0);

/**
 * The editor's video (content step of a video lesson): the teacher plays it
 * with YouTube's own controls, pauses where a question belongs and attaches
 * the question there. Questions at one time are one stop; the bar shows the
 * stops, and a stop jumps to its first question.
 */
export function VideoEditorPanel({
  youtubeId,
  questions,
  active,
  clock,
  onAttach,
  onSelect,
  onDuration,
}: {
  youtubeId: string;
  questions: readonly Question[];
  /** The question holding the editor's cursor, or -1. */
  active: number;
  clock: VideoClock;
  onAttach: (index: number, seconds: number) => void;
  onSelect: (index: number) => void;
  /** The video's length in whole seconds, once the player knows it. */
  onDuration: (seconds: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const { player, status } = useYoutube(host, {
    videoId: youtubeId,
    controls: true,
  });
  const now = useClock(clock);
  const durationRef = useRef(0);
  const [duration, setDuration] = useState<number | null>(null);
  const reportDuration = useRef(onDuration);
  useEffect(() => {
    reportDuration.current = onDuration;
  });

  useEffect(() => {
    if (status !== "ready") return;
    clock.seek = (s) => {
      player.current?.seekTo(s, true);
      clock.set(s);
    };
    const tick = setInterval(() => {
      const p = player.current;
      if (!p) return;
      clock.set(p.getCurrentTime());
      const d = Math.floor(p.getDuration());
      if (d > 0 && d !== durationRef.current) {
        durationRef.current = d;
        setDuration(d);
        reportDuration.current(d);
      }
    }, 300);
    return () => {
      clearInterval(tick);
      clock.seek = null;
    };
  }, [status, player, clock]);

  const stops = useMemo(() => {
    const byTime = new Map<number, number[]>();
    let atEnd = 0;
    let pastEnd = 0;
    questions.forEach((q, i) => {
      if (q.removed) return;
      const at = videoTimeOf(q, duration);
      if (at === null) {
        atEnd += 1;
        if (q.at !== undefined) pastEnd += 1;
        return;
      }
      byTime.set(at, [...(byTime.get(at) ?? []), i]);
    });
    return {
      times: [...byTime.entries()].sort((a, b) => a[0] - b[0]),
      atEnd,
      pastEnd,
    };
  }, [questions, duration]);
  const pct = (s: number) =>
    duration ? `${Math.min(100, (s / duration) * 100)}%` : "0%";

  return (
    <section
      aria-labelledby="video-panel-title"
      className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface p-3 shadow-card sm:p-4 dark:border-border"
    >
      <div className="flex items-center gap-2">
        <MonitorPlay aria-hidden className="size-5 text-primary" />
        <h2 id="video-panel-title" className="font-semibold">
          {t.title}
        </h2>
      </div>
      <p className="text-muted-foreground text-sm">{t.lead}</p>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        <div
          ref={host}
          className="absolute inset-0 [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:size-full"
        />
        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 p-4 text-center text-sm text-white">
            {status === "loading" ? (
              <LoaderCircle aria-hidden className="size-5 animate-spin" />
            ) : (
              t.error
            )}
          </div>
        )}
      </div>

      {/* The stops along the video. */}
      <div className="relative h-7" aria-hidden={!duration}>
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
        <div
          className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-primary/50"
          style={{ width: pct(now) }}
        />
        {duration !== null &&
          stops.times.map(([at, indexes]) => (
            <button
              key={at}
              type="button"
              onClick={() => {
                clock.seek?.(at);
                const first = indexes[0];
                if (first !== undefined) onSelect(first);
              }}
              title={t.stopTitle(
                formatVideoTime(at),
                indexes.map((i) => i + 1),
              )}
              aria-label={t.seekTo(formatVideoTime(at))}
              className={cn(
                "-translate-x-1/2 absolute top-1/2 flex h-6 min-w-6 -translate-y-1/2 items-center justify-center rounded-full bg-accent px-1.5 font-bold text-[0.6875rem] text-accent-foreground shadow-card ring-2 ring-surface",
                indexes.includes(active) && "ring-primary",
              )}
              style={{ left: pct(at) }}
            >
              {indexes.length}
            </button>
          ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="num inline-flex items-center gap-1 font-semibold tabular-nums">
          <Clock aria-hidden className="size-4 text-muted-foreground" />
          {t.current(formatVideoTime(now))}
        </span>
        {duration && (
          <span className="text-muted-foreground">
            {t.length(formatVideoTime(duration))}
          </span>
        )}
        <span className="text-muted-foreground">
          {t.cues(stops.times.length)}
        </span>
        {stops.atEnd > 0 && (
          <span className="text-muted-foreground">{t.atEnd(stops.atEnd)}</span>
        )}
        <span className="flex-1" />
        <Button
          type="button"
          size="sm"
          disabled={active < 0 || status !== "ready"}
          onClick={() => onAttach(active, clock.get())}
        >
          <MapPinPlus aria-hidden />
          {active < 0
            ? t.attach(formatVideoTime(now))
            : t.attachQuestion(active + 1, formatVideoTime(now))}
        </Button>
      </div>
      {stops.pastEnd > 0 && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-accent-text text-sm">
          {t.pastEnd(stops.pastEnd)}
        </p>
      )}
    </section>
  );
}

/**
 * Under each question card: when it is asked (a tap jumps the video
 * there), "Gắn vào m:ss" for the video's current time, and "Bỏ mốc".
 */
export function VideoTimeChip({
  question,
  clock,
  onAttach,
  onDetach,
}: {
  question: Question;
  clock: VideoClock;
  onAttach: (seconds: number) => void;
  onDetach: () => void;
}) {
  const now = useClock(clock);
  const at = question.at;
  return (
    <div className="flex flex-wrap items-center gap-2 border-border/70 border-t pt-3 text-sm dark:border-border">
      {at === undefined ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
          <MonitorPlay aria-hidden className="size-3.5" />
          {t.atEndChip}
        </span>
      ) : (
        <span className="inline-flex items-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary text-xs">
          <button
            type="button"
            onClick={() => clock.seek?.(at)}
            title={t.seekTo(formatVideoTime(at))}
            className="inline-flex items-center gap-1 py-1 pr-1.5 pl-2.5 hover:bg-primary/15"
          >
            <MonitorPlay aria-hidden className="size-3.5" />
            {t.at(formatVideoTime(at))}
          </button>
          <button
            type="button"
            onClick={onDetach}
            aria-label={t.detach}
            title={t.detach}
            className="py-1 pr-2 pl-1 hover:bg-primary/15"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </span>
      )}
      <button
        type="button"
        onClick={() => onAttach(clock.get())}
        disabled={at === now}
        className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-semibold text-primary hover:bg-primary-soft disabled:opacity-50"
      >
        <MapPinPlus aria-hidden className="size-4" />
        {t.attach(formatVideoTime(now))}
      </button>
    </div>
  );
}
