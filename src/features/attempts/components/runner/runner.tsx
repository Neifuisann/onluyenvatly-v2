"use client";

import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  LayoutList,
  Send,
  Square,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { OPTION_LETTERS } from "@/features/grading/domain/grade";
import { cn } from "@/lib/utils";
import {
  type RunnerAnswers,
  restoreAnswers,
  restoreFlagged,
  summarize,
} from "../../domain/runner-state";
import { saveCopy, runnerCopy as t } from "../../messages";
import { QuestionCard } from "./question-card";
import { QuestionNavigator } from "./question-navigator";
import { SaveIndicator } from "./save-indicator";
import { RunnerProvider, useRunner, useRunnerApi } from "./store";
import { SubmitDialog } from "./submit-dialog";
import { TestTimer } from "./test-timer";
import type { RunnerQuestion } from "./types";
import { useAutosave } from "./use-autosave";
import { useSubmit } from "./use-submit";

export type RunnerProps = {
  attemptId: string;
  lessonId: number | null;
  title: string;
  questions: RunnerQuestion[];
  /** Last answers saved on the server. */
  saved: { answers: RunnerAnswers; flagged: number[] };
  /** ISO; null = no time limit. */
  deadlineAt: string | null;
  /** The server clock when the page was rendered, to correct phone clocks. */
  serverNow: string;
};

type View = "single" | "list";
const VIEW_KEY = "runner:view";

/** The test runner (07 §5.2). */
export function Runner(props: RunnerProps) {
  const count = props.questions.length;
  return (
    <RunnerProvider
      initial={() => ({
        answers: restoreAnswers(props.saved.answers, count),
        flagged: restoreFlagged(props.saved.flagged, count),
        current: 0,
      })}
    >
      <RunnerScreen {...props} />
    </RunnerProvider>
  );
}

function RunnerScreen({
  attemptId,
  lessonId,
  title,
  questions,
  deadlineAt,
  serverNow,
}: RunnerProps) {
  const api = useRunnerApi();
  const router = useRouter();
  // Closed elsewhere (another tab submitted, the deadline passed): the page
  // itself redirects to the result once refreshed.
  const save = useAutosave(attemptId, () => router.refresh());
  const { submit, submitting, error } = useSubmit(attemptId, save);
  const current = useRunner((s) => s.current);
  const answers = useRunner((s) => s.answers);
  const flagged = useRunner((s) => s.flagged.includes(s.current));
  const toggleFlag = useRunner((s) => s.toggleFlag);
  const [view, setView] = useState<View>("single");
  const [navOpen, setNavOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const total = questions.length;
  const last = current === total - 1;
  const { answered } = summarize({ answers, flagged: [], current });

  // Remembered preference; desktops default to the list (07 §5.2).
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(VIEW_KEY);
    } catch {}
    if (saved === "single" || saved === "list") setView(saved);
    else if (matchMedia("(min-width: 1024px)").matches) setView("list");
  }, []);

  const changeView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {}
    if (next === "list")
      requestAnimationFrame(() =>
        document
          .getElementById(`q-${api.getState().current}`)
          ?.scrollIntoView({ block: "start" }),
      );
  };

  /** Moves to a question; in list mode scrolls to it. Focus follows for screen readers. */
  const pick = useCallback(
    (index: number, focus = true) => {
      api.getState().goTo(index);
      setNavOpen(false);
      setSubmitOpen(false);
      requestAnimationFrame(() => {
        const el = document.getElementById(`q-${api.getState().current}`);
        if (!el) return;
        if (view === "list") el.scrollIntoView({ block: "start" });
        else window.scrollTo({ top: 0 });
        if (focus) el.focus({ preventScroll: true });
      });
    },
    [api, view],
  );

  // Desktop shortcuts: 1–6 / A–E choose, ←/→ move, F flag, Enter next.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.querySelector("dialog[open]")) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const s = api.getState();
      const key = e.key.toLowerCase();
      let handled = true;
      if (key === "arrowright") pick(s.current + 1, false);
      else if (key === "arrowleft") pick(s.current - 1, false);
      else if (key === "f") s.toggleFlag(s.current);
      else if (key === "enter" && !target?.closest("button, a"))
        pick(s.current + 1, false);
      else {
        const q = questions[s.current];
        const digit = /^[1-6]$/.test(key) ? Number(key) - 1 : -1;
        const letter = /^[a-e]$/.test(key) ? key.charCodeAt(0) - 97 : -1;
        const option = Math.max(digit, letter);
        if (
          q?.type === "mcq" &&
          option >= 0 &&
          option < (q.options?.length ?? 0)
        )
          s.choose(s.current, OPTION_LETTERS[option] as string);
        else handled = false;
      }
      if (handled) e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api, pick, questions]);

  const question = questions[current];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-2">
          <Link
            href={lessonId ? `/lessons/${lessonId}` : "/dashboard"}
            aria-label={t.exit}
            title={t.exit}
            className="flex size-11 items-center justify-center rounded-md hover:bg-muted"
          >
            <ArrowLeft aria-hidden className="size-5" />
          </Link>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setNavOpen(true)}
            aria-haspopup="dialog"
            aria-label={`${t.position(current + 1, total)}. ${t.openNavigator}`}
            className="px-2 font-semibold font-mono text-base lg:hidden"
          >
            {t.position(current + 1, total)}
            <ChevronDown aria-hidden />
          </Button>
          <p className="hidden min-w-0 truncate px-2 font-semibold lg:block">
            {title}
          </p>
          <div className="ml-auto flex items-center gap-1">
            {deadlineAt && (
              <TestTimer
                deadlineAt={deadlineAt}
                serverNow={serverNow}
                onExpire={() => {
                  // Time is up: submit what is on screen, no questions asked.
                  setNavOpen(false);
                  setSubmitOpen(true);
                  void submit();
                }}
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => changeView(view === "single" ? "list" : "single")}
            >
              {view === "single" ? (
                <LayoutList aria-hidden />
              ) : (
                <Square aria-hidden />
              )}
              <span className="sr-only sm:not-sr-only">
                {view === "single" ? t.showAll : t.showOne}
              </span>
            </Button>
          </div>
        </div>
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pb-2">
          <div
            role="progressbar"
            aria-label={t.progress(answered, total)}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={answered}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${(answered / total) * 100}%` }}
            />
          </div>
          <SaveIndicator status={save.status} />
        </div>
        {(save.status === "offline" || save.status === "signed-out") && (
          <div className="border-t bg-surface">
            <Alert
              variant="danger"
              className="mx-auto max-w-5xl rounded-none border-0"
            >
              {save.status === "offline" ? (
                saveCopy.offlineBanner
              ) : (
                <>
                  {saveCopy.signedOutBanner}{" "}
                  <a
                    href={`/login?next=${encodeURIComponent(`/attempts/${attemptId}`)}`}
                    target="_blank"
                    rel="noopener"
                    className="font-medium underline"
                  >
                    {saveCopy.signIn}
                  </a>
                </>
              )}
            </Alert>
          </div>
        )}
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:gap-8"
      >
        <h1 className="sr-only">{title}</h1>
        <div className="space-y-4">
          {view === "single"
            ? question && (
                <QuestionCard
                  key={current}
                  index={current}
                  question={question}
                  showFlag={false}
                />
              )
            : questions.map((q, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: items never reorder
                <QuestionCard key={i} index={i} question={q} showFlag />
              ))}
          {/* Desktop one-per-screen keeps flag/prev/next under the question. */}
          {view === "single" && (
            <div className="hidden gap-2 lg:flex">
              <Button
                type="button"
                variant="secondary"
                aria-pressed={flagged}
                onClick={() => toggleFlag(current)}
                className={cn(flagged && "bg-accent text-accent-foreground")}
              >
                <Flag aria-hidden className={cn(flagged && "fill-current")} />
                {flagged ? t.flagged : t.flag}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => pick(current - 1, false)}
                disabled={current === 0}
                className="ml-auto"
              >
                <ChevronLeft aria-hidden />
                {t.prev}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => pick(current + 1, false)}
                disabled={last}
              >
                {t.next}
                <ChevronRight aria-hidden />
              </Button>
            </div>
          )}
          <p className="hidden text-muted-foreground text-xs lg:block">
            {t.keyboardHint}
          </p>
        </div>
        <aside className="sticky top-32 hidden space-y-4 rounded-lg border bg-surface p-4 lg:block">
          <h2 className="font-semibold text-sm">{t.navigatorTitle}</h2>
          <QuestionNavigator onPick={pick} />
          <Button
            type="button"
            className="w-full"
            onClick={() => setSubmitOpen(true)}
          >
            <Send aria-hidden />
            {t.submit}
          </Button>
        </aside>
      </main>

      <footer className="sticky bottom-0 z-20 border-t bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2">
          {view === "single" ? (
            <>
              <Button
                type="button"
                variant="secondary"
                aria-pressed={flagged}
                onClick={() => toggleFlag(current)}
                className={cn(flagged && "bg-accent text-accent-foreground")}
              >
                <Flag aria-hidden className={cn(flagged && "fill-current")} />
                <span className="sr-only min-[380px]:not-sr-only">
                  {flagged ? t.flagged : t.flag}
                </span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => pick(current - 1, false)}
                disabled={current === 0}
                className="ml-auto"
              >
                <ChevronLeft aria-hidden />
                {t.prev}
              </Button>
              {last ? (
                <Button type="button" onClick={() => setSubmitOpen(true)}>
                  <Send aria-hidden />
                  {t.submit}
                </Button>
              ) : (
                <Button type="button" onClick={() => pick(current + 1, false)}>
                  {t.next}
                  <ChevronRight aria-hidden />
                </Button>
              )}
            </>
          ) : (
            <Button
              type="button"
              className="ml-auto"
              onClick={() => setSubmitOpen(true)}
            >
              <Send aria-hidden />
              {t.submit}
            </Button>
          )}
        </div>
      </footer>

      <Dialog
        open={navOpen}
        onClose={() => setNavOpen(false)}
        title={t.navigatorTitle}
        closeLabel={t.close}
        variant="sheet"
        footer={
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              setNavOpen(false);
              setSubmitOpen(true);
            }}
          >
            <Send aria-hidden />
            {t.submit}
          </Button>
        }
      >
        <QuestionNavigator onPick={pick} />
      </Dialog>
      <SubmitDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onPick={pick}
        onConfirm={() => void submit()}
        submitting={submitting}
        error={error}
      />
    </div>
  );
}
