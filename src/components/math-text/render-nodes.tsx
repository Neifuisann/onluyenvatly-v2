import type * as React from "react";
import { type Inline, parseMarkdownLite } from "@/lib/markdown-lite";
import { mediaUrl } from "@/lib/media";

/**
 * Markdown-lite AST → React, shared by the server `MathText` and the admin
 * editor's live preview (S5-02) so both render identically. Math is rendered
 * by the caller: KaTeX on the server, or its HTML fetched from the server.
 */
export type RenderMath = (
  tex: string,
  display: boolean,
  key: string,
) => React.ReactNode;

function renderInline(
  nodes: Inline[],
  keyPrefix: string,
  math: RenderMath,
): React.ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}${i}`;
    switch (n.t) {
      case "text":
        return n.v;
      case "br":
        return <br key={key} />;
      case "strong":
        return <strong key={key}>{renderInline(n.c, `${key}.`, math)}</strong>;
      case "em":
        return <em key={key}>{renderInline(n.c, `${key}.`, math)}</em>;
      case "math":
        return math(n.tex, n.display, key);
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
export function renderMarkdownLite(
  text: string,
  math: RenderMath,
): React.ReactNode {
  return parseMarkdownLite(text).map((p, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs of static text
    <p key={i}>{renderInline(p, `${i}.`, math)}</p>
  ));
}

/** A KaTeX HTML string (rendered server-side with `trust: false`) in place. */
export function MathHtml({
  html,
  display,
}: {
  html: string;
  display: boolean;
}) {
  return (
    <span
      className={display ? "math-display" : "math-inline"}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output (trust: false) is the one allowed exception (06 §4)
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
