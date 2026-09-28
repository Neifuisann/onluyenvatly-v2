"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { parseLessonText } from "../../domain/parser";
import { adminLessonsCopy, editorCopy as t } from "../../messages";
import type { LessonConfig, Question } from "../../schema";
import { ContentTab } from "./content-tab";

export type EditorLesson = {
  id: number;
  title: string;
  status: "draft" | "published" | "archived";
  sourceText: string;
  /** Last saved questions, so new parses keep their ids (04 §3.1). */
  previous: Question[];
  config: LessonConfig;
  hasDraft: boolean;
};

const statusClass = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-success/15 text-success-text",
  archived: "bg-warning/25 text-foreground",
} as const;

/**
 * `/admin/lessons/[id]/edit` (07 §5.6). Holds the text being edited; the
 * parse runs on a deferred copy so typing stays smooth on long lessons.
 * Saving and publishing arrive with S5-04.
 */
export function LessonEditor({ lesson }: { lesson: EditorLesson }) {
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
  const dirty = text !== lesson.sourceText;

  // Unsaved work: let the browser ask before leaving.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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
          <h1 className="font-semibold text-2xl">{lesson.title}</h1>
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
      </header>

      <div
        role="tablist"
        aria-label={t.tabsLabel}
        className="flex gap-1 border-b"
      >
        <button
          type="button"
          role="tab"
          id="tab-content"
          aria-selected
          aria-controls="panel-content"
          className="-mb-px border-primary border-b-2 px-4 py-2 font-medium text-primary text-sm"
        >
          {t.tabs.content}
        </button>
      </div>
      <div role="tabpanel" id="panel-content" aria-labelledby="tab-content">
        <ContentTab
          initialText={lesson.sourceText}
          onTextChange={setText}
          parsed={parsed}
          config={lesson.config}
        />
      </div>
    </div>
  );
}
