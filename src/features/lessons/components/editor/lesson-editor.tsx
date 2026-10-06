"use client";

import {
  ArrowLeft,
  ArrowRight,
  ChartColumn,
  Check,
  Play,
  Save,
  Send,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveSettings } from "../../admin-actions";
import { editorStats } from "../../domain/editor-stats";
import { parseLessonText } from "../../domain/parser";
import {
  fromSettingsForm,
  type LessonMeta,
  type SettingsField,
  type SettingsForm,
  toSettingsForm,
} from "../../domain/settings-form";
import { countByType } from "../../domain/summary";
import {
  publishCopy,
  settingsCopy,
  statsCopy,
  editorCopy as t,
} from "../../messages";
import type { LessonConfig, Question } from "../../schema";
import { LessonStatusBadge } from "../admin/lesson-status-badge";
import { ContentStep } from "./content-step";
import { CoverPicker } from "./cover-picker";
import { questionTexts, TexProvider } from "./preview-math";
import { PreviewTab } from "./preview-tab";
import { type EditorMessage, usePublishActions } from "./publish-actions";
import { PublishPanel } from "./publish-panel";
import { SettingsStep } from "./settings-step";

export type EditorLesson = {
  id: number;
  status: "draft" | "published" | "archived";
  coverPath: string | null;
  meta: LessonMeta;
  sourceText: string;
  /** Last saved questions, so new parses keep their ids (04 §3.1). */
  previous: Question[];
  config: LessonConfig;
  hasDraft: boolean;
  hasPublished: boolean;
};

type Step = "content" | "settings";

/**
 * `/admin/lessons/[id]/edit[?step=settings]` (07 §5.6), the v1 flow made
 * consistent: step 1 "Soạn nội dung" (question cards left, text right) →
 * "Tiếp tục" saves the draft → step 2 "Cài đặt & xuất bản" → "Xuất bản".
 * A full-screen workspace outside the admin shell: one slim bar, then the
 * step fills the rest of the screen and scrolls inside itself.
 * The step lives in the URL (history entries, so Back returns to step 1);
 * both steps stay mounted so the editor keeps its undo history. "Làm thử"
 * opens the real runner on the text being edited.
 */
export function LessonEditor({ lesson }: { lesson: EditorLesson }) {
  const params = useSearchParams();
  const step: Step = params.get("step") === "settings" ? "settings" : "content";
  const [trying, setTrying] = useState(false);

  const [text, setText] = useState(lesson.sourceText);
  const deferred = useDeferredValue(text);
  const parsed = useMemo(() => {
    // Deterministic ids for new questions keep preview keys stable per edit.
    let n = 0;
    return parseLessonText(deferred, {
      previous: lesson.previous,
      generateId: () => `q_new${++n}`,
    });
  }, [deferred, lesson.previous]);
  const texts = useMemo(
    () => questionTexts(parsed.questions),
    [parsed.questions],
  );
  const available = useMemo(
    () => countByType(parsed.questions),
    [parsed.questions],
  );

  const initialForm = useMemo(
    () => toSettingsForm(lesson.meta, lesson.config),
    [lesson.meta, lesson.config],
  );
  const [form, setForm] = useState(initialForm);
  const [savedForm, setSavedForm] = useState(initialForm);
  const [touched, setTouched] = useState(new Set<SettingsField>());
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<EditorMessage>();
  const settingsScroll = useRef<HTMLDivElement>(null);
  const [settingsPending, startSettings] = useTransition();
  const settings = useMemo(
    () => fromSettingsForm(form, available),
    [form, available],
  );
  // Stats follow valid settings, else the saved ones.
  const liveConfig = settings.ok ? settings.config : lesson.config;
  const stats = useMemo(
    () => editorStats(parsed.questions, liveConfig),
    [parsed.questions, liveConfig],
  );

  const errorOf = (field: SettingsField) =>
    serverErrors[field] ??
    (!settings.ok && (tried || touched.has(field))
      ? settings.errors[field]
      : undefined);

  const onChange = (patch: Partial<SettingsForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setServerErrors({});
    setMessage(undefined);
    // Radio groups and selects count as touched once changed.
    setTouched(
      (s) => new Set([...s, ...(Object.keys(patch) as SettingsField[])]),
    );
  };

  /** Saves the settings form; resolves whether they are saved. */
  const saveSettingsNow = async (): Promise<boolean> => {
    setTried(true);
    if (!settings.ok) {
      setMessage({ text: settingsCopy.invalid, error: true });
      return false;
    }
    const sent = form;
    const result = await saveSettings({ id: lesson.id, form: sent });
    if (result.ok) {
      setSavedForm(sent);
      setMessage({ text: settingsCopy.saved, error: false });
      return true;
    }
    setServerErrors(result.fieldErrors ?? {});
    setMessage({ text: result.message, error: true });
    return false;
  };

  const settingsDirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const textDirty = text !== lesson.sourceText;
  const dirty = textDirty || settingsDirty;
  // From the deferred parse; the server checks the text again on publish.
  const errors = parsed.issues.filter((i) => i.severity === "error").length;

  const onMessage = useCallback(
    (m: EditorMessage | undefined) => setMessage(m),
    [],
  );
  const actions = usePublishActions({
    lessonId: lesson.id,
    status: lesson.status,
    text,
    textDirty,
    settingsDirty,
    hasDraft: lesson.hasDraft,
    hasPublished: lesson.hasPublished,
    errors,
    beforePublish: () =>
      settingsDirty ? saveSettingsNow() : Promise.resolve(true),
    onMessage,
  });
  const pending = actions.pending || settingsPending;

  // Unsaved work: let the browser ask before leaving.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const goStep = (next: Step) => {
    setTrying(false);
    if (next === step) return;
    const url = new URL(window.location.href);
    if (next === "settings") url.searchParams.set("step", "settings");
    else url.searchParams.delete("step");
    window.history.pushState(null, "", url);
    settingsScroll.current?.scrollTo({ top: 0 });
  };

  // Successes fade after a while; errors stay until dismissed or replaced.
  useEffect(() => {
    if (!message || message.error) return;
    const timer = setTimeout(() => setMessage(undefined), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  const primary =
    step === "content"
      ? {
          label: t.continue,
          icon: ArrowRight,
          disabled: pending,
          onClick: () => actions.saveThen(() => goStep("settings")),
          describedBy: undefined,
        }
      : {
          label: publishCopy.publish,
          icon: Send,
          disabled: !actions.canPublish,
          onClick: () => {
            if (settings.ok) return actions.askPublish();
            // Show every field's message rather than a dead button.
            setTried(true);
            setMessage({ text: settingsCopy.invalid, error: true });
          },
          describedBy: actions.canPublish ? undefined : "publish-checklist",
        };
  const secondary =
    step === "content"
      ? {
          label: pending ? publishCopy.saving : publishCopy.saveDraft,
          icon: Save,
          disabled: !actions.canSave,
          onClick: actions.save,
          title: publishCopy.shortcut,
        }
      : {
          label: t.backToContent,
          icon: ArrowLeft,
          disabled: false,
          onClick: () => goStep("content"),
          title: undefined,
        };
  const buttons = (className?: string) => (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={secondary.onClick}
        disabled={secondary.disabled}
        title={secondary.title}
        className={className}
      >
        <secondary.icon aria-hidden />
        {secondary.label}
      </Button>
      <Button
        type="button"
        onClick={primary.onClick}
        disabled={primary.disabled}
        aria-describedby={primary.describedBy}
        className={className}
      >
        {step === "settings" && <primary.icon aria-hidden />}
        {primary.label}
        {step === "content" && <primary.icon aria-hidden />}
      </Button>
    </>
  );

  const title = form.title.trim() || lesson.meta.title;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <header className="z-30 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-border/70 border-b bg-surface px-2 py-1.5 sm:px-3 lg:h-14 lg:flex-nowrap lg:py-0 dark:border-border">
        {/* A plain link, so leaving with unsaved work still asks first. */}
        <a
          href="/admin/lessons"
          title={t.back}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "max-lg:order-1",
          )}
        >
          <ArrowLeft aria-hidden />
          <span className="sr-only">{t.back}</span>
        </a>
        <div className="min-w-0 flex-1 max-lg:order-2 lg:max-w-[26rem] lg:flex-initial">
          <h1 className="truncate font-bold font-display text-base leading-tight">
            {title}
          </h1>
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground text-xs">
            <LessonStatusBadge status={lesson.status} className="py-0" />
            {lesson.status === "published" && (
              <span className="max-w-full truncate">
                {lesson.hasDraft ? t.draftSource : t.publishedSource}
              </span>
            )}
          </p>
        </div>

        {/* Phones: back · title · save state, then the stepper and tools. */}
        <div className="flex items-center max-lg:order-5 lg:mx-auto">
          {trying ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTrying(false)}
            >
              <ArrowLeft aria-hidden />
              {t.tryClose}
            </Button>
          ) : (
            <Stepper step={step} onStep={goStep} />
          )}
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-semibold text-xs max-lg:order-3",
            dirty ? "bg-accent-soft text-accent-text" : "text-muted-foreground",
          )}
        >
          {dirty ? (
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          ) : (
            <Check aria-hidden className="size-3.5" />
          )}
          {dirty ? t.unsaved : t.saved}
        </span>
        <span aria-hidden className="basis-full max-lg:order-4 lg:hidden" />
        <div className="ml-auto flex items-center gap-1.5 max-lg:order-6 lg:ml-0">
          <a
            href={`/admin/lessons/${lesson.id}/stats`}
            title={statsCopy.link}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ChartColumn aria-hidden />
            <span className="max-xl:sr-only">{statsCopy.link}</span>
          </a>
          {!trying && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTrying(true)}
            >
              <Play aria-hidden />
              <span className="max-sm:sr-only">{t.tryOpen}</span>
            </Button>
          )}
          <div className="hidden items-center gap-2 lg:flex">
            {buttons("h-9 px-4")}
          </div>
        </div>
      </header>

      {/* Alert is a live region itself (status, or alert for errors). */}
      {message && (
        <div className="pointer-events-none absolute inset-x-3 top-28 z-40 flex justify-center lg:top-16 lg:right-4 lg:left-auto">
          <Alert
            variant={message.error ? "danger" : "success"}
            className="pointer-events-auto w-full max-w-md shadow-popover"
          >
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1">{message.text}</span>
              <button
                type="button"
                onClick={() => setMessage(undefined)}
                aria-label={t.closeMessage}
                title={t.closeMessage}
                className="-my-1 -mr-1 rounded-full p-1 opacity-70 hover:bg-surface/60 hover:opacity-100"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
          </Alert>
        </div>
      )}

      {/* Both steps stay mounted so the editor keeps its undo history. */}
      <TexProvider texts={texts}>
        <section
          aria-label={t.steps.content}
          hidden={step !== "content" || trying}
          className="min-h-0 flex-1"
        >
          <ContentStep
            initialText={lesson.sourceText}
            onTextChange={setText}
            parsed={parsed}
            config={liveConfig}
          />
        </section>
        <div
          ref={settingsScroll}
          hidden={step !== "settings" || trying}
          className="relative min-h-0 flex-1 overflow-y-auto bg-panel"
        >
          <section
            aria-label={t.steps.settings}
            className="mx-auto grid max-w-[80rem] items-start gap-5 px-4 pt-5 pb-28 sm:px-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:px-8 lg:pb-10"
          >
            <div className="flex min-w-0 flex-col gap-5">
              <SettingsStep
                form={form}
                onChange={onChange}
                errorOf={errorOf}
                onTouch={(field) => setTouched((s) => new Set([...s, field]))}
                available={available}
                onSave={() => {
                  setMessage(undefined);
                  startSettings(async () => {
                    await saveSettingsNow();
                  });
                }}
                sourceText={text}
              />
              <CoverPicker lessonId={lesson.id} coverPath={lesson.coverPath} />
            </div>
            <div className="lg:sticky lg:top-5">
              <PublishPanel
                status={lesson.status}
                hasDraft={lesson.hasDraft}
                hasPublished={lesson.hasPublished}
                stats={stats}
                config={liveConfig}
                errors={errors}
                settingsValid={settings.ok}
                settingsDirty={settingsDirty}
                formError={errorOf("form")}
                pending={pending}
                onFixContent={() => goStep("content")}
                onUnpublish={actions.unpublish}
                onDiscard={actions.askDiscard}
              />
            </div>
          </section>
        </div>
        {/* Mounted only while open: each visit is a fresh try on the latest text. */}
        {trying && (
          <div className="relative min-h-0 flex-1 overflow-y-auto bg-panel">
            <section
              aria-label={t.tryTitle}
              className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-5 pb-10 sm:px-6"
            >
              <h2 className="heading-section">{t.tryTitle}</h2>
              <PreviewTab
                title={title}
                questions={parsed.questions}
                config={liveConfig}
                errors={errors}
              />
            </section>
          </div>
        )}
      </TexProvider>

      {/* Phones: the step's two actions in the thumb zone (07 §1). */}
      {!trying && (
        <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto grid max-w-md grid-cols-2 gap-2 rounded-[1.75rem] border border-border/70 bg-surface/95 p-2 shadow-raised backdrop-blur-xl lg:hidden dark:border-border">
          {buttons("w-full px-3")}
        </div>
      )}
      {actions.dialogs}
    </div>
  );
}

/** "① Soạn nội dung — ② Cài đặt & xuất bản"; each step is a button. */
function Stepper({
  step,
  onStep,
}: {
  step: Step;
  onStep: (step: Step) => void;
}) {
  const steps: Step[] = ["content", "settings"];
  return (
    <ol aria-label={t.stepsLabel} className="flex items-center gap-1">
      {steps.map((s, i) => {
        const current = s === step;
        const done = i < steps.indexOf(step);
        return (
          <li key={s} className="flex items-center gap-1">
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "h-0.5 w-5 rounded-full sm:w-8",
                  done || current ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <button
              type="button"
              onClick={() => onStep(s)}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-full py-1 pr-3.5 pl-1.5 font-semibold text-sm transition-colors",
                current
                  ? "bg-primary-soft text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "num flex size-7 items-center justify-center rounded-full font-bold font-display text-xs",
                  current || done
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className="sr-only">{t.stepNumber(i + 1)}: </span>
              <span className={cn(!current && "max-sm:sr-only")}>
                {t.steps[s]}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
