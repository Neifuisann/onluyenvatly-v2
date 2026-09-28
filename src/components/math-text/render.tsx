import "server-only";
import katex from "katex";
import type * as React from "react";
import { type Inline, parseMarkdownLite } from "@/lib/markdown-lite";
import { mediaUrl } from "@/lib/media";

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

function renderInline(nodes: Inline[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}${i}`;
    switch (n.t) {
      case "text":
        return n.v;
      case "br":
        return <br key={key} />;
      case "strong":
        return <strong key={key}>{renderInline(n.c, `${key}.`)}</strong>;
      case "em":
        return <em key={key}>{renderInline(n.c, `${key}.`)}</em>;
      case "math":
        return (
          <span
            key={key}
            className={n.display ? "math-display" : "math-inline"}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output (trust: false) is the one allowed exception (06 §4)
            dangerouslySetInnerHTML={{ __html: renderTex(n.tex, n.display) }}
          />
        );
      case "image": {
        const src = mediaUrl(n.path);
        if (!src)
          return (
            <span key={key} className="text-muted-foreground">
              [{n.alt || n.path}]
            </span>
          );
        return (
          // Lesson media skip next/image to save the optimization quota (ADR-006).
          // biome-ignore lint/performance/noImgElement: see ADR-006
          <img
            key={key}
            src={src}
            alt={n.alt}
            {...(n.w && n.h ? { width: n.w, height: n.h } : {})}
            loading="lazy"
            decoding="async"
            className="my-2 inline-block h-auto max-w-full rounded-md"
          />
        );
      }
      default:
        return null;
    }
  });
}

/** Markdown-lite + LaTeX → React elements. Text is escaped by React. */
export function renderMathText(text: string): React.ReactNode {
  return parseMarkdownLite(text).map((p, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs of static text
    <p key={i}>{renderInline(p, `${i}.`)}</p>
  ));
}
