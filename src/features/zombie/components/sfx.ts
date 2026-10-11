/**
 * The game's sounds (B-11), synthesized with WebAudio: nothing to download.
 * Muted by the HUD toggle (remembered per browser). Browsers allow audio
 * only after a tap, so the context starts on the first "Bắt đầu" or shot.
 */
export type Sound =
  | "shoot"
  | "hit"
  | "miss"
  | "timeout"
  | "tick"
  | "go"
  | "win"
  | "lose";

const MUTE_KEY = "zombie:muted";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Private mode: the toggle still works for this visit.
  }
}

function tone(
  a: AudioContext,
  {
    type = "square",
    from,
    to = from,
    at = 0,
    dur,
    gain = 0.18,
  }: {
    type?: OscillatorType;
    from: number;
    to?: number;
    at?: number;
    dur: number;
    gain?: number;
  },
) {
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(a: AudioContext, { at = 0, dur = 0.12, gain = 0.25 } = {}) {
  const t = a.currentTime + at;
  const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const g = a.createGain();
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  src.buffer = buffer;
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(a.destination);
  src.start(t);
}

export function play(sound: Sound, muted: boolean) {
  if (muted) return;
  const a = audio();
  if (!a) return;
  switch (sound) {
    case "shoot":
      noise(a, { dur: 0.09, gain: 0.3 });
      tone(a, { type: "triangle", from: 620, to: 180, dur: 0.12, gain: 0.2 });
      return;
    case "hit":
      tone(a, { type: "square", from: 160, to: 60, dur: 0.18, gain: 0.25 });
      tone(a, { type: "triangle", from: 880, at: 0.08, dur: 0.12 });
      tone(a, { type: "triangle", from: 1320, at: 0.16, dur: 0.2 });
      return;
    case "miss":
      tone(a, { type: "sawtooth", from: 220, to: 110, dur: 0.32, gain: 0.16 });
      tone(a, { type: "sawtooth", from: 233, to: 104, dur: 0.32, gain: 0.1 });
      return;
    case "timeout":
      noise(a, { dur: 0.35, gain: 0.35 });
      tone(a, { type: "square", from: 140, to: 50, dur: 0.4, gain: 0.2 });
      return;
    case "tick":
      tone(a, { type: "square", from: 660, dur: 0.07, gain: 0.12 });
      return;
    case "go":
      tone(a, { type: "square", from: 990, dur: 0.18, gain: 0.16 });
      return;
    case "win":
      [523, 659, 784, 1046].forEach((f, i) => {
        tone(a, { type: "square", from: f, at: i * 0.12, dur: 0.22 });
      });
      return;
    case "lose":
      [392, 330, 262, 196].forEach((f, i) => {
        tone(a, { type: "triangle", from: f, at: i * 0.18, dur: 0.3 });
      });
      return;
  }
}
