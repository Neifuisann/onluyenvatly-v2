"use client";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
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
}: {
  initialValue: string;
  onChange: (value: string) => void;
  /** Images pasted or dropped at `pos` (S5-05). */
  onFiles?: (files: File[], pos: number) => void;
  label: string;
  handleRef: RefObject<CodeEditorHandle | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const files = useRef(onFiles);
  files.current = onFiles;
  const markers = useRef(new Set<Marker>());

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
  }));

  return <div ref={host} className="h-full min-h-0" />;
}
