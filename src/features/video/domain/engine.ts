/**
 * The rules of a video lesson attempt ("Học qua video"). Pure: the server
 * applies them to the stored state, the player applies the playback ones to
 * what the YouTube player reports.
 *
 * Questions are asked at cues along the video, in order. An answered cue is
 * locked. Without `seek` the student can't get ahead of the furthest point
 * reached, and the server checks the wall clock too: the video plays at
 * normal speed only, so a cue at 5:00 can't be answered before 5 minutes
 * have passed since the start.
 */
import type {
  AttemptAnswer,
  VideoCue,
  VideoState,
} from "../../../db/schema.ts";
import type { QuestionType } from "../../lessons/schema.ts";

/** Wall-clock slack for the server's checks (clock skew, buffering). */
export const CLOCK_SLACK_SEC = 5;
/** The player may land a little past the furthest point; more is a skip. */
export const SKIP_TOLERANCE_SEC = 1.5;

/**
 * Cues from the items' ask times, in item order (already video order):
 * consecutive items with the same time are one cue.
 */
export function buildCues(times: readonly (number | null)[]): VideoCue[] {
  const cues: VideoCue[] = [];
  for (const at of times) {
    const last = cues.at(-1);
    if (last && last.at === at) last.n += 1;
    else cues.push({ at, n: 1 });
  }
  return cues;
}

export function initialVideoState(cues: VideoCue[], seek: boolean): VideoState {
  return { cues, done: 0, seek, pos: 0, max: 0 };
}

/** Item indexes `[from, to)` of cue `k`. */
export function cueItems(
  cues: readonly VideoCue[],
  k: number,
): { from: number; to: number } {
  const from = cues.slice(0, k).reduce((s, c) => s + c.n, 0);
  return { from, to: from + (cues[k]?.n ?? 0) };
}

/** Item index → its cue. -1 when out of range. */
export function cueOfItem(cues: readonly VideoCue[], item: number): number {
  let end = 0;
  for (const [k, c] of cues.entries()) {
    end += c.n;
    if (item < end) return k;
  }
  return -1;
}

/** The next cue to ask, or null when every cue is answered. */
export const nextCue = (s: Pick<VideoState, "cues" | "done">) =>
  s.cues[s.done] ?? null;

/** Has the student watched long enough to have reached `at`? */
function reached(s: VideoState, at: number, elapsedSec: number) {
  return s.seek || elapsedSec + CLOCK_SLACK_SEC >= at;
}

export type AnswerCheck =
  | { ok: true; state: VideoState }
  | { ok: false; code: "ANSWERED" | "ORDER" | "TOO_EARLY" };

/**
 * Answering cue `k`: only the next one, and only once the video could have
 * got there. A cue at the end needs the whole video (when its length is
 * known). `ANSWERED` lets a retried request read as done.
 */
export function answerCue(
  s: VideoState,
  k: number,
  elapsedSec: number,
  durationSec: number | null,
): AnswerCheck {
  if (k < s.done) return { ok: false, code: "ANSWERED" };
  const cue = s.cues[k];
  if (k !== s.done || !cue) return { ok: false, code: "ORDER" };
  const at = cue.at ?? durationSec;
  if (at !== null && !reached(s, at, elapsedSec))
    return { ok: false, code: "TOO_EARLY" };
  const pos = Math.max(s.pos, cue.at ?? s.pos);
  return {
    ok: true,
    state: { ...s, done: k + 1, pos, max: Math.max(s.max, pos) },
  };
}

/**
 * Ending the attempt when the video ends: every cue answered, and (when
 * the length is known) the whole video watched.
 */
export function canFinish(
  s: VideoState,
  elapsedSec: number,
  durationSec: number | null,
): { ok: true } | { ok: false; code: "UNANSWERED" | "TOO_EARLY" } {
  if (s.done < s.cues.length) return { ok: false, code: "UNANSWERED" };
  if (durationSec !== null && !reached(s, durationSec, elapsedSec))
    return { ok: false, code: "TOO_EARLY" };
  return { ok: true };
}

/**
 * A reported position (autosave): kept within what the wall clock allows
 * without `seek`, and the furthest point only grows.
 */
export function progressTo(
  s: VideoState,
  pos: number,
  elapsedSec: number,
): Pick<VideoState, "pos" | "max"> {
  const bound = s.seek ? pos : Math.min(pos, elapsedSec + CLOCK_SLACK_SEC);
  const next = Math.max(0, Math.round(bound * 10) / 10);
  return { pos: next, max: Math.max(s.max, next) };
}

export type PlaybackCheck =
  /** Keep playing; `max` is the new furthest point. */
  | { kind: "play"; max: number }
  /** A skip past the furthest point: go back there. */
  | { kind: "rewind"; to: number }
  /** The next cue is due: pause there and ask. */
  | { kind: "cue"; at: number };

/**
 * One tick of the player (a few times a second): the next cue stops the
 * video wherever the time came from (playing or seeking past it); without
 * `seek`, a jump beyond the furthest point is undone.
 */
export function checkPlayback(
  t: number,
  view: { max: number; seek: boolean; cueAt: number | null },
): PlaybackCheck {
  if (view.cueAt !== null && t >= view.cueAt)
    return { kind: "cue", at: view.cueAt };
  if (!view.seek && t > view.max + SKIP_TOLERANCE_SEC)
    return { kind: "rewind", to: view.max };
  return { kind: "play", max: Math.max(view.max, t) };
}

/**
 * A cue is left only once each of its questions has a full answer: an mcq
 * letter, short text, or every tf statement. Shape only; never graded here.
 */
export function isComplete(
  answer: AttemptAnswer | undefined,
  q: { type: QuestionType; statements: number },
): boolean {
  if (q.type === "tf")
    return (
      Array.isArray(answer) &&
      answer.length === q.statements &&
      answer.every((v) => v !== null)
    );
  return typeof answer === "string" && answer.trim() !== "";
}

/** Where a click on the progress bar may go: not past the furthest point without `seek`. */
export function seekTarget(
  target: number,
  view: { max: number; seek: boolean; duration: number },
): number {
  const end = Math.max(0, view.duration);
  const t = Math.min(Math.max(0, target), end || target);
  return view.seek ? t : Math.min(t, view.max);
}
