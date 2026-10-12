"use client";

import { ArrowLeft, ArrowRight, LoaderCircle, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { VideoState } from "@/db/schema";
import {
  PreviewProvider,
  type RunnerPreview,
  usePreview,
} from "@/features/attempts/components/runner/preview";
import { QuestionCard } from "@/features/attempts/components/runner/question-card";
import {
  RunnerProvider,
  useRunner,
  useRunnerApi,
} from "@/features/attempts/components/runner/store";
import type { RunnerQuestion } from "@/features/attempts/components/runner/types";
import {
  type RunnerAnswers,
  restoreAnswers,
} from "@/features/attempts/domain/runner-state";
import { summarize } from "@/features/grading/domain/grade";
import { formatVideoTime } from "@/features/lessons/domain/video";
import { formatScore } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  answerCue,
  checkPlayback,
  cueItems,
  isComplete,
  nextCue,
  seekTarget,
} from "../domain/engine";
import { videoCopy as t } from "../messages";
import type { VideoMove } from "../schemas";
import type { VideoView } from "../service";
import { PlayerControls } from "./player-controls";
import { useFullscreen } from "./use-fullscreen";
import { useYoutube, YT_STATE } from "./use-youtube";

/** How often the player is checked: cues, skips, speed. */
const TICK_MS = 250;
/** How often the position is saved while playing (resume after a reload). */
const SAVE_EVERY_MS = 20_000;

export type VideoLessonProps = {
  attemptId: string;
  lessonId: number | null;
  title: string;
  youtubeId: string;
  /** Pre-rendered, answer-free, in item (video) order. */
  questions: RunnerQuestion[];
  saved: RunnerAnswers;
  initial: VideoState;
  /**
   * The editor's "Làm thử": keys under each question, nothing sent, the
   * result graded in the browser.
   */
  preview?: RunnerPreview;
};

type Reply =
  | { ok: true; data: VideoView }
  | { ok: false; code?: string; message: string };

/**
 * A video lesson ("Học qua video"): a YouTube video that stops at each cue
 * for its questions. Answers are saved one cue at a time and graded when
 * the video ends; then the result page opens. Without `seek` (the first
 * viewing by default) the student can rewind but not skip ahead. The video
 * pauses when the page loses focus and resumes where it was after a reload.
 */
export function VideoLesson(props: VideoLessonProps) {
  const count = props.questions.length;
  // Answered cues stay as answered.
  const answered = cueItems(props.initial.cues, props.initial.done).from;
  let screen = <VideoScreen {...props} />;
  if (props.preview)
    screen = <PreviewProvider value={props.preview}>{screen}</PreviewProvider>;
  return (
    <RunnerProvider
      initial={() => ({
        answers: restoreAnswers(props.saved, count),
        flagged: [],
        current: 0,
      })}
      locked={Array.from({ length: answered }, (_, i) => i)}
    >
      {screen}
    </RunnerProvider>
  );
}

function VideoScreen({
  attemptId,
  lessonId,
  title,
  youtubeId,
  questions,
  initial,
  preview,
}: VideoLessonProps) {
  const router = useRouter();
  const api = useRunnerApi();
  const stage = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(stage);
  const url = `/api/attempts/${attemptId}/video`;

  const [state, setState] = useState(initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Reloaded while a question was open: ask it again at once.
  const dueAt = nextCue(initial)?.at ?? null;
  const [cue, setCue] = useState<number | null>(
    dueAt !== null && initial.pos >= dueAt ? initial.done : null,
  );
  const cueRef = useRef(cue);
  cueRef.current = cue;
  const [max, setMax] = useState(initial.max);
  const maxRef = useRef(initial.max);
  const [time, setTime] = useState(initial.pos);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ended, setEnded] = useState(false);
  const endedRef = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [previewDone, setPreviewDone] = useState(false);
  const lastSaved = useRef(initial.pos);

  /** The server, or (preview) the same rules applied in the browser. */
  const send = useCallback(
    async (move: VideoMove): Promise<Reply> => {
      if (preview) {
        const s = stateRef.current;
        if (move.kind !== "answer") return { ok: true, data: { state: s } };
        const r = answerCue(s, move.cue, Number.POSITIVE_INFINITY, null);
        return r.ok
          ? { ok: true, data: { state: r.state } }
          : { ok: true, data: { state: s } };
      }
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(move),
          cache: "no-store",
        });
        return (await res.json()) as Reply;
      } catch {
        return { ok: false, message: t.sendFailed };
      }
    },
    [preview, url],
  );

  const toResult = useCallback(() => {
    if (preview) setPreviewDone(true);
    else router.replace(`/attempts/${attemptId}/result`);
  }, [preview, router, attemptId]);

  const finish = useCallback(async () => {
    setFinishing(true);
    setFinishError(null);
    if (preview) {
      toResult();
      return;
    }
    const r = await send({ kind: "finish" });
    if (r.ok && r.data.result) return toResult();
    // Stored but not graded yet: the runner page grades it on load.
    if (r.ok || r.code === "ATTEMPT_CLOSED") return router.refresh();
    setFinishing(false);
    setFinishError(r.message);
  }, [preview, send, toResult, router]);

  const youtube = useYoutube(host, {
    videoId: youtubeId,
    start: initial.pos,
    // Read through a ref by the hook: always this render's handler.
    onStateChange: onPlayerState,
  });
  const { player, status } = youtube;

  function onPlayerState(s: number) {
    if (s === YT_STATE.PLAYING) {
      // Nothing plays over an open question (YouTube's own button).
      if (cueRef.current !== null) {
        player.current?.pauseVideo();
        return;
      }
      setPlaying(true);
      setStarted(true);
      setNotice(null);
      endedRef.current = false;
      setEnded(false);
      return;
    }
    setPlaying(false);
    if (s === YT_STATE.PAUSED) saveProgress();
    if (s !== YT_STATE.ENDED || endedRef.current) return;
    endedRef.current = true;
    setEnded(true);
    saveProgress();
    // Questions at (or past) the end, else the result.
    const st = stateRef.current;
    if (st.done < st.cues.length) setCue(st.done);
    else void finish();
  }

  /** Saves the position for a reload (a beacon when the page goes away). */
  const saveProgress = useCallback(
    (beacon = false) => {
      const p = player.current;
      if (preview || !p) return;
      const pos = Math.round(p.getCurrentTime() * 10) / 10;
      if (!Number.isFinite(pos) || Math.abs(pos - lastSaved.current) < 1)
        return;
      lastSaved.current = pos;
      const body = JSON.stringify({ kind: "progress", pos });
      if (beacon && navigator.sendBeacon?.(url, body)) return;
      void fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    },
    [player, preview, url],
  );

  // The player's clock: stop at cues, undo skips, hold 1×.
  useEffect(() => {
    if (status !== "ready") return;
    const tick = setInterval(() => {
      const p = player.current;
      if (!p) return;
      const d = p.getDuration();
      if (d > 0) setDuration(d);
      if (p.getPlayerState() !== YT_STATE.PLAYING) return;
      if (p.getPlaybackRate() !== 1) p.setPlaybackRate(1);
      const now = p.getCurrentTime();
      const next = cueRef.current === null ? nextCue(stateRef.current) : null;
      const check = checkPlayback(now, {
        max: maxRef.current,
        seek: stateRef.current.seek,
        cueAt: next?.at ?? null,
      });
      if (check.kind === "cue") {
        p.pauseVideo();
        if (now > check.at + 0.5) p.seekTo(check.at, true);
        setTime(check.at);
        setCue(stateRef.current.done);
      } else if (check.kind === "rewind") {
        p.seekTo(check.to, true);
        setTime(check.to);
      } else {
        maxRef.current = check.max;
        setMax(check.max);
        setTime(now);
      }
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [status, player]);

  // Save every so often while playing.
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => saveProgress(), SAVE_EVERY_MS);
    return () => clearInterval(timer);
  }, [playing, saveProgress]);

  // Leaving the page (another tab, another app) pauses the video.
  useEffect(() => {
    const away = () => {
      const p = player.current;
      if (p && p.getPlayerState() === YT_STATE.PLAYING) {
        p.pauseVideo();
        setNotice(t.pausedAway);
      }
      saveProgress(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") away();
    };
    const onBlur = () => {
      // Focus went into the player (its own play button), not elsewhere.
      if (document.activeElement instanceof HTMLIFrameElement) return;
      away();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", away);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", away);
    };
  }, [player, saveProgress]);

  const togglePlay = () => {
    const p = player.current;
    if (!p || cue !== null || finishing) return;
    if (p.getPlayerState() === YT_STATE.PLAYING) p.pauseVideo();
    else p.playVideo();
  };

  const seekTo = (target: number) => {
    const p = player.current;
    if (!p || cue !== null) return;
    const to = seekTarget(target, { max, seek: state.seek, duration });
    p.seekTo(to, true);
    setTime(to);
  };

  const toggleMute = () => {
    const p = player.current;
    if (!p) return;
    if (p.isMuted()) p.unMute();
    else p.mute();
    setMuted(!muted);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-cue-panel], button, input, [role=slider]"))
      return;
    if (e.key === " " || e.key === "k") togglePlay();
    else if (e.key === "ArrowLeft") seekTo(time - 5);
    else if (e.key === "ArrowRight") seekTo(time + 5);
    else if (e.key === "f") fullscreen.toggle();
    else if (e.key === "m") toggleMute();
    else return;
    e.preventDefault();
  };

  const answerOpenCue = async () => {
    if (cue === null) return;
    const { from, to } = cueItems(state.cues, cue);
    const answers = api.getState().answers.slice(from, to);
    const atEnd = state.cues[cue]?.at === null;
    setSending(true);
    setError(null);
    const r = await send({ kind: "answer", cue, answers });
    setSending(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    for (let i = from; i < to; i++) api.getState().lock(i);
    const next = r.data.state;
    stateRef.current = next;
    setState(next);
    setCue(null);
    if (r.data.result) return toResult();
    if (atEnd || endedRef.current) {
      if (next.done < next.cues.length) setCue(next.done);
      else void finish();
      return;
    }
    player.current?.playVideo();
  };

  const total = questions.length;
  const answered = cueItems(state.cues, state.done).from;
  const markers = useMemo(
    () =>
      state.cues.flatMap((c, k) =>
        c.at === null ? [] : [{ at: c.at, done: k < state.done }],
      ),
    [state],
  );
  const open = cue === null ? null : state.cues[cue];
  const exitHref = lessonId ? `/lessons/${lessonId}` : "/dashboard";

  return (
    <div className={cn("flex flex-col", !preview && "min-h-dvh")}>
      {!preview && (
        <header className="sticky top-0 z-20 flex items-center gap-2 border-border/70 border-b bg-surface/95 px-2 py-2 backdrop-blur sm:px-4 dark:border-border">
          <Link
            href={exitHref}
            prefetch={false}
            onClick={() => saveProgress(true)}
            aria-label={t.back}
            title={t.back}
            className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <ArrowLeft aria-hidden className="size-5" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-bold font-display text-base sm:text-lg">
            {title}
          </h1>
          <p className="num shrink-0 rounded-full bg-muted px-3 py-1 font-semibold text-muted-foreground text-xs tabular-nums sm:text-sm">
            {t.answered(answered, total)}
          </p>
        </header>
      )}

      <main
        className={cn(
          "mx-auto flex w-full max-w-5xl flex-col gap-3",
          !preview && "px-0 pb-10 sm:px-4 sm:pt-4",
        )}
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcuts for the player; every action also has a button */}
        <div
          ref={stage}
          onKeyDown={onKeyDown}
          className={cn(
            "relative flex flex-col overflow-hidden bg-black",
            fullscreen.active
              ? "h-dvh w-full"
              : "sm:rounded-xl sm:shadow-raised",
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
            {/* After the first play nothing reaches YouTube's own UI: no
                seeking, links or suggested videos. A tap plays or pauses. */}
            {started && (
              <div
                aria-hidden
                onClick={togglePlay}
                className="absolute inset-0 cursor-pointer"
              />
            )}
            {status !== "ready" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-white">
                {status === "loading" ? (
                  <>
                    <LoaderCircle aria-hidden className="size-6 animate-spin" />
                    {t.loading}
                  </>
                ) : (
                  <>
                    <p className="max-w-md">
                      {youtube.errorCode && youtube.errorCode >= 100
                        ? t.errorEmbed
                        : t.error}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => window.location.reload()}
                    >
                      {t.reload}
                    </Button>
                  </>
                )}
              </div>
            )}
            {finishing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center text-white">
                <LoaderCircle aria-hidden className="size-6 animate-spin" />
                <p aria-live="polite">{t.finishing}</p>
              </div>
            )}
          </div>
          <PlayerControls
            playing={playing}
            time={time}
            duration={duration}
            max={max}
            seek={state.seek}
            markers={markers}
            disabled={status !== "ready" || cue !== null || finishing}
            muted={muted}
            fullscreen={fullscreen.active}
            onTogglePlay={togglePlay}
            onSeek={seekTo}
            onToggleMute={toggleMute}
            onToggleFullscreen={fullscreen.toggle}
          />
          {open && cue !== null && (
            <CuePanel
              key={cue}
              cue={cue}
              at={open.at}
              range={cueItems(state.cues, cue)}
              questions={questions}
              last={
                cue === state.cues.length - 1 && (open.at === null || ended)
              }
              sending={sending}
              error={error}
              overlay={fullscreen.active}
              onSubmit={() => void answerOpenCue()}
            />
          )}
        </div>

        <div className="px-3 sm:px-0" aria-live="polite">
          {finishError ? (
            <Alert variant="danger">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex-1">{finishError}</span>
                <Button type="button" size="sm" onClick={() => void finish()}>
                  {t.retry}
                </Button>
              </div>
            </Alert>
          ) : notice ? (
            <Alert>{notice}</Alert>
          ) : (
            !started &&
            cue === null &&
            status === "ready" && (
              <p className="text-muted-foreground text-sm">
                {initial.pos >= 1
                  ? t.resumeHint(formatVideoTime(initial.pos))
                  : t.startHint}
              </p>
            )
          )}
        </div>
        {previewDone && <PreviewOutcome />}
      </main>
    </div>
  );
}

/** One cue's questions; "Tiếp tục xem" once each has a full answer. */
function CuePanel({
  cue,
  at,
  range,
  questions,
  last,
  sending,
  error,
  overlay,
  onSubmit,
}: {
  cue: number;
  at: number | null;
  range: { from: number; to: number };
  questions: RunnerQuestion[];
  last: boolean;
  sending: boolean;
  error: string | null;
  /** Full screen: over the video instead of under it. */
  overlay: boolean;
  onSubmit: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const indexes = Array.from(
    { length: range.to - range.from },
    (_, k) => range.from + k,
  );
  const complete = useRunner((s) =>
    indexes.every((i) => {
      const q = questions[i];
      return (
        q !== undefined &&
        isComplete(s.answers[i], {
          type: q.type,
          statements: q.statements?.length ?? 0,
        })
      );
    }),
  );

  useEffect(() => {
    heading.current?.focus({ preventScroll: overlay });
    if (!overlay)
      heading.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [overlay]);

  return (
    <section
      data-cue-panel
      data-cue={cue}
      aria-labelledby={headingId}
      className={cn(
        "bg-panel",
        overlay
          ? "absolute inset-0 z-10 overflow-y-auto overscroll-contain bg-background/95 px-3 py-5 sm:px-8"
          : "px-3 py-5 sm:px-5",
      )}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div>
          <h2
            ref={heading}
            id={headingId}
            tabIndex={-1}
            className="heading-section scroll-mt-20 outline-none"
          >
            {t.cueTitle(at === null ? null : formatVideoTime(at))}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t.cueLead(indexes.length)}
          </p>
        </div>
        {indexes.map((i) => {
          const q = questions[i];
          return q ? (
            <QuestionCard key={i} index={i} question={q} showFlag={false} />
          ) : null;
        })}
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!complete && (
            <p className="flex-1 text-muted-foreground text-sm">
              {t.answerAll}
            </p>
          )}
          <Button
            type="button"
            size="lg"
            onClick={onSubmit}
            disabled={!complete || sending}
            className="max-sm:w-full"
          >
            {sending ? t.sending : last ? t.finishCue : t.continue}
            {last ? <Send aria-hidden /> : <ArrowRight aria-hidden />}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** "Làm thử" only: the score of what was answered, graded in the browser. */
function PreviewOutcome() {
  const preview = usePreview();
  const answers = useRunner((s) => s.answers);
  if (!preview) return null;
  const marks = answers.map((a, i) => preview.mark(i, a));
  const result = summarize(marks);
  return (
    <Alert variant="success">
      {t.ended}{" "}
      <strong className="num">
        {formatScore(result.score)}/{formatScore(result.maxScore)}
      </strong>
    </Alert>
  );
}
