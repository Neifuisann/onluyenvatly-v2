"use client";

import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Code,
  Columns2,
  Eye,
  FileQuestion,
  ImagePlus,
  Lightbulb,
  ListOrdered,
  Maximize2,
  Minus,
  MoreVertical,
  Plus,
  Redo2,
  Sigma,
  TriangleAlert,
  Undo2,
  WandSparkles,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Dialog } from "@/components/ui/dialog";
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
import {
  insertQuestion,
  mathSnippet,
  questionAtLine,
  renumberQuestions,
  toggleCorrect,
} from "../../domain/editor-commands";
import { editorStats } from "../../domain/editor-stats";
import { type ParseResult, parseLessonText } from "../../domain/parser";
import { QUESTION_TYPES } from "../../domain/question-types";
import { serializeLesson } from "../../domain/serializer";
import {
  questionTypeLabels,
  editorCopy as t,
  workspaceCopy as w,
} from "../../messages";
import type { LessonConfig } from "../../schema";
import type { CodeEditorHandle } from "./code-editor";
import { PreviewQuestion } from "./preview-question";
import { SplitDivider, useSplit } from "./split-divider";
import {
  ToolButton,
  ToolDivider,
  ToolMenu,
  ToolMenuItem,
  ToolMenuLabel,
} from "./toolbar";

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

/** Formula snippets: LaTeX and the glyph shown in the menu. */
const SYMBOLS = [
  ["frac", "\\frac{a}{b}", "a⁄b"],
  ["sqrt", "\\sqrt{x}", "√x"],
  ["pow", "x^{2}", "x²"],
  ["sub", "x_{0}", "x₀"],
  ["vec", "\\vec{F}", "F⃗"],
  ["delta", "\\Delta", "Δ"],
  ["omega", "\\omega", "ω"],
  ["lambda", "\\lambda", "λ"],
  ["pi", "\\pi", "π"],
  ["degree", "^{\\circ}", "°"],
  ["times", "\\cdot", "·"],
  ["approx", "\\approx", "≈"],
] as const;

const ZOOMS = [80, 90, 100, 110, 125, 150] as const;

/** A line in the text pane's status bar (commands and image uploads). */
type Note = { text: string; error: boolean };

/** "split" shows both panes from 1024 px; phones show one at a time. */
type View = "split" | "preview" | "edit";

const isDesktop = () => window.matchMedia("(min-width: 64rem)").matches;

/**
 * Scrolls the preview pane alone to a question's card. `scrollIntoView`
 * would also scroll the workspace's clipped ancestors, hiding the top bar.
 */
function scrollToCard(
  pane: HTMLElement | null,
  index: number,
  block: "start" | "nearest",
) {
  const card = pane?.querySelector<HTMLElement>(`[data-question="${index}"]`);
  if (!pane || !card) return;
  const view = pane.getBoundingClientRect();
  const box = card.getBoundingClientRect();
  const gap = 12;
  let delta = box.top - view.top - gap;
  if (block === "nearest") {
    if (box.top >= view.top && box.bottom <= view.bottom) return;
    // A card taller than the pane shows its top; else the nearer edge.
    if (box.bottom > view.bottom && box.height < view.height)
      delta = box.bottom - view.bottom + gap;
  }
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  pane.scrollBy({ top: delta, behavior: smooth ? "smooth" : "auto" });
}

/**
 * Step 1, "Soạn nội dung" (07 §5.6), a full-screen workspace like Azota and
 * v1's stage-1 editor: the rendered questions on the left and the text on
 * the right, each pane with its own toolbar and scroll, a draggable divider
 * between them. The preview follows the cursor; clicking a question's
 * header puts the cursor on its line and clicking an option's letter
 * changes the key in the text. On phones one pane at a time.
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
  const panes = useRef<HTMLDivElement>(null);
  const previewScroll = useRef<HTMLDivElement>(null);
  const previewId = useId();
  const [view, setView] = useState<View>("split");
  const [ratio, setRatio, saveRatio] = useSplit();
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(100);
  const [explanations, setExplanations] = useState(true);
  const [issuesOpen, setIssuesOpen] = useState(true);
  const [guide, setGuide] = useState(false);
  const [note, setNote] = useState<Note>();

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
  const errorList = issues.filter((i) => i.severity === "error");
  const errors = errorList.length;
  const active = questionAtLine(lines, cursor.line);
  const images = useImageUpload(editor, setNote);

  // The preview follows the cursor: its question's card comes into view,
  // also when the preview is opened (phones) or expanded.
  useEffect(() => {
    if (view !== "edit" && active >= 0)
      scrollToCard(previewScroll.current, active, "nearest");
  }, [active, view]);

  /** Shows the text pane (on phones, or when the preview is expanded). */
  const showEditor = () =>
    setView((v) => (v === "preview" ? (isDesktop() ? "split" : "edit") : v));

  const goTo = (line: number, col?: number) => {
    showEditor();
    // After the pane switch, so the editor is visible to focus.
    requestAnimationFrame(() => editor.current?.goTo(line, col));
  };

  /** Runs a text command on the editor's current document. */
  const command = (run: (h: CodeEditorHandle) => string | undefined) => {
    const h = editor.current;
    if (!h) return;
    const text = run(h);
    setNote(text ? { text, error: false } : undefined);
  };

  const goToQuestion = (n: number) => {
    const line = lines[n - 1];
    if (line === undefined) {
      setNote({ text: w.goToMissing(n), error: true });
      return;
    }
    setNote(undefined);
    scrollToCard(previewScroll.current, n - 1, "start");
    editor.current?.reveal(line);
  };

  const previewHidden =
    view === "edit" ? "hidden" : view === "split" ? "max-lg:hidden" : "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <fieldset className="m-2 mb-0 flex shrink-0 rounded-full bg-muted p-1 lg:hidden">
        <legend className="sr-only">{t.paneLabel}</legend>
        {(["edit", "preview"] as const).map((p) => {
          const Icon = p === "edit" ? Code : Eye;
          const checked =
            p === "preview" ? view === "preview" : view !== "preview";
          return (
            <label
              key={p}
              className={cn(
                "flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full font-semibold text-sm transition-[background-color,color,box-shadow] duration-150 has-focus-visible:outline-2 has-focus-visible:outline-ring",
                checked
                  ? "bg-surface text-foreground shadow-card"
                  : "text-muted-foreground",
              )}
            >
              <input
                type="radio"
                name="editor-pane"
                value={p}
                checked={checked}
                onChange={() => setView(p)}
                className="sr-only"
              />
              <Icon aria-hidden className="size-4" />
              {p === "edit" ? t.paneEdit : t.panePreview}
            </label>
          );
        })}
      </fieldset>

      <div ref={panes} className="flex min-h-0 flex-1">
        {/* ───────────── Preview pane ───────────── */}
        <section
          id={previewId}
          aria-label={t.previewTitle}
          style={view === "split" ? { flexBasis: `${ratio}%` } : undefined}
          className={cn(
            "flex min-h-0 min-w-0 flex-col bg-panel max-lg:flex-1",
            view === "split" ? "lg:shrink-0 lg:grow-0" : "flex-1",
            previewHidden,
          )}
        >
          <div
            role="toolbar"
            aria-label={w.previewTools}
            className="flex shrink-0 flex-wrap items-center gap-1 border-border/70 border-b bg-surface px-2 py-1.5 dark:border-border"
          >
            <output
              aria-label={t.statsTypes}
              className="mr-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 px-1.5 font-semibold text-sm tabular-nums"
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
            <GoToQuestion max={questions.length} onGo={goToQuestion} />
            {/* Phones pinch to zoom; the row stays on one line there. */}
            <div className="flex items-center gap-1 max-sm:hidden">
              <ToolDivider />
              <ToolButton
                icon={Minus}
                label={w.zoomOut}
                compact
                disabled={zoom === ZOOMS[0]}
                onClick={() =>
                  setZoom((z) => ZOOMS[Math.max(ZOOMS.indexOf(z) - 1, 0)] ?? z)
                }
              />
              <button
                type="button"
                onClick={() => setZoom(100)}
                title={w.zoomLevel(zoom)}
                aria-label={w.zoomLevel(zoom)}
                className="h-9 w-12 rounded-md font-semibold text-muted-foreground text-xs tabular-nums hover:bg-muted"
              >
                {zoom}%
              </button>
              <ToolButton
                icon={Plus}
                label={w.zoomIn}
                compact
                disabled={zoom === ZOOMS.at(-1)}
                onClick={() =>
                  setZoom(
                    (z) =>
                      ZOOMS[Math.min(ZOOMS.indexOf(z) + 1, ZOOMS.length - 1)] ??
                      z,
                  )
                }
              />
            </div>
            <ToolButton
              icon={Lightbulb}
              label={w.showExplanations}
              compact
              aria-pressed={explanations}
              onClick={() => setExplanations((e) => !e)}
            />
            <ToolButton
              icon={view === "preview" ? Columns2 : Maximize2}
              label={view === "preview" ? w.restoreSplit : w.expandPreview}
              compact
              className="max-lg:hidden"
              onClick={() => setView(view === "preview" ? "split" : "preview")}
            />
          </div>

          <div
            ref={previewScroll}
            className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 lg:px-6"
          >
            <div
              style={{ zoom: zoom / 100 }}
              className="mx-auto flex max-w-3xl flex-col gap-3"
            >
              {questions.length === 0 ? (
                <EmptyState
                  mascot="idea"
                  title={t.emptyTitle}
                  description={t.emptyBody}
                />
              ) : (
                <>
                  <p className="px-1 text-muted-foreground text-xs">
                    {t.cardHint} {w.markHint}
                  </p>
                  {questions.map((q, i) => (
                    <PreviewQuestion
                      key={q.id}
                      question={q}
                      index={i}
                      points={points[i] ?? 0}
                      hasIssue={withIssue.has(i)}
                      active={i === active}
                      showExplanation={explanations}
                      onGoTo={() => goTo(lines[i] ?? 1)}
                      onMark={
                        q.type === "short"
                          ? undefined
                          : (item) =>
                              command((h) => {
                                h.apply(
                                  toggleCorrect(h.text(), i, q.type, item),
                                );
                                return undefined;
                              })
                      }
                    />
                  ))}
                </>
              )}
            </div>
          </div>

          <section
            aria-labelledby="editor-issues"
            className={cn(
              "shrink-0 border-t px-3 py-2 max-lg:mb-20",
              errors
                ? "border-danger/30 bg-danger-soft"
                : issues.length
                  ? "border-accent/40 bg-accent-soft"
                  : "border-success/30 bg-success-soft",
            )}
          >
            <h2 id="editor-issues" className="font-semibold text-sm">
              <button
                type="button"
                aria-expanded={issues.length > 0 ? issuesOpen : undefined}
                disabled={issues.length === 0}
                onClick={() => setIssuesOpen((o) => !o)}
                title={issuesOpen ? w.issuesHide : w.issuesShow}
                className="flex w-full flex-wrap items-center gap-x-2 rounded-md px-1 py-0.5 text-left disabled:cursor-default"
              >
                {issues.length === 0 ? (
                  <CircleCheck
                    aria-hidden
                    className="size-4 text-success-text"
                  />
                ) : errors ? (
                  <CircleAlert
                    aria-hidden
                    className="size-4 text-danger-text"
                  />
                ) : (
                  <TriangleAlert
                    aria-hidden
                    className="size-4 text-accent-text"
                  />
                )}
                {t.issuesTitle}
                {issues.length === 0 ? (
                  <span className="font-medium text-success-text">
                    {t.noIssues}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "font-medium",
                      errors ? "text-danger-text" : "text-accent-text",
                    )}
                  >
                    {t.issueCount(errors, issues.length - errors)}
                  </span>
                )}
                {issues.length > 0 && (
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "ml-auto size-4 transition-transform",
                      !issuesOpen && "rotate-180",
                    )}
                  />
                )}
              </button>
            </h2>
            {issues.length > 0 && issuesOpen && (
              <ul className="relative mt-1 flex max-h-36 flex-col gap-0.5 overflow-y-auto">
                {issues.map((issue, n) => {
                  const Icon =
                    issue.severity === "error" ? CircleAlert : TriangleAlert;
                  return (
                    <li key={`${issue.line}:${issue.col}:${issue.code}:${n}`}>
                      <button
                        type="button"
                        onClick={() => goTo(issue.line, issue.col)}
                        className="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left text-foreground text-sm hover:bg-surface/70"
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
        </section>

        {view === "split" && (
          <SplitDivider
            ratio={ratio}
            onRatio={setRatio}
            onCommit={saveRatio}
            container={panes}
            controls={previewId}
          />
        )}

        {/* ───────────── Text pane ───────────── */}
        <section
          aria-label={t.paneEdit}
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col bg-surface max-lg:pb-20",
            view === "preview" && "hidden",
          )}
        >
          <div
            role="toolbar"
            aria-label={w.editorTools}
            className="flex shrink-0 flex-wrap items-center gap-0.5 border-border/70 border-b px-2 py-1.5 dark:border-border"
          >
            <ToolButton
              icon={ImagePlus}
              label={uploadCopy.insertImage}
              title={`${uploadCopy.insertImage}. ${uploadCopy.insertHint}`}
              onClick={() => images.pick()}
            />
            <input
              ref={images.input}
              type="file"
              accept={ACCEPT_ATTR}
              multiple
              hidden
              onChange={images.onPicked}
            />
            <ToolMenu icon={Sigma} label={w.formula}>
              {(close) => (
                <>
                  <ToolMenuItem
                    onClick={() => {
                      close();
                      editor.current?.wrap("$", "$");
                    }}
                  >
                    {w.formulaInline}
                  </ToolMenuItem>
                  <ToolMenuItem
                    onClick={() => {
                      close();
                      editor.current?.wrap("$$", "$$");
                    }}
                  >
                    {w.formulaDisplay}
                  </ToolMenuItem>
                  <ToolMenuLabel>{w.symbolsTitle}</ToolMenuLabel>
                  <div className="grid grid-cols-3 gap-0.5">
                    {SYMBOLS.map(([key, tex, glyph]) => (
                      <button
                        key={key}
                        type="button"
                        title={`${w.symbols[key]}: ${tex}`}
                        onClick={() => {
                          close();
                          const h = editor.current;
                          h?.insert(mathSnippet(h.beforeCursor(), tex));
                        }}
                        className="flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-sm hover:bg-muted"
                      >
                        <span aria-hidden className="font-display text-base">
                          {glyph}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {w.symbols[key]}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </ToolMenu>
            <ToolMenu icon={FileQuestion} label={w.addQuestion}>
              {(close) =>
                QUESTION_TYPES.map((type) => (
                  <ToolMenuItem
                    key={type}
                    onClick={() => {
                      close();
                      command((h) => {
                        const added = insertQuestion(
                          h.text(),
                          h.cursorLine(),
                          type,
                        );
                        h.apply(added.edits, { line: added.line, focus: true });
                        return w.addedQuestion(added.number);
                      });
                    }}
                  >
                    {w.addQuestionAs(questionTypeLabels[type])}
                  </ToolMenuItem>
                ))
              }
            </ToolMenu>
            <ToolDivider />
            <ToolButton
              icon={Undo2}
              label={w.undo}
              compact
              onClick={() => editor.current?.undo()}
            />
            <ToolButton
              icon={Redo2}
              label={w.redo}
              compact
              onClick={() => editor.current?.redo()}
            />
            <ToolDivider />
            <ToolMenu icon={MoreVertical} label={w.more} compact>
              {(close) => (
                <>
                  <ToolMenuItem
                    icon={ListOrdered}
                    onClick={() => {
                      close();
                      command((h) => {
                        const edits = renumberQuestions(h.text());
                        h.apply(edits);
                        return w.renumbered(edits.length);
                      });
                    }}
                  >
                    {w.renumber}
                  </ToolMenuItem>
                  <ToolMenuItem
                    icon={WandSparkles}
                    hint={issues.length ? w.reformatBlocked : undefined}
                    disabled={issues.length > 0}
                    onClick={() => {
                      close();
                      command((h) => {
                        const text = h.text();
                        const fresh = parseLessonText(text);
                        if (fresh.issues.length) return w.reformatBlocked;
                        const out = serializeLesson(fresh.questions);
                        if (out === text) return w.reformatUnchanged;
                        h.apply([{ from: 0, to: text.length, insert: out }]);
                        return w.reformatted;
                      });
                    }}
                  >
                    {w.reformat}
                  </ToolMenuItem>
                  <ToolMenuItem
                    icon={Lightbulb}
                    onClick={() => {
                      close();
                      setGuide(true);
                    }}
                  >
                    {w.guide}
                  </ToolMenuItem>
                </>
              )}
            </ToolMenu>
            <ToolButton
              icon={view === "edit" ? Columns2 : Maximize2}
              label={view === "edit" ? w.restoreSplit : w.expandEditor}
              compact
              className="ml-auto max-lg:hidden"
              onClick={() => setView(view === "edit" ? "split" : "edit")}
            />
          </div>

          <div className="min-h-0 flex-1">
            <CodeEditor
              initialValue={initialText}
              onChange={onTextChange}
              onFiles={images.upload}
              onCursor={(line, col) => setCursor({ line, col })}
              label={t.editorLabel}
              handleRef={editor}
            />
          </div>

          <footer className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-border/70 border-t bg-muted/40 px-3 py-1.5 text-muted-foreground text-xs dark:border-border">
            {errors > 0 && (
              <button
                type="button"
                onClick={() => {
                  const first = errorList[0];
                  if (first) goTo(first.line, first.col);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 font-semibold text-danger-text hover:ring-1 hover:ring-danger/40"
              >
                <CircleAlert aria-hidden className="size-3.5" />
                {t.issueCount(errors, 0)}
              </button>
            )}
            {/* <output> is a polite live region (role status). */}
            <output
              className={cn(
                "min-w-0 flex-1 truncate",
                note?.error && "text-danger-text",
              )}
            >
              {note?.text}
            </output>
            <span className="tabular-nums">
              {w.cursorAt(cursor.line, cursor.col)}
            </span>
          </footer>
        </section>
      </div>

      <Dialog
        open={guide}
        onClose={() => setGuide(false)}
        title={w.guide}
        closeLabel={w.guideClose}
      >
        <dl className="grid gap-2 text-sm">
          {w.guideRows.map(([syntax, meaning]) => (
            <div key={syntax} className="grid gap-0.5">
              <dt>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem]">
                  {syntax}
                </code>
              </dt>
              <dd className="text-muted-foreground">{meaning}</dd>
            </div>
          ))}
        </dl>
      </Dialog>
    </div>
  );
}

/** "Đi tới câu [n] Đến" (Azota "Go to question"). */
function GoToQuestion({
  max,
  onGo,
}: {
  max: number;
  onGo: (n: number) => void;
}) {
  const id = useId();
  const [value, setValue] = useState("1");
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value);
        if (Number.isInteger(n) && n >= 1) onGo(n);
      }}
    >
      <label
        htmlFor={id}
        className="whitespace-nowrap px-1 text-muted-foreground text-sm max-xl:sr-only"
      >
        {w.goToLabel}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={Math.max(max, 1)}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={w.goToLabel}
        className="h-9 w-14 rounded-md border border-input bg-surface px-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="submit"
        className="h-9 rounded-md bg-primary px-3 font-semibold text-primary-foreground text-sm hover:bg-primary-hover"
      >
        {w.goTo}
      </button>
    </form>
  );
}

/**
 * Pasted, dropped or picked images (S5-05): each is resized, uploaded
 * straight to Storage and inserted as `![](media:…)` on its own line where
 * it was pasted, even if the text changed meanwhile.
 */
function useImageUpload(
  editor: React.RefObject<CodeEditorHandle | null>,
  report: (note: Note) => void,
) {
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(0);

  const upload = async (files: File[], pos?: number) => {
    const marker = editor.current?.mark(pos);
    if (!marker) return;
    pending.current += files.length;
    report({ text: uploadCopy.uploading(pending.current), error: false });
    let inserted = 0;
    let failure: string | undefined;
    for (const file of files) {
      const result = await uploadImage(file);
      pending.current -= 1;
      if (pending.current > 0)
        report({ text: uploadCopy.uploading(pending.current), error: false });
      if (result.ok) {
        editor.current?.insertLine(
          marker,
          imageMarkup(result.data.path, result.data),
        );
        inserted += 1;
      } else failure = result.message;
    }
    editor.current?.release(marker);
    if (pending.current > 0) return;
    report(
      failure
        ? { text: failure, error: true }
        : { text: uploadCopy.inserted(inserted), error: false },
    );
  };

  return {
    input,
    upload: (files: File[], pos: number) => void upload(files, pos),
    pick: () => input.current?.click(),
    onPicked: (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = [...(e.target.files ?? [])];
      e.target.value = "";
      if (files.length) void upload(files);
    },
  };
}
