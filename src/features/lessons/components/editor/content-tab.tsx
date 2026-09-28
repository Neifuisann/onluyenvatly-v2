"use client";

import {
  CircleAlert,
  CircleCheck,
  FileText,
  TriangleAlert,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { pointsPlan } from "@/features/grading/domain/points";
import { formatScore } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { editorStats } from "../../domain/editor-stats";
import type { ParseResult } from "../../domain/parser";
import { editorCopy as t } from "../../messages";
import type { LessonConfig, Question } from "../../schema";
import type { CodeEditorHandle } from "./code-editor";
import { TexProvider } from "./preview-math";
import { PreviewQuestion } from "./preview-question";

// CodeMirror stays out of every other admin page's bundle (08 §1).
const CodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

function EditorSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-2 p-3">
      <span className="sr-only">{t.editorLoading}</span>
      {["a", "b", "c", "d", "e"].map((k) => (
        <Skeleton key={k} className="h-5 w-full" />
      ))}
    </div>
  );
}

/** Every piece of text a question shows, for the KaTeX batch. */
function textsOf(questions: readonly Question[]): string[] {
  return questions.flatMap((q) => [
    q.stem,
    q.explanation ?? "",
    ...(q.type === "mcq" ? q.options.map((o) => o.text) : []),
    ...(q.type === "tf" ? q.statements.map((s) => s.text) : []),
  ]);
}

/**
 * "Nội dung" tab (S5-02, 07 §5.6): CodeMirror on the left, and on the right
 * the validation panel (each issue jumps to its line), the live preview and
 * the stats bar. On phones the two panes are toggled.
 */
export function ContentTab({
  initialText,
  onTextChange,
  parsed,
  config,
}: {
  initialText: string;
  onTextChange: (text: string) => void;
  parsed: ParseResult;
  config: Pick<LessonConfig, "pool" | "points">;
}) {
  const editor = useRef<CodeEditorHandle | null>(null);
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  const { questions, issues, lines } = parsed;
  const texts = useMemo(() => textsOf(questions), [questions]);
  const points = useMemo(
    () => pointsPlan(questions, config.points),
    [questions, config.points],
  );
  const stats = useMemo(
    () => editorStats(questions, config),
    [questions, config],
  );
  const withIssue = useMemo(
    () =>
      new Set(
        issues
          .filter((i) => i.severity === "error")
          .map((i) => i.questionIndex),
      ),
    [issues],
  );
  const errors = issues.filter((i) => i.severity === "error").length;

  const goTo = (line: number, col?: number) => {
    setPane("edit");
    // After the pane switch on phones, so the editor is visible to focus.
    requestAnimationFrame(() => editor.current?.goTo(line, col));
  };

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex gap-1 rounded-md border bg-surface p-1 lg:hidden">
        <legend className="sr-only">{t.paneLabel}</legend>
        {(["edit", "preview"] as const).map((p) => (
          <label
            key={p}
            className={cn(
              "flex h-9 flex-1 cursor-pointer items-center justify-center rounded text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring",
              pane === p
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            <input
              type="radio"
              name="editor-pane"
              value={p}
              checked={pane === p}
              onChange={() => setPane(p)}
              className="sr-only"
            />
            {p === "edit" ? t.paneEdit : t.panePreview}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className={cn(
            "h-[70dvh] overflow-hidden rounded-lg border bg-surface lg:sticky lg:top-4 lg:h-[calc(100dvh-12rem)]",
            pane !== "edit" && "max-lg:hidden",
          )}
        >
          <CodeEditor
            initialValue={initialText}
            onChange={onTextChange}
            label={t.editorLabel}
            handleRef={editor}
          />
        </div>

        <section
          aria-label={t.previewTitle}
          className={cn(
            "flex min-w-0 flex-col gap-4",
            pane !== "preview" && "max-lg:hidden",
          )}
        >
          <section
            aria-labelledby="editor-issues"
            className="rounded-lg border bg-surface p-3"
          >
            <h2
              id="editor-issues"
              className="flex items-center gap-2 font-semibold text-sm"
            >
              {t.issuesTitle}
              <span
                className={cn(
                  "font-normal",
                  errors ? "text-danger-text" : "text-muted-foreground",
                )}
              >
                {issues.length
                  ? t.issueCount(errors, issues.length - errors)
                  : ""}
              </span>
            </h2>
            {issues.length === 0 ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-success-text">
                <CircleCheck aria-hidden className="size-4" />
                {t.noIssues}
              </p>
            ) : (
              <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
                {issues.map((issue, n) => {
                  const Icon =
                    issue.severity === "error" ? CircleAlert : TriangleAlert;
                  return (
                    <li key={`${issue.line}:${issue.col}:${issue.code}:${n}`}>
                      <button
                        type="button"
                        onClick={() => goTo(issue.line, issue.col)}
                        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        <Icon
                          aria-hidden
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            issue.severity === "error"
                              ? "text-danger-text"
                              : "text-muted-foreground",
                          )}
                        />
                        <span>
                          <span className="font-medium">
                            {t.issueAt(issue.line, issue.col)}
                          </span>
                          <span className="sr-only">
                            {" "}
                            ({issue.severity === "error" ? t.error : t.warning})
                          </span>
                          : {issue.message}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <output
            aria-label={t.statsTypes}
            className="sticky top-0 z-10 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border bg-surface px-3 py-2 font-medium text-sm tabular-nums shadow-card"
          >
            <span>
              {t.stats(
                stats.total,
                stats.counts.mcq,
                stats.counts.tf,
                stats.counts.short,
                formatScore(stats.points),
              )}
            </span>
            {stats.perAttempt && (
              <span className="text-muted-foreground">
                {t.perAttempt(
                  stats.perAttempt.total,
                  stats.perAttempt.points === null
                    ? null
                    : formatScore(stats.perAttempt.points),
                )}
              </span>
            )}
          </output>

          {questions.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t.emptyTitle}
              description={t.emptyBody}
            />
          ) : (
            <TexProvider texts={texts}>
              <div className="flex flex-col gap-3">
                {questions.map((q, i) => (
                  <PreviewQuestion
                    key={q.id}
                    question={q}
                    index={i}
                    points={points[i] ?? 0}
                    hasIssue={withIssue.has(i)}
                    onGoTo={() => goTo(lines[i] ?? 1)}
                  />
                ))}
              </div>
            </TexProvider>
          )}
        </section>
      </div>
    </div>
  );
}
