"use client";

import {
  CircleAlert,
  CircleCheck,
  FileText,
  ImagePlus,
  TriangleAlert,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { editorCopy as t } from "../../messages";
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
            "flex min-w-0 flex-col gap-2 lg:sticky lg:top-4 lg:self-start",
            pane !== "edit" && "max-lg:hidden",
          )}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button
              type="button"
              variant="secondary"
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
          {images.status && (
            <Alert variant={images.status.error ? "danger" : "info"}>
              {images.status.text}
            </Alert>
          )}
          <div className="h-[70dvh] overflow-hidden rounded-lg border bg-surface lg:h-[calc(100dvh-15rem)]">
            <CodeEditor
              initialValue={initialText}
              onChange={onTextChange}
              onFiles={images.upload}
              label={t.editorLabel}
              handleRef={editor}
            />
          </div>
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
          )}
        </section>
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
