"use client";

import {
  Lock,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRef } from "react";
import { formatVideoTime } from "@/features/lessons/domain/video";
import { cn } from "@/lib/utils";
import { videoCopy as t } from "../messages";

export type Marker = { at: number; done: boolean };

/** Arrow keys on the progress bar move this many seconds. */
const STEP_SEC = 5;

const iconButton =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40 disabled:hover:bg-transparent";

/**
 * Our controls under the video (YouTube's own are off): play, time, a
 * progress bar that seeks only where `onSeek` allows, question markers,
 * sound and full screen. No speed control: the video plays at 1×.
 */
export function PlayerControls({
  playing,
  time,
  duration,
  max,
  seek,
  markers,
  disabled,
  muted,
  fullscreen,
  onTogglePlay,
  onSeek,
  onToggleMute,
  onToggleFullscreen,
}: {
  playing: boolean;
  time: number;
  duration: number;
  /** The furthest point reached; beyond it is locked without `seek`. */
  max: number;
  seek: boolean;
  markers: readonly Marker[];
  /** A question is open, or the video can't play. */
  disabled: boolean;
  muted: boolean;
  fullscreen: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const known = duration > 0;
  const pct = (s: number) =>
    known ? `${Math.min(100, Math.max(0, (s / duration) * 100))}%` : "0%";

  const seekFromPointer = (clientX: number) => {
    const box = bar.current?.getBoundingClientRect();
    if (!box || !known || disabled) return;
    const f = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    onSeek(f * duration);
  };

  return (
    <div className="flex flex-col gap-1 bg-black px-2 pt-2 pb-1.5 text-white sm:px-3">
      <div
        ref={bar}
        role="slider"
        tabIndex={disabled || !known ? -1 : 0}
        aria-label={t.progress}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={t.progressText(
          formatVideoTime(time),
          formatVideoTime(duration),
        )}
        aria-disabled={disabled || !known}
        title={seek ? undefined : t.noSkip}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            seekFromPointer(e.clientX);
        }}
        onKeyDown={(e) => {
          if (disabled || !known) return;
          const delta =
            e.key === "ArrowRight"
              ? STEP_SEC
              : e.key === "ArrowLeft"
                ? -STEP_SEC
                : 0;
          if (e.key === "Home") onSeek(0);
          else if (delta) onSeek(time + delta);
          else return;
          e.preventDefault();
        }}
        className={cn(
          "group relative flex h-6 cursor-pointer touch-none items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white",
          (disabled || !known) && "cursor-default",
        )}
      >
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/20">
          {!seek && (
            <div
              className="absolute inset-y-0 left-0 bg-white/35"
              style={{ width: pct(max) }}
            />
          )}
          <div
            className="absolute inset-y-0 left-0 bg-primary"
            style={{ width: pct(time) }}
          />
        </div>
        {markers.map((m) => (
          <span
            key={m.at}
            aria-hidden
            title={t.cueMarker(formatVideoTime(m.at), m.done)}
            className={cn(
              "-translate-x-1/2 pointer-events-none absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full ring-2 ring-black",
              m.done ? "bg-white/70" : "bg-accent",
            )}
            style={{ left: pct(m.at) }}
          />
        ))}
        <span
          aria-hidden
          className="-translate-x-1/2 pointer-events-none absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          style={{ left: pct(time) }}
        />
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={disabled}
          aria-label={playing ? t.pause : t.play}
          title={playing ? t.pause : t.play}
          className={iconButton}
        >
          {playing ? (
            <Pause aria-hidden className="size-5 fill-current" />
          ) : (
            <Play aria-hidden className="size-5 fill-current" />
          )}
        </button>
        <span className="num px-1 text-sm tabular-nums">
          {formatVideoTime(time)}
          <span className="text-white/60">
            {" "}
            / {known ? formatVideoTime(duration) : "–:––"}
          </span>
        </span>
        {!seek && (
          <span
            title={t.noSkip}
            className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-white/80 text-xs max-[400px]:sr-only"
          >
            <Lock aria-hidden className="size-3" />
            {t.noSkipShort}
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? t.unmute : t.mute}
          title={muted ? t.unmute : t.mute}
          aria-pressed={muted}
          className={iconButton}
        >
          {muted ? (
            <VolumeX aria-hidden className="size-5" />
          ) : (
            <Volume2 aria-hidden className="size-5" />
          )}
        </button>
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}
          title={fullscreen ? t.exitFullscreen : t.fullscreen}
          className={iconButton}
        >
          {fullscreen ? (
            <Minimize aria-hidden className="size-5" />
          ) : (
            <Maximize aria-hidden className="size-5" />
          )}
        </button>
      </div>
    </div>
  );
}
