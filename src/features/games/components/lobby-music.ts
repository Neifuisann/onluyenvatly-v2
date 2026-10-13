"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The lobby's music (B-15): a short loop synthesized with WebAudio (no file
 * to download on a phone), a soft arpeggio over a bass line, plus a beep
 * for the last seconds of a countdown. Browsers play audio only after a
 * tap: the loop starts on the first one, or at once when the page already
 * had one (the "Vào phòng" tap carries over a client navigation). The
 * choice to mute is remembered per browser.
 */

const OFF_KEY = "games:lobby-music-off";
const BPM = 112;
const STEP_S = 60 / BPM / 2;
const LOOKAHEAD_S = 0.3;
const MASTER_GAIN = 0.11;

/** C – Am – F – G, two bars each as eight eighths: root, third, fifth… */
const CHORDS = [
  [60, 64, 67, 72],
  [57, 60, 64, 69],
  [53, 57, 60, 65],
  [55, 59, 62, 67],
] as const;
const ARP = [0, 1, 2, 3, 2, 1, 2, 1] as const;
const STEPS = CHORDS.length * 2 * ARP.length;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function note(
  ctx: AudioContext,
  out: AudioNode,
  midi: number,
  at: number,
  length: number,
  type: OscillatorType,
  level: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = hz(midi);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

function readOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
}

function writeOff(off: boolean) {
  try {
    localStorage.setItem(OFF_KEY, off ? "1" : "0");
  } catch {
    // Private mode: the choice lasts this page only.
  }
}

/**
 * The loop while `active` and not muted. Returns the switch and `beep`,
 * which plays a countdown tick (higher for the last one) when sound is on.
 */
export function useLobbyMusic(active: boolean) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const ctx = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  const playing = useRef(false);

  useEffect(() => {
    setOn(!readOff());
    setReady(true);
  }, []);

  const audio = useCallback(() => {
    if (typeof window === "undefined" || !("AudioContext" in window))
      return null;
    if (!ctx.current) {
      ctx.current = new AudioContext();
      master.current = ctx.current.createGain();
      master.current.gain.value = MASTER_GAIN;
      master.current.connect(ctx.current.destination);
    }
    if (ctx.current.state === "suspended") void ctx.current.resume();
    return ctx.current;
  }, []);

  const wanted = ready && on && active;
  useEffect(() => {
    if (!wanted) return;
    let step = 0;
    let next = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const schedule = () => {
      const a = ctx.current;
      const out = master.current;
      if (!a || !out || a.state !== "running" || document.hidden) return;
      if (next < a.currentTime) next = a.currentTime + 0.05;
      while (next < a.currentTime + LOOKAHEAD_S) {
        const chord = CHORDS[Math.floor(step / 16) % CHORDS.length] ?? [];
        const tone = chord[ARP[step % ARP.length] ?? 0] ?? 60;
        note(a, out, tone + 12, next, STEP_S * 0.9, "triangle", 0.5);
        if (step % 4 === 0)
          note(a, out, (chord[0] ?? 60) - 12, next, STEP_S * 3.6, "sine", 0.9);
        next += STEP_S;
        step = (step + 1) % STEPS;
      }
    };
    const kick = () => {
      if (!audio()) return;
      playing.current = true;
      schedule();
    };
    kick();
    timer = setInterval(schedule, 100);
    // Blocked until a tap: any tap starts it.
    window.addEventListener("pointerdown", kick);
    window.addEventListener("keydown", kick);
    return () => {
      clearInterval(timer);
      playing.current = false;
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
  }, [wanted, audio]);

  // Leaving the lobby: let the notes already queued ring out, then close.
  useEffect(
    () => () => {
      const a = ctx.current;
      ctx.current = null;
      if (a) setTimeout(() => void a.close(), 600);
    },
    [],
  );

  const toggle = useCallback(() => {
    setOn((was) => {
      writeOff(was);
      if (!was) audio();
      return !was;
    });
  }, [audio]);

  const beep = useCallback(
    (last: boolean) => {
      if (!on || !ctx.current || !master.current) return;
      const a = ctx.current;
      note(
        a,
        master.current,
        last ? 84 : 76,
        a.currentTime,
        0.25,
        "square",
        0.6,
      );
    },
    [on],
  );

  return { on, toggle, beep };
}
