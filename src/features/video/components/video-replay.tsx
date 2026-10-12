"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { seekTarget } from "../domain/engine";
import { videoCopy as t } from "../messages";
import { type Marker, PlayerControls } from "./player-controls";
import { useFullscreen } from "./use-fullscreen";
import { useYoutube, YT_STATE } from "./use-youtube";

/**
 * The video again on the result page: the lesson is done, so seeking is
 * free. Same controls (no speed menu), the questions' times marked.
 */
export function VideoReplay({
  youtubeId,
  markers,
}: {
  youtubeId: string;
  markers: Marker[];
}) {
  const stage = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(stage);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);
  const { player, status } = useYoutube(host, {
    videoId: youtubeId,
    onStateChange: (s) => {
      setPlaying(s === YT_STATE.PLAYING);
      if (s === YT_STATE.PLAYING) setStarted(true);
    },
  });

  useEffect(() => {
    if (status !== "ready") return;
    const tick = setInterval(() => {
      const p = player.current;
      if (!p) return;
      const d = p.getDuration();
      if (d > 0) setDuration(d);
      if (p.getPlaybackRate() !== 1) p.setPlaybackRate(1);
      setTime(p.getCurrentTime());
    }, 500);
    return () => clearInterval(tick);
  }, [status, player]);

  const togglePlay = () => {
    const p = player.current;
    if (!p) return;
    if (p.getPlayerState() === YT_STATE.PLAYING) p.pauseVideo();
    else p.playVideo();
  };

  return (
    <div
      ref={stage}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl bg-black shadow-card",
        fullscreen.active && "h-dvh w-full rounded-none",
        fullscreen.pseudo && "fixed inset-0 z-50",
      )}
    >
      <div
        className={cn(
          "relative w-full",
          fullscreen.active ? "min-h-0 flex-1" : "aspect-video",
        )}
      >
        <div
          ref={host}
          className="absolute inset-0 [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:size-full"
        />
        {started && (
          <div
            aria-hidden
            onClick={togglePlay}
            className="absolute inset-0 cursor-pointer"
          />
        )}
        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 p-4 text-center text-sm text-white">
            {status === "loading" ? (
              <>
                <LoaderCircle aria-hidden className="size-5 animate-spin" />
                {t.loading}
              </>
            ) : (
              t.error
            )}
          </div>
        )}
      </div>
      <PlayerControls
        playing={playing}
        time={time}
        duration={duration}
        max={duration}
        seek
        markers={markers}
        disabled={status !== "ready"}
        muted={muted}
        fullscreen={fullscreen.active}
        onTogglePlay={togglePlay}
        onSeek={(target) => {
          const to = seekTarget(target, {
            max: duration,
            seek: true,
            duration,
          });
          player.current?.seekTo(to, true);
          setTime(to);
        }}
        onToggleMute={() => {
          const p = player.current;
          if (!p) return;
          if (p.isMuted()) p.unMute();
          else p.mute();
          setMuted(!muted);
        }}
        onToggleFullscreen={fullscreen.toggle}
      />
    </div>
  );
}
