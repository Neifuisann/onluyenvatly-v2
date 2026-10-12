"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * The YouTube IFrame Player API (https://developers.google.com/youtube/iframe_api_reference),
 * loaded once per page from youtube.com (allowed by the CSP, `lib/security-headers.ts`).
 * Only the calls we use are typed.
 */
export type YtPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
};

type YtEvent<T = unknown> = { target: YtPlayer; data: T };
type YtNamespace = {
  Player: new (
    el: HTMLElement,
    options: {
      host: string;
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (e: YtEvent) => void;
        onStateChange: (e: YtEvent<number>) => void;
        onPlaybackRateChange: (e: YtEvent<number>) => void;
        onError: (e: YtEvent<number>) => void;
      };
    },
  ) => YtPlayer;
};

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** `YT.PlayerState`. */
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

let loading: Promise<YtNamespace> | null = null;

function loadApi(): Promise<YtNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise<YtNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("YouTube API unavailable"));
    };
    document.head.append(script);
  });
  return loading;
}

export type YoutubeStatus = "loading" | "ready" | "error";

export type YoutubeOptions = {
  videoId: string;
  /** Whole seconds to start at (resume). */
  start?: number;
  /**
   * YouTube's own controls. Off for students: our controls decide seeking,
   * and its keyboard shortcuts and speed menu go with them.
   */
  controls?: boolean;
  onStateChange?: (state: number) => void;
};

/**
 * Mounts a privacy-enhanced (youtube-nocookie) player in `container`. The
 * player lives in a node React doesn't manage, so re-renders never touch
 * the iframe. The speed is held at 1×.
 */
export function useYoutube(
  container: RefObject<HTMLDivElement | null>,
  { videoId, start = 0, controls = false, onStateChange }: YoutubeOptions,
) {
  const player = useRef<YtPlayer | null>(null);
  const [status, setStatus] = useState<YoutubeStatus>("loading");
  /** YouTube's error code (2, 5, 100, 101, 150) when it can't play. */
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const onState = useRef(onStateChange);
  useEffect(() => {
    onState.current = onStateChange;
  });
  // The first start only: a later one would recreate the player.
  const startAt = useRef(start);

  useEffect(() => {
    const box = container.current;
    if (!box) return;
    let cancelled = false;
    let created: YtPlayer | null = null;
    setStatus("loading");
    setErrorCode(null);
    loadApi()
      .then((YT) => {
        if (cancelled) return;
        const el = document.createElement("div");
        box.replaceChildren(el);
        created = new YT.Player(el, {
          host: "https://www.youtube-nocookie.com",
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: controls ? 1 : 0,
            disablekb: controls ? 0 : 1,
            fs: 0,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            cc_load_policy: 0,
            start: Math.max(0, Math.floor(startAt.current)),
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              player.current = e.target;
              setStatus("ready");
            },
            onStateChange: (e) => onState.current?.(e.data),
            onPlaybackRateChange: (e) => {
              if (e.data !== 1) e.target.setPlaybackRate(1);
            },
            onError: (e) => {
              setErrorCode(e.data);
              setStatus("error");
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      player.current = null;
      created?.destroy();
      box.replaceChildren();
    };
  }, [container, videoId, controls]);

  return { player, status, errorCode };
}
