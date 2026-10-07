"use client";

import {
  defaultKeymap,
  history,
  historyKeymap,
  redo,
  undo,
} from "@codemirror/commands";
import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { type RefObject, useEffect, useImperativeHandle, useRef } from "react";
import type { TextEdit } from "../../domain/editor-commands";
import { classifyLine } from "../../domain/text-format";

/** A document position that follows edits made after it was taken. */
export type Marker = { pos: number };

export type CodeEditorHandle = {
  /** Moves the cursor to a 1-based line/column and focuses the editor. */
  goTo: (line: number, col?: number) => void;
  /** Remembers a position (default: the cursor) across later edits. */
  mark: (pos?: number) => Marker;
  /**
   * Inserts `text` as its own line at the marker's line (replacing it when
   * blank, else below it) and moves the marker past it, so several
   * inserts keep their order.
   */
  insertLine: (marker: Marker, text: string) => void;
  /** Stops tracking a marker. */
  release: (marker: Marker) => void;
  /** The current document. */
  text: () => string;
  /** 1-based line of the cursor. */
  cursorLine: () => number;
  /** The cursor's line up to the cursor. */
  beforeCursor: () => string;
  /**
   * Applies edits made against `text()` as one undoable change; with
   * `select`, the cursor goes to that 1-based line of the result.
   */
  apply: (
    edits: TextEdit[],
    select?: { line: number; focus?: boolean },
  ) => void;
  /** Puts `before`/`after` around the selection (or at the cursor). */
  wrap: (before: string, after: string) => void;
  /** Inserts text at the cursor, replacing the selection. */
  insert: (text: string) => void;
  /** Shows a 1-based line in the middle of the editor without focusing it. */
  reveal: (line: number) => void;
  undo: () => void;
  redo: () => void;
};

const IMAGE_TYPE = /^image\//;

/** Image files in a paste or drop, if any. */
function imageFiles(data: DataTransfer | null): File[] {
  return [...(data?.files ?? [])].filter((f) => IMAGE_TYPE.test(f.type));
}

/**
 * Highlighting from the parser's own line grammar (04 §3.3): headers,
 * option/statement markers (`*` = correct), `Answer:`, points, `Giải thích:`
 * and `$…$` math.
 */
const lessonText = StreamLanguage.define<null>({
  name: "lesson-text",
  startState: () => null,
  token(stream) {
    if (stream.sol()) {
      const kind = classifyLine(stream.string).kind;
      const prefix: Partial<Record<typeof kind, [RegExp, string]>> = {
        header: [/^câu\s*\d+\s*[:.]/iu, "heading"],
        answer: [/^answer\s*:/iu, "keyword"],
        explanation: [/^giải thích\s*:/iu, "comment"],
        points: [/^.+/u, "number"],
        free: [/^.+/u, "number"],
        image: [/^.+/u, "link"],
      };
      if (kind === "option" || kind === "statement") {
        const correct = stream.peek() === "*";
        if (stream.match(kind === "option" ? /^\*?[A-F]\./u : /^\*?[a-h]\)/u))
          return correct ? "strong" : "keyword";
      }
      const rule = prefix[kind];
      if (rule && stream.match(rule[0])) return rule[1];
    }
    if (stream.peek() === "$") {
      const display = stream.match("$$");
      if (!display) stream.next();
      const close = display ? "$$" : "$";
      const end = stream.string.indexOf(close, stream.pos);
      if (end >= 0) {
        stream.pos = end + close.length;
        return "string";
      }
      return null;
    }
    const next = stream.string.indexOf("$", stream.pos + 1);
    stream.pos = next >= 0 ? next : stream.string.length;
    return null;
  },
});

const highlight = HighlightStyle.define([
  { tag: t.heading, color: "var(--color-primary)", fontWeight: "700" },
  { tag: t.keyword, color: "var(--color-primary)", fontWeight: "600" },
  { tag: t.strong, color: "var(--color-success-text)", fontWeight: "700" },
  { tag: t.number, color: "var(--color-muted-foreground)" },
  { tag: t.link, color: "var(--color-muted-foreground)" },
  {
    tag: t.comment,
    color: "var(--color-muted-foreground)",
    fontStyle: "italic",
  },
  { tag: t.string, color: "var(--color-danger-text)" },
]);

const theme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-foreground)",
    fontSize: "0.9375rem",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    lineHeight: "1.6",
  },
  ".cm-content": { caretColor: "var(--color-foreground)", padding: "8px 0" },
  ".cm-cursor": { borderLeftColor: "var(--color-foreground)" },
  ".cm-gutters": {
    backgroundColor: "var(--color-muted)",
    color: "var(--color-muted-foreground)",
    border: "none",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor:
      "color-mix(in oklch, var(--color-primary) 8%, transparent)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
    {
      backgroundColor:
        "color-mix(in oklch, var(--color-primary) 25%, transparent)",
    },
});

/**
 * CodeMirror 6 for the lesson text (07 §5.6). Loaded with `next/dynamic`
 * (08: admin JS budget). Uncontrolled: it starts from `initialValue` and
 * reports every change. Tab is left to the browser so keyboard users can
 * leave the editor.
 */
export default function CodeEditor({
  initialValue,
  onChange,
  onFiles,
  label,
  handleRef,
  onCursor,
}: {
  initialValue: string;
  onChange: (value: string) => void;
  /** Images pasted or dropped at `pos` (S5-05). */
  onFiles?: (files: File[], pos: number) => void;
  label: string;
  handleRef: RefObject<CodeEditorHandle | null>;
  /** The cursor's 1-based line and column, on every move. */
  onCursor?: (line: number, col: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const files = useRef(onFiles);
  files.current = onFiles;
  const markers = useRef(new Set<Marker>());
  const cursor = useRef(onCursor);
  cursor.current = onCursor;

  // biome-ignore lint/correctness/useExhaustiveDependencies: created once; later values come from the editor itself
  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          lessonText,
          syntaxHighlighting(highlight),
          theme,
          EditorView.contentAttributes.of({
            "aria-label": label,
            "aria-multiline": "true",
            spellcheck: "false",
          }),
          EditorView.updateListener.of((u) => {
            if (u.selectionSet || u.docChanged) {
              const head = u.state.selection.main.head;
              const line = u.state.doc.lineAt(head);
              cursor.current?.(line.number, head - line.from + 1);
            }
            if (!u.docChanged) return;
            for (const m of markers.current) m.pos = u.changes.mapPos(m.pos);
            change.current(u.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            paste(e, v) {
              const images = imageFiles(e.clipboardData);
              if (!images.length || !files.current) return false;
              e.preventDefault();
              files.current(images, v.state.selection.main.head);
              return true;
            },
            drop(e, v) {
              const images = imageFiles(e.dataTransfer);
              if (!images.length || !files.current) return false;
              e.preventDefault();
              const pos =
                v.posAtCoords({ x: e.clientX, y: e.clientY }) ??
                v.state.selection.main.head;
              files.current(images, pos);
              return true;
            },
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
  }, []);

  useImperativeHandle(handleRef, () => ({
    goTo(line, col = 1) {
      const v = view.current;
      if (!v) return;
      const l = v.state.doc.line(
        Math.min(Math.max(line, 1), v.state.doc.lines),
      );
      const pos = Math.min(l.from + Math.max(col - 1, 0), l.to);
      v.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: "center" }),
      });
      v.focus();
    },
    mark(pos) {
      const m = { pos: pos ?? view.current?.state.selection.main.head ?? 0 };
      markers.current.add(m);
      return m;
    },
    insertLine(marker, text) {
      const v = view.current;
      if (!v) return;
      const line = v.state.doc.lineAt(Math.min(marker.pos, v.state.doc.length));
      const blank = line.text.trim() === "";
      const from = blank ? line.from : line.to;
      const insert = blank ? text : `\n${text}`;
      v.dispatch({
        changes: { from, to: line.to, insert },
        selection: { anchor: from + insert.length },
        scrollIntoView: true,
      });
      marker.pos = from + insert.length;
    },
    release(marker) {
      markers.current.delete(marker);
    },
    text: () => view.current?.state.doc.toString() ?? "",
    cursorLine() {
      const v = view.current;
      return v ? v.state.doc.lineAt(v.state.selection.main.head).number : 1;
    },
    beforeCursor() {
      const v = view.current;
      if (!v) return "";
      const head = v.state.selection.main.from;
      return v.state.sliceDoc(v.state.doc.lineAt(head).from, head);
    },
    apply(edits, select) {
      const v = view.current;
      if (!v || edits.length === 0) return;
      const changes = v.state.changes(edits);
      const doc = changes.apply(v.state.doc);
      const pos = select
        ? doc.line(Math.min(Math.max(select.line, 1), doc.lines)).from
        : undefined;
      v.dispatch({
        changes,
        ...(pos !== undefined && {
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: "center" }),
        }),
      });
      if (select?.focus) v.focus();
    },
    wrap(before, after) {
      const v = view.current;
      if (!v) return;
      const { from, to } = v.state.selection.main;
      v.dispatch({
        changes: [
          { from, insert: before },
          { from: to, insert: after },
        ],
        selection:
          from === to
            ? { anchor: from + before.length }
            : { anchor: from + before.length, head: to + before.length },
        scrollIntoView: true,
      });
      v.focus();
    },
    insert(text) {
      const v = view.current;
      if (!v) return;
      v.dispatch(v.state.replaceSelection(text), { scrollIntoView: true });
      v.focus();
    },
    reveal(line) {
      const v = view.current;
      if (!v) return;
      const pos = v.state.doc.line(
        Math.min(Math.max(line, 1), v.state.doc.lines),
      ).from;
      v.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: "center" }),
      });
    },
    undo() {
      if (view.current) undo(view.current);
    },
    redo() {
      if (view.current) redo(view.current);
    },
  }));

  return <div ref={host} className="h-full min-h-0" />;
}
