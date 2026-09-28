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

export type CodeEditorHandle = {
  /** Moves the cursor to a 1-based line/column and focuses the editor. */
  goTo: (line: number, col?: number) => void;
};

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
  label,
  handleRef,
}: {
  initialValue: string;
  onChange: (value: string) => void;
  label: string;
  handleRef: RefObject<CodeEditorHandle | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

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
            if (u.docChanged) change.current(u.state.doc.toString());
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
  }));

  return <div ref={host} className="h-full min-h-0" />;
}
