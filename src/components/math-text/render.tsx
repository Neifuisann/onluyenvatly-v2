import "server-only";
import katex from "katex";
import type * as React from "react";
import { MathHtml, renderMarkdownLite } from "./render-nodes";

/**
 * KaTeX on the server only (02 §2, 06 §4): no KaTeX JS reaches the browser.
 * `trust: false` blocks \href, \includegraphics and friends; `maxExpand` and
 * `maxSize` bound macro bombs. `strict: "ignore"` because Vietnamese words in
 * math mode would otherwise log a warning per render.
 */
export function renderTex(tex: string, display: boolean): string {
  return katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    trust: false,
    strict: "ignore",
    maxExpand: 1000,
    maxSize: 20,
    output: "htmlAndMathml",
  });
}

/** Markdown-lite + LaTeX → React elements. Text is escaped by React. */
export function renderMathText(text: string): React.ReactNode {
  return renderMarkdownLite(text, (tex, display, key) => (
    <MathHtml key={key} html={renderTex(tex, display)} display={display} />
  ));
}
