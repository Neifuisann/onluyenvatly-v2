"use client";

import {
  CircleAlert,
  CircleCheck,
  Code,
  Eye,
  ImagePlus,
  TriangleAlert,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { pointsPlan } from "@/features/grading/domain/points";
import {
  ACCEPT_ATTR,
  uploadImage,
} from "@/features/media/components/upload-image";
import { imageMarkup } from "@/features/media/domain/upload";
import { uploadCopy } from "@/features/media/messages";
import { formatScore } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { editorStats } from "../../domain/editor-stats";
import type { ParseResult } from "../../domain/parser";
import { publishCopy, editorCopy as t } from "../../messages";
import type { LessonConfig } from "../../schema";
import type { CodeEditorHandle } from "./code-editor";
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

/**
 * Step 1, "Soạn nội dung" (S5-02, 07 §5.6): the rendered question cards on
 * the left (validation, stats, each card jumps to its line) and the text
 * editor on the right, as in v1. On phones one pane at a time.
 */
export function ContentStep({
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
  const images = useImageUpload(editor);

  const goTo = (line: number, col?: number) => {
    setPane("edit");
    // After the pane switch on phones, so the editor is visible to focus.
    requestAnimationFrame(() => editor.current?.goTo(line, col));
  };

  return (
    <div className="flex flex-col gap-3">
      {errors > 0 && (
        // Everywhere, since on phones the issue list sits in the other pane.
        <p className="flex items-start gap-2 text-danger-text text-sm">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {publishCopy.hasErrors(errors)}
        </p>
      )}
      <fieldset className="flex rounded-full bg-muted p-1 lg:hidden">
        <legend className="sr-only">{t.paneLabel}</legend>
        {(["edit", "preview"] as const).map((p) => {
          const Icon = p === "edit" ? Code : Eye;
          return (
            <label
              key={p}
              className={cn(
                "flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full font-semibold text-sm transition-[background-color,color,box-shadow] duration-150 has-focus-visible:outline-2 has-focus-visible:outline-ring",
                pane === p
                  ? "bg-surface text-foreground shadow-card"
                  : "text-muted-foreground",
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
              <Icon aria-hidden className="size-4" />
              {p === "edit" ? t.paneEdit : t.panePreview}
            </label>
          );
        })}
      </fieldset>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <section
          aria-label={t.previewTitle}
          className={cn(
            "flex min-w-0 flex-col gap-3",
            pane !== "preview" && "max-lg:hidden",
          )}
        >
          <output
            aria-label={t.statsTypes}
            className="z-10 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-full border border-border/70 bg-surface/95 px-4 py-2.5 font-semibold text-sm tabular-nums shadow-card backdrop-blur lg:sticky lg:top-[5.25rem] dark:border-border"
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
              <span className="font-medium text-muted-foreground">
                {t.perAttempt(
                  stats.perAttempt.total,
                  stats.perAttempt.points === null
                    ? null
                    : formatScore(stats.perAttempt.points),
                )}
              </span>
            )}
          </output>

          <section
            aria-labelledby="editor-issues"
            className={cn(
              "rounded-lg border p-3.5",
              errors
                ? "border-danger/30 bg-danger-soft"
                : issues.length
                  ? "border-accent/40 bg-accent-soft"
                  : "border-success/30 bg-success-soft",
            )}
          >
            <h2
              id="editor-issues"
              className="flex flex-wrap items-center gap-x-2 font-semibold text-sm"
            >
              {t.issuesTitle}
              {issues.length > 0 && (
                <span
                  className={cn(
                    "font-medium",
                    errors ? "text-danger-text" : "text-accent-text",
                  )}
                >
                  {t.issueCount(errors, issues.length - errors)}
                </span>
              )}
            </h2>
            {issues.length === 0 ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-success-text">
                <CircleCheck aria-hidden className="size-4" />
                {t.noIssues}
              </p>
            ) : (
              <ul className="mt-2 flex max-h-44 flex-col gap-0.5 overflow-y-auto">
                {issues.map((issue, n) => {
                  const Icon =
                    issue.severity === "error" ? CircleAlert : TriangleAlert;
                  return (
                    <li key={`${issue.line}:${issue.col}:${issue.code}:${n}`}>
                      <button
                        type="button"
                        onClick={() => goTo(issue.line, issue.col)}
                        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-foreground text-sm hover:bg-surface/70"
                      >
                        <Icon
                          aria-hidden
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            issue.severity === "error"
                              ? "text-danger-text"
                              : "text-accent-text",
                          )}
                        />
                        <span>
                          <span className="font-semibold">
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

          {questions.length === 0 ? (
            <EmptyState
              mascot="idea"
              title={t.emptyTitle}
              description={t.emptyBody}
            />
          ) : (
            <>
              <p className="px-1 text-muted-foreground text-xs">{t.cardHint}</p>
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
            </>
          )}
        </section>

        <div
          className={cn(
            "flex min-w-0 flex-col gap-2 lg:sticky lg:top-[5.25rem] lg:self-start",
            pane !== "edit" && "max-lg:hidden",
          )}
        >
          <div
            className={cn(
              cardClass,
              "flex h-[70dvh] flex-col overflow-hidden lg:h-[calc(100dvh-6.5rem)]",
            )}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/40 px-2 py-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => images.pick()}
              >
                <ImagePlus aria-hidden />
                {uploadCopy.insertImage}
              </Button>
              <input
                ref={images.input}
                type="file"
                accept={ACCEPT_ATTR}
                multiple
                hidden
                onChange={images.onPicked}
              />
              <span className="text-muted-foreground text-xs">
                {uploadCopy.insertHint}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <CodeEditor
                initialValue={initialText}
                onChange={onTextChange}
                onFiles={images.upload}
                label={t.editorLabel}
                handleRef={editor}
              />
            </div>
          </div>
          {images.status && (
            <Alert variant={images.status.error ? "danger" : "info"}>
              {images.status.text}
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Pasted, dropped or picked images (S5-05): each is resized, uploaded
 * straight to Storage and inserted as `![](media:…)` on its own line where
 * it was pasted, even if the text changed meanwhile.
 */
function useImageUpload(editor: React.RefObject<CodeEditorHandle | null>) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);
  const [status, setStatus] = useState<{ text: string; error: boolean }>();

  const upload = async (files: File[], pos?: number) => {
    const marker = editor.current?.mark(pos);
    if (!marker) return;
    setPending((n) => n + files.length);
    setStatus({ text: uploadCopy.uploading(files.length), error: false });
    let inserted = 0;
    let failure: string | undefined;
    for (const file of files) {
      const result = await uploadImage(file);
      setPending((n) => n - 1);
      if (result.ok) {
        editor.current?.insertLine(
          marker,
          imageMarkup(result.data.path, result.data),
        );
        inserted += 1;
      } else failure = result.message;
    }
    editor.current?.release(marker);
    setStatus(
      failure
        ? { text: failure, error: true }
        : { text: uploadCopy.inserted(inserted), error: false },
    );
  };

  return {
    input,
    status:
      pending > 0
        ? { text: uploadCopy.uploading(pending), error: false }
        : status,
    upload: (files: File[], pos: number) => void upload(files, pos),
    pick: () => input.current?.click(),
    onPicked: (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = [...(e.target.files ?? [])];
      e.target.value = "";
      if (files.length) void upload(files);
    },
  };
}
