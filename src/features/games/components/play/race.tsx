"use client";

import { clsx } from "clsx";
import {
  CircleCheck,
  CircleMinus,
  CircleX,
  Timer,
  WifiOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AttemptAnswer } from "@/db/schema";
import type { Result } from "@/lib/result";
import type { MarkKind } from "../../domain/scoring";
import { gameCopy, markCopy } from "../../messages";
import type { AnswerOutcome, PlayerView } from "../../types";
import { RaceTrack, StreakFlame } from "../race-track";
import { StageBar } from "../stage";
import { clockOffset } from "../use-room-poll";
import { AnswerTiles, ShortAnswer, TrueFalseAnswer } from "./answer-inputs";

const t = gameCopy.play;

/** One question as the race shows it: answer-free, pre-rendered on the server. */
export type RaceQuestion = {
  type: "mcq" | "tf" | "short";
  limitMs: number;
  stem: ReactNode;
  options?: ReactNode[];
  statements?: ReactNode[];
};

type Phase = "countdown" | "question" | "sending" | "feedback";

/** The right/wrong card stays at least this long, however slow the answer. */
const MIN_FEEDBACK_MS = 1_500;

const MARK_ICON: Record<MarkKind, typeof CircleCheck> = {
  correct: CircleCheck,
  partial: CircleMinus,
  wrong: CircleX,
  blank: CircleMinus,
  timeout: Timer,
};

/**
 * The race on a phone (B-05). Every question is timed against the server
 * clock (`shownAt` comes from the server); one tap on a tile answers. The
 * answer's response carries the key, the points and the standings, so this
 * screen never polls. When the time runs out, whatever is chosen is sent.
 */
export function Race({
  roomId,
  title,
  questions,
  startIndex,
  total,
  shownAt: firstShownAt,
  serverNow,
  initialScore,
  initialStreak,
  initialView,
}: {
  roomId: string;
  title: string;
  /** From `startIndex` on, in this player's order. */
  questions: RaceQuestion[];
  startIndex: number;
  total: number;
  shownAt: string;
  serverNow: string;
  initialScore: number;
  initialStreak: number;
  initialView: PlayerView;
}) {
  const router = useRouter();
  const offset = useRef(clockOffset(serverNow));
  const serverTime = useCallback(() => Date.now() + offset.current, []);
  const [index, setIndex] = useState(startIndex);
  const [shownAt, setShownAt] = useState(Date.parse(firstShownAt));
  const [now, setNow] = useState(() => serverTime());
  const [phase, setPhase] = useState<Phase>(() =>
    serverTime() < Date.parse(firstShownAt) ? "countdown" : "question",
  );
  const [picked, setPicked] = useState<AttemptAnswer>(null);
  const [tf, setTf] = useState<(boolean | null)[]>([]);
  const [short, setShort] = useState("");
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [score, setScore] = useState(initialScore);
  const [streak, setStreak] = useState(initialStreak);
  const [view, setView] = useState(initialView);
  const [offline, setOffline] = useState(false);
  /** When the feedback card gives way to the next question (server clock). */
  const [advanceAt, setAdvanceAt] = useState(0);
  const sending = useRef(false);
  const leaving = useRef(false);

  const q = questions[index - startIndex];
  const remaining = q ? shownAt + q.limitMs - now : 0;

  const send = useCallback(
    async (answer: AttemptAnswer) => {
      if (sending.current) return;
      sending.current = true;
      setPicked(answer);
      setPhase("sending");
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(`/api/games/${roomId}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index, answer }),
          });
          const body = (await res.json()) as Result<AnswerOutcome>;
          setOffline(false);
          if (!body.ok) {
            // Over, out of step or removed: the server page knows best.
            router.refresh();
            return;
          }
          offset.current = clockOffset(body.data.serverNow);
          // A slow answer still shows its card for a moment, even if the
          // next question's clock has already started on the server.
          setAdvanceAt(
            Math.max(
              Date.parse(body.data.nextShownAt),
              serverTime() + MIN_FEEDBACK_MS,
            ),
          );
          setNow(serverTime());
          setOutcome(body.data);
          setScore(body.data.score);
          setStreak(body.data.streak);
          setView(body.data.view);
          setPhase("feedback");
          return;
        } catch {
          setOffline(true);
          await new Promise((r) =>
            setTimeout(r, Math.min(4000, 500 * 2 ** attempt)),
          );
        }
      }
    },
    [index, roomId, router, serverTime],
  );

  // The clock: drives the countdown, the timer bar and the timeout.
  useEffect(() => {
    if (phase === "sending") return;
    const id = setInterval(() => setNow(serverTime()), 200);
    return () => clearInterval(id);
  }, [phase, serverTime]);

  useEffect(() => {
    if (phase === "countdown" && now >= shownAt) setPhase("question");
    if (phase === "question" && q && now >= shownAt + q.limitMs) {
      const draft =
        q.type === "tf" ? tf : q.type === "short" ? short.trim() || null : null;
      void send(draft);
    }
    if (phase === "feedback" && outcome && now >= advanceAt) {
      if (outcome.finished || outcome.raceOver) {
        // The finish line is a server page; ask for it once.
        if (!leaving.current) router.refresh();
        leaving.current = true;
        return;
      }
      sending.current = false;
      setIndex((i) => i + 1);
      setShownAt(Date.parse(outcome.nextShownAt));
      setPicked(null);
      setTf([]);
      setShort("");
      setOutcome(null);
      setPhase("question");
    }
  }, [now, phase, shownAt, q, tf, short, outcome, advanceAt, send, router]);

  // Keys 1–6 answer an mcq on a keyboard.
  useEffect(() => {
    if (phase !== "question" || q?.type !== "mcq") return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      const count = q.options?.length ?? 0;
      if (n >= 1 && n <= count) void send(String.fromCharCode(64 + n));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, q, send]);

  if (phase === "countdown") {
    const n = Math.ceil((shownAt - now) / 1000) - 1;
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-ink-muted text-lg">{t.getReady}</p>
        <p
          key={n}
          aria-live="assertive"
          className="num animate-count font-bold font-display text-[9rem] text-accent leading-none"
        >
          {n > 0 ? n : t.countdownGo}
        </p>
      </main>
    );
  }
  if (!q) return null;

  const revealed = outcome?.expected;
  const disabled = phase !== "question";
  const pct = Math.max(0, Math.min(1, remaining / q.limitMs));
  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  const Icon = outcome ? MARK_ICON[outcome.mark.k] : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <StageBar title={title}>
        <StreakFlame streak={streak} />
        <span className="num rounded-full bg-lane px-3 py-1 font-bold font-display">
          {t.points(score)}
        </span>
      </StageBar>
      <div className="mx-auto w-full max-w-3xl px-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="num font-semibold">
            {t.position(index + 1, total)}
          </span>
          <span className="num text-ink-muted">
            {view.me && t.rankOf(view.me.rank, view.total)}
          </span>
          <span
            className={clsx(
              "num inline-flex items-center gap-1 font-bold font-display text-lg",
              seconds <= 5 && phase === "question" && "text-accent",
            )}
          >
            <Timer aria-hidden className="size-4" />
            {phase === "question" || phase === "sending" ? seconds : "—"}
            <span className="sr-only">{t.timeLeft(seconds)}</span>
          </span>
        </div>
        <div
          aria-hidden
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-lane"
        >
          <div
            className={clsx(
              "h-full rounded-full transition-[width] duration-200 ease-linear",
              pct < 0.25 ? "bg-game-a" : "bg-accent",
            )}
            style={{ width: `${(outcome ? 0 : pct) * 100}%` }}
          />
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 pt-4 pb-8">
        <section
          key={index}
          aria-label={t.position(index + 1, total)}
          className="animate-pop rounded-xl bg-surface p-5 text-foreground shadow-raised sm:p-6"
        >
          <div className="text-stem sm:text-[1.1875rem]">{q.stem}</div>
        </section>
        {q.type === "mcq" && (
          <AnswerTiles
            options={q.options ?? []}
            picked={picked}
            expected={revealed}
            disabled={disabled}
            onPick={(letter) => void send(letter)}
            label={t.answerLabel(index + 1)}
          />
        )}
        {q.type === "tf" && (
          <TrueFalseAnswer
            statements={q.statements ?? []}
            expected={revealed}
            disabled={disabled}
            value={tf}
            onChange={setTf}
            onSubmit={() => void send(tf)}
          />
        )}
        {q.type === "short" && (
          <ShortAnswer
            expected={revealed}
            disabled={disabled}
            value={short}
            onChange={setShort}
            onSubmit={() => void send(short.trim())}
            label={t.answerLabel(index + 1)}
          />
        )}
        {offline && (
          <output className="flex items-center justify-center gap-2 text-accent text-sm">
            <WifiOff aria-hidden className="size-4" />
            {t.offline}
          </output>
        )}
      </main>

      {outcome && Icon && (
        <section
          aria-live="polite"
          className="sticky bottom-0 animate-rise rounded-t-2xl border-lane border-t-4 bg-ink px-4 pt-4 pb-6 shadow-popover"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            <div className="flex items-center gap-3">
              <Icon
                aria-hidden
                className={clsx(
                  "size-10 shrink-0",
                  outcome.mark.k === "correct"
                    ? "text-success"
                    : outcome.mark.k === "partial"
                      ? "text-accent"
                      : "text-danger",
                )}
                strokeWidth={2.5}
              />
              <p className="flex-1 font-bold font-display text-2xl">
                {markCopy[outcome.mark.k]}
              </p>
              {outcome.mark.s > 0 && (
                <p className="num animate-pop font-bold font-display text-3xl text-accent">
                  {t.plusPoints(outcome.mark.s)}
                </p>
              )}
            </div>
            <p className="text-ink-muted text-sm">
              {view.me?.rank === 1
                ? t.leading
                : view.ahead
                  ? t.behind(view.ahead.name, view.ahead.gap)
                  : view.me && t.rankOf(view.me.rank, view.total)}
            </p>
            <RaceTrack
              players={standingsAroundMe(view)}
              questionCount={total}
              meId={view.me?.id ?? null}
              label={t.standingsLabel}
            />
          </div>
        </section>
      )}
    </div>
  );
}

/** The top five, plus me at the bottom when I'm further back. */
function standingsAroundMe(view: PlayerView) {
  const { top, me } = view;
  if (!me || top.some((p) => p.id === me.id)) return top;
  return [...top.slice(0, 4), me];
}
