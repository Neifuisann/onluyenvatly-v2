"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  LayoutList,
  Send,
  Square,
  X,
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
import {
  practiceCopy,
  previewCopy,
  saveCopy,
  runnerCopy as t,
} from "../../messages";
import { PracticeProvider, type RunnerPractice } from "./practice";
import { PreviewProvider, PreviewResult, type RunnerPreview } from "./preview";
import { QuestionCard } from "./question-card";
import { QuestionNavigator } from "./question-navigator";
import { SaveIndicator } from "./save-indicator";
import { RunnerProvider, useRunner, useRunnerApi } from "./store";
import { SubmitDialog } from "./submit-dialog";
import { TestTimer } from "./test-timer";
import type { RunnerQuestion } from "./types";
import { useAutosave } from "./use-autosave";
import { useExamGuard } from "./use-exam-guard";
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
  /** ISO start time; exam-guard events count seconds from it. */
  startedAt: string;
  /** The lesson's exam guard (S4-04). */
  examGuard: boolean;
  /**
   * The editor's preview (S5-06): keys shown, graded in the browser, no
   * autosave, no submit, no exam guard, no attempt.
   */
  preview?: RunnerPreview;
  /**
   * Practice mode (S7-06, review attempts): "Kiểm tra" under each question,
   * checked answers locked. Exit goes to `exitHref`.
   */
  practice?: RunnerPractice;
  exitHref?: string;
};

type View = "single" | "list";
const VIEW_KEY = "runner:view";

/** The test runner (07 §5.2). */
export function Runner(props: RunnerProps) {
  const count = props.questions.length;
  let screen = <RunnerScreen {...props} />;
  if (props.preview)
    screen = <PreviewProvider value={props.preview}>{screen}</PreviewProvider>;
  else if (props.practice)
    screen = (
      <PracticeProvider attemptId={props.attemptId} practice={props.practice}>
        {screen}
      </PracticeProvider>
    );
  return (
    <RunnerProvider
      initial={() => ({
        answers: restoreAnswers(props.saved.answers, count),
        flagged: restoreFlagged(props.saved.flagged, count),
        current: 0,
      })}
      locked={Object.keys(props.practice?.checked ?? {}).map(Number)}
    >
      {screen}
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
  startedAt,
  examGuard,
  preview,
  practice,
  exitHref,
}: RunnerProps) {
  const api = useRunnerApi();
  const router = useRouter();
  // Before autosave, so a "hidden" event is recorded before the hide-time save.
  useExamGuard(examGuard && !preview, startedAt, serverNow);
  // Closed elsewhere (another tab submitted, the deadline passed): the page
  // itself redirects to the result once refreshed.
  const save = useAutosave(attemptId, () => router.refresh(), !preview);
  const { submit, submitting, error } = useSubmit(attemptId, save);
  const current = useRunner((s) => s.current);
  const answers = useRunner((s) => s.answers);
  const flagged = useRunner((s) => s.flagged.includes(s.current));
  const toggleFlag = useRunner((s) => s.toggleFlag);
  const [view, setView] = useState<View>("single");
  const [navOpen, setNavOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const Main = preview ? "div" : "main";
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
    <div
      className={cn(
        "flex flex-col",
        preview ? "rounded-xl border bg-background" : "min-h-dvh",
      )}
    >
      <header
        className={cn(
          "border-border/60 border-b bg-background/80 backdrop-blur-xl",
          // In the editor the admin header stays on top.
          !preview && "sticky top-0 z-20",
        )}
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-1.5 px-2 sm:px-3">
          {!preview && (
            <Link
              href={
                exitHref ?? (lessonId ? `/lessons/${lessonId}` : "/dashboard")
              }
              aria-label={practice ? practiceCopy.exit : t.exit}
              title={practice ? practiceCopy.exit : t.exit}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              prefetch={false}
            >
              <X aria-hidden className="size-5" />
            </Link>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setNavOpen(true)}
            aria-haspopup="dialog"
            aria-label={`${t.position(current + 1, total)}. ${t.openNavigator}`}
            className="num h-10 gap-1 pr-3 pl-4 font-display font-semibold text-base shadow-none lg:hidden"
          >
            {t.position(current + 1, total)}
            <ChevronDown aria-hidden />
          </Button>
          <p className="hidden min-w-0 truncate px-2 font-display font-semibold text-lg tracking-tight lg:block">
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
              className="h-10 px-3 text-muted-foreground hover:text-foreground"
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
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pb-2.5">
          <div
            role="progressbar"
            aria-label={t.progress(answered, total)}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={answered}
            className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${(answered / total) * 100}%` }}
            />
          </div>
          {preview ? (
            <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 font-semibold text-accent-text text-xs">
              {previewCopy.badge}
            </span>
          ) : (
            <>
              {practice && (
                <span className="hidden shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 font-semibold text-accent-text text-xs sm:inline">
                  {practiceCopy.badge}
                </span>
              )}
              <SaveIndicator status={save.status} />
            </>
          )}
        </div>
        {examGuard && (
          <p className="mx-auto max-w-5xl px-4 pb-2.5 text-muted-foreground text-xs">
            {t.guardNotice}
          </p>
        )}
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

      <Main
        id={preview ? undefined : "main"}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-8"
      >
        {!preview && <h1 className="sr-only">{title}</h1>}
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
        <aside
          className={cn(
            "sticky hidden space-y-4 rounded-xl border border-border/70 bg-surface p-5 shadow-card lg:block dark:border-border",
            preview ? "top-4" : "top-32",
          )}
        >
          <h2 className="font-display font-semibold">{t.navigatorTitle}</h2>
          <QuestionNavigator onPick={pick} />
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() => setSubmitOpen(true)}
          >
            <Send aria-hidden />
            {t.submit}
          </Button>
        </aside>
      </Main>

      <footer className="sticky bottom-0 z-20 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-1.5 rounded-[1.75rem] border border-border/70 bg-surface/90 p-1.5 shadow-raised backdrop-blur-xl dark:border-border">
          {view === "single" ? (
            <>
              <Button
                type="button"
                variant="secondary"
                aria-pressed={flagged}
                onClick={() => toggleFlag(current)}
                className={cn(
                  "h-12 border-0 bg-muted shadow-none",
                  flagged &&
                    "bg-accent text-accent-foreground hover:bg-accent/90",
                )}
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
                className="ml-auto h-12 border-0 shadow-none"
              >
                <ChevronLeft aria-hidden />
                {t.prev}
              </Button>
              {last ? (
                <Button
                  type="button"
                  className="h-12 px-6"
                  onClick={() => setSubmitOpen(true)}
                >
                  <Send aria-hidden />
                  {t.submit}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-12 px-6"
                  onClick={() => pick(current + 1, false)}
                >
                  {t.next}
                  <ChevronRight aria-hidden />
                </Button>
              )}
            </>
          ) : (
            <Button
              type="button"
              className="h-12 w-full"
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
        onConfirm={() => {
          if (!preview) return void submit();
          setSubmitOpen(false);
          setResultOpen(true);
        }}
        submitting={submitting}
        error={error}
      />
      {preview && (
        <PreviewResult open={resultOpen} onClose={() => setResultOpen(false)} />
      )}
    </div>
  );
}
