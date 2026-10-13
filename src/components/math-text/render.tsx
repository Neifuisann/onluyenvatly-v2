import "server-only";
import katex from "katex";
import type * as React from "react";
import { MathHtml, renderMarkdownLite } from "./render-nodes";

/** ~1–2 KB each: a few MB per instance at most. */
const TEX_CACHE_MAX = 4000;
const texCache = new Map<string, string>();

/**
 * KaTeX on the server only (02 §2, 06 §4): no KaTeX JS reaches the browser.
 * `trust: false` blocks \href, \includegraphics and friends; `maxExpand` and
 * `maxSize` bound macro bombs. `strict: "ignore"` because Vietnamese words in
 * math mode would otherwise log a warning per render.
 *
 * The output depends only on the input, so it is memoised per instance. A
 * plain Map rather than `"use cache"` per text: a 40-question test has
 * hundreds of formulas, and a "use cache" entry each (key hashing, RSC
 * serialisation) was ~30% of the runner's server CPU even when warm.
 */
export function renderTex(tex: string, display: boolean): string {
  const key = `${display ? "D" : "I"}${tex}`;
  const hit = texCache.get(key);
  if (hit !== undefined) return hit;
  const html = katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    trust: false,
    strict: "ignore",
    maxExpand: 1000,
    maxSize: 20,
    output: "htmlAndMathml",
  });
  // Oldest first out: a lesson's formulas are reused together.
  if (texCache.size >= TEX_CACHE_MAX) {
    const oldest = texCache.keys().next().value;
    if (oldest !== undefined) texCache.delete(oldest);
  }
  texCache.set(key, html);
  return html;
}

/** Markdown-lite + LaTeX → React elements. Text is escaped by React. */
export function renderMathText(text: string): React.ReactNode {
  return renderMarkdownLite(text, (tex, display, key) => (
    <MathHtml key={key} html={renderTex(tex, display)} display={display} />
  ));
}
