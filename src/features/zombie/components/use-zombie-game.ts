"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ZombieState } from "@/db/schema";
import type { ZombieRoomInfo } from "@/features/games/types";
import type { Result } from "@/lib/result";
import { AFTERMATH_MS, laneForKey } from "../domain/view";
import type { GameMove } from "../schemas";
import type { GameView } from "../service";
import { play, readMuted, type Sound, setMusic, writeMuted } from "./sfx";

/** How long the ink takes to reach a zombie. */
export const FLIGHT_MS = 220;

export type Fx =
  | { id: number; kind: "shot"; wave: number; lane: number }
  | { id: number; kind: "hit"; wave: number; lane: number }
  | { id: number; kind: "miss"; wave: number; lane: number; ended: boolean }
  | { id: number; kind: "timeout"; wave: number };

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
type FxInput = WithoutId<Fx>;

export type HeroPoseState = "idle" | "aim" | "shoot" | "hurt" | "win" | "lose";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * What a move answers: the solo game's `GameView` (B-11), or a zombie
 * room's, which adds where the player stands in the room (B-14).
 */
export type MoveView = Pick<GameView, "state" | "event" | "now" | "result"> & {
  room?: ZombieRoomInfo;
};

/**
 * The game screen's state (B-11). The server owns the rules and the clock;
 * this hook sends moves, plays the effects in order, keeps the old wave on
 * screen while its hit or miss plays out, and sends the timeout when the
 * zombies reach the barricade. `endpoint` takes the moves: an attempt's
 * (B-11) or a room's (B-14); `onClosed` handles a refusal that means the
 * game is over elsewhere (submitted, the room ended) and returns true.
 */
export function useZombieGame({
  endpoint,
  initial,
  serverNow,
  initialRoom,
  onClosed,
}: {
  endpoint: string;
  initial: ZombieState;
  serverNow: number;
  initialRoom?: ZombieRoomInfo | undefined;
  onClosed: (code: string) => boolean;
}) {
  const [game, setGame] = useState(initial);
  const [room, setRoom] = useState(initialRoom);
  const [shown, setShown] = useState(initial.wave);
  const [fx, setFx] = useState<Fx | null>(null);
  const [pending, setPending] = useState(false);
  const [aim, setAim] = useState<number | null>(null);
  const [pose, setPose] = useState<HeroPoseState>("idle");
  const [ended, setEnded] = useState(initial.over !== null);
  const [result, setResult] = useState<GameView["result"]>();
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  // False until the saved mute choice is read: no music before that.
  const [soundReady, setSoundReady] = useState(false);
  const [announce, setAnnounce] = useState("");
  const offset = useRef(serverNow - Date.now());
  const fxId = useRef(0);
  const timeoutSent = useRef(-1);
  const busy = useRef(false);
  /** Over elsewhere (`onClosed`): nothing more is sent. */
  const closed = useRef(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    const m = readMuted();
    setMuted(m);
    setSoundReady(true);
    mutedRef.current = m;
  }, []);

  const now = useCallback(() => Date.now() + offset.current, []);
  const sound = useCallback((s: Sound) => play(s, mutedRef.current), []);
  const toggleMute = useCallback(() => {
    setMuted((m) => {
      writeMuted(!m);
      mutedRef.current = !m;
      return !m;
    });
  }, []);
  const nextFx = useCallback((f: FxInput) => {
    fxId.current += 1;
    setFx({ ...f, id: fxId.current } as Fx);
  }, []);

  /** POSTs a move; network errors retry (moves are idempotent). */
  const send = useCallback(
    async (move: GameMove): Promise<Result<MoveView> | null> => {
      for (let attempt = 0; attempt < 4; attempt++) {
        if (closed.current) return null;
        try {
          const sentAt = Date.now();
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(move),
          });
          const body = (await res.json()) as Result<MoveView>;
          if (body.ok) {
            // Half the round trip is a fair guess of the one-way delay.
            offset.current =
              body.data.now - (sentAt + (Date.now() - sentAt) / 2);
            if (body.data.room) setRoom(body.data.room);
            setError(null);
          } else if (onClosed(body.code)) {
            closed.current = true;
            return null;
          }
          return body;
        } catch {
          setError("offline");
          await wait(600 * (attempt + 1));
        }
      }
      return null;
    },
    [endpoint, onClosed],
  );

  /** Plays an event on the wave it happened in, then moves on. */
  const apply = useCallback(
    (view: MoveView, wave: number) => {
      const { state, event } = view;
      setGame(state);
      if (view.result) setResult(view.result);
      if (!event || event.kind === "stale") {
        setShown(state.over ? wave : state.wave);
        if (state.over) setEnded(true);
        return;
      }
      if (event.kind === "hit") {
        nextFx({ kind: "hit", wave, lane: event.key });
        sound("hit");
        setPose("idle");
        setAnnounce("Trúng!");
      } else if (event.kind === "miss") {
        nextFx({ kind: "miss", wave, lane: event.lane, ended: event.ended });
        sound("miss");
        setPose("hurt");
        setTimeout(() => setPose((p) => (p === "hurt" ? "idle" : p)), 650);
        setAnnounce(
          `Trượt, còn ${Math.max(0, state.lives - state.misses)} mạng.`,
        );
      } else {
        nextFx({ kind: "timeout", wave });
        sound("timeout");
        setPose("hurt");
        setTimeout(() => setPose((p) => (p === "hurt" ? "idle" : p)), 650);
        setAnnounce(
          `Zombie chạm rào, còn ${Math.max(0, state.lives - state.misses)} mạng.`,
        );
      }
      // The wave is over: let its hit or miss play out, then move on.
      if (state.wave === wave && state.over === null) return;
      setTimeout(() => {
        if (state.over) {
          setEnded(true);
          setPose(state.over === "won" ? "win" : "lose");
          sound(state.over === "won" ? "win" : "lose");
        } else setShown(state.wave);
        setAim(null);
      }, AFTERMATH_MS);
    },
    [nextFx, sound],
  );

  const begin = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    sound("tick");
    // Inside the tap: iOS plays media only from a gesture.
    setMusic(!mutedRef.current);
    const r = await send({ kind: "begin" });
    if (r?.ok) {
      setGame(r.data.state);
      setShown(r.data.state.wave);
    } else {
      if (!closed.current) setError("failed");
      setMusic(false);
    }
    setPending(false);
    busy.current = false;
  }, [send, sound]);

  const playable = !ended && game.at !== null && shown === game.wave;

  // Music from "Bắt đầu" until the end screen (its jingle plays alone);
  // paused while the tab is hidden. Any tap retries a play the browser
  // blocked (a reload mid-game has had no gesture yet).
  const musicWanted = soundReady && !muted && !ended && game.at !== null;
  useEffect(() => {
    const sync = () => setMusic(musicWanted && !document.hidden);
    sync();
    window.addEventListener("pointerdown", sync);
    window.addEventListener("keydown", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("pointerdown", sync);
      window.removeEventListener("keydown", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [musicWanted]);
  useEffect(() => () => setMusic(false), []);

  const fire = useCallback(
    async (lane: number) => {
      const w = game.waves[shown];
      if (busy.current || !playable || !w || w.s.includes(lane)) return;
      if (now() < (game.at ?? 0) - 300) return;
      busy.current = true;
      setPending(true);
      setAim(lane);
      setPose("shoot");
      sound("shoot");
      nextFx({ kind: "shot", wave: shown, lane });
      const started = Date.now();
      const r = await send({ kind: "shoot", wave: shown, lane });
      await wait(Math.max(0, FLIGHT_MS - (Date.now() - started)));
      setPose((p) => (p === "shoot" ? "aim" : p));
      if (r?.ok) apply(r.data, shown);
      else if (r) setError("failed");
      setPending(false);
      busy.current = false;
    },
    [apply, game, now, nextFx, playable, send, shown, sound],
  );

  // The zombies reached the barricade: tell the server once per wave.
  useEffect(() => {
    if (!playable || game.sec === null || game.at === null) return;
    const due = game.at + game.sec * 1000 - now();
    const wave = game.wave;
    const id = setTimeout(
      async function tick() {
        if (timeoutSent.current === wave || closed.current) return;
        if (busy.current) {
          setTimeout(tick, 150);
          return;
        }
        busy.current = true;
        timeoutSent.current = wave;
        const r = await send({ kind: "timeout", wave });
        busy.current = false;
        if (r?.ok) apply(r.data, wave);
        else {
          // Our clock ran a little fast: try again shortly.
          timeoutSent.current = -1;
          setTimeout(tick, 400);
        }
      },
      Math.max(0, due),
    );
    return () => clearTimeout(id);
  }, [apply, game.at, game.sec, game.wave, now, playable, send]);

  // Keyboard: letters and digits shoot, Đ/S for a statement.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("[role=dialog]"))
        return;
      const w = game.waves[shown];
      const lane = w ? laneForKey(w, e.key) : null;
      if (lane === null) return;
      e.preventDefault();
      void fire(lane);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fire, game.waves, shown]);

  return {
    game,
    room,
    shown,
    fx,
    pending,
    aim,
    pose,
    ended,
    result,
    error,
    muted,
    announce,
    playable,
    now,
    begin,
    fire,
    toggleMute,
    sound,
  };
}
