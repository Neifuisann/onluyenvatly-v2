"use client";

import { ArrowLeft, ChartColumn } from "lucide-react";
import Link from "next/link";
import {
  type KeyboardEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { cn } from "@/lib/utils";
import { saveSettings } from "../../admin-actions";
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
  adminLessonsCopy,
  settingsCopy,
  statsCopy,
  editorCopy as t,
} from "../../messages";
import type { LessonConfig, Question } from "../../schema";
import { ContentTab } from "./content-tab";
import { CoverPicker } from "./cover-picker";
import { questionTexts, TexProvider } from "./preview-math";
import { PreviewTab } from "./preview-tab";
import { PublishBar } from "./publish-bar";
import { SettingsTab } from "./settings-tab";

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

const statusClass = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-success/15 text-success-text",
  archived: "bg-warning/25 text-foreground",
} as const;

const TABS = ["content", "settings", "preview"] as const;
type Tab = (typeof TABS)[number];

/**
 * `/admin/lessons/[id]/edit` (07 §5.6). Holds the text and the settings
 * being edited. The text is parsed on a deferred copy so typing stays smooth
 * on long lessons; the settings are validated on every change against the
 * live content, so the stats bar follows them. Saving and publishing the
 * text: `PublishBar` (S5-04).
 */
export function LessonEditor({ lesson }: { lesson: EditorLesson }) {
  const [tab, setTab] = useState<Tab>("content");
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());

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
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const [pending, startTransition] = useTransition();
  const settings = useMemo(
    () => fromSettingsForm(form, available),
    [form, available],
  );
  // The stats bar follows valid settings, else the saved ones.
  const statsConfig = settings.ok ? settings.config : lesson.config;

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

  const save = () => {
    setTried(true);
    if (!settings.ok) {
      setMessage({ text: settingsCopy.invalid, error: true });
      return;
    }
    const sent = form;
    startTransition(async () => {
      const result = await saveSettings({ id: lesson.id, form: sent });
      if (result.ok) {
        setSavedForm(sent);
        setMessage({ text: settingsCopy.saved, error: false });
      } else {
        setServerErrors(result.fieldErrors ?? {});
        setMessage({ text: result.message, error: true });
      }
    });
  };

  const settingsDirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const textDirty = text !== lesson.sourceText;
  const dirty = textDirty || settingsDirty;
  // From the deferred parse; the server checks the text again on publish.
  const errors = parsed.issues.filter((i) => i.severity === "error").length;

  // Unsaved work: let the browser ask before leaving.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ARIA tabs: arrows move between tabs, focus follows selection.
  const onTabKey = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next =
      TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length] ?? tab;
    setTab(next);
    tabRefs.current.get(next)?.focus();
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/lessons"
          prefetch={false}
          className="flex w-fit items-center gap-1 text-muted-foreground text-sm hover:underline"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t.back}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-semibold text-2xl">{lesson.meta.title}</h1>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium text-xs",
              statusClass[lesson.status],
            )}
          >
            {adminLessonsCopy.statuses[lesson.status]}
          </span>
          {dirty && (
            <span className="rounded-full border px-2 py-0.5 text-muted-foreground text-xs">
              {t.unsaved}
            </span>
          )}
        </div>
        {lesson.status === "published" && (
          <p className="text-muted-foreground text-sm">
            {lesson.hasDraft ? t.draftSource : t.publishedSource}
          </p>
        )}
        <PublishBar
          lessonId={lesson.id}
          status={lesson.status}
          text={text}
          textDirty={textDirty}
          settingsDirty={settingsDirty}
          hasDraft={lesson.hasDraft}
          hasPublished={lesson.hasPublished}
          errors={errors}
        />
      </header>

      <div className="flex items-end justify-between gap-2 border-b">
        <div
          role="tablist"
          aria-label={t.tabsLabel}
          className="flex gap-1 overflow-x-auto"
        >
          {TABS.map((id) => (
            <button
              key={id}
              ref={(el) => {
                if (el) tabRefs.current.set(id, el);
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={onTabKey}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 font-medium text-sm",
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.tabs[id]}
            </button>
          ))}
        </div>
        {/* A page of its own, not a tab. A plain link, so leaving with unsaved
          work still triggers the browser's "leave page?" prompt. */}
        <a
          href={`/admin/lessons/${lesson.id}/stats`}
          className="mb-1 flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-3 font-medium text-muted-foreground text-sm hover:bg-muted hover:text-foreground"
        >
          <ChartColumn aria-hidden className="size-4" />
          {statsCopy.link}
        </a>
      </div>
      {/* Content and settings stay mounted so the editor keeps its undo history. */}
      <TexProvider texts={texts}>
        <div
          role="tabpanel"
          id="panel-content"
          aria-labelledby="tab-content"
          hidden={tab !== "content"}
        >
          <ContentTab
            initialText={lesson.sourceText}
            onTextChange={setText}
            parsed={parsed}
            config={statsConfig}
          />
        </div>
        <div
          role="tabpanel"
          id="panel-settings"
          aria-labelledby="tab-settings"
          hidden={tab !== "settings"}
        >
          <SettingsTab
            form={form}
            onChange={onChange}
            errorOf={errorOf}
            onTouch={(field) => setTouched((s) => new Set([...s, field]))}
            available={available}
            onSave={save}
            pending={pending}
            message={message}
            sourceText={text}
          />
          <CoverPicker lessonId={lesson.id} coverPath={lesson.coverPath} />
        </div>
        <div
          role="tabpanel"
          id="panel-preview"
          aria-labelledby="tab-preview"
          hidden={tab !== "preview"}
        >
          {/* Mounted only while open: each visit is a fresh try on the latest text. */}
          {tab === "preview" && (
            <PreviewTab
              title={form.title || lesson.meta.title}
              questions={parsed.questions}
              config={settings.ok ? settings.config : lesson.config}
              errors={errors}
            />
          )}
        </div>
      </TexProvider>
    </div>
  );
}
