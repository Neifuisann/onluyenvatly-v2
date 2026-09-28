"use client";

import "katex/dist/katex.min.css";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  MathHtml,
  renderMarkdownLite,
} from "@/components/math-text/render-nodes";
import { type MathSegment, mathSegments } from "@/lib/markdown-lite";
import { cn } from "@/lib/utils";
import { renderTexBatch } from "../../admin-actions";
import type { Question } from "../../schema";

const key = (tex: string, display: boolean) => `${display ? "D" : "I"}${tex}`;

const TexContext = createContext<ReadonlyMap<string, string>>(new Map());

/** Formulas per request; the action accepts up to 300. */
const BATCH = 300;

/**
 * KaTeX HTML for every formula in `texts`, fetched from the server in
 * batches (KaTeX never ships to the browser, 06 §4) and kept for the session,
 * so typing only asks for formulas that are new.
 */
export function TexProvider({
  texts,
  children,
}: {
  texts: readonly string[];
  children: ReactNode;
}) {
  const [cache, setCache] = useState<ReadonlyMap<string, string>>(new Map());
  const requested = useRef(new Set<string>());

  // biome-ignore lint/correctness/useExhaustiveDependencies: `cache` re-runs it after each batch, so a long lesson loads batch by batch
  useEffect(() => {
    const missing = new Map<string, MathSegment>();
    for (const text of texts)
      for (const s of mathSegments(text)) {
        const k = key(s.tex, s.display);
        if (!requested.current.has(k)) missing.set(k, s);
      }
    if (missing.size === 0) return;
    const timer = setTimeout(async () => {
      const entries = [...missing].slice(0, BATCH);
      for (const [k] of entries) requested.current.add(k);
      const result = await renderTexBatch(entries.map(([, s]) => s)).catch(
        () => null,
      );
      if (!result?.ok) {
        // Let the next edit try again.
        for (const [k] of entries) requested.current.delete(k);
        return;
      }
      setCache((prev) => {
        const next = new Map(prev);
        entries.forEach(([k], i) => {
          const html = result.data[i];
          if (html !== undefined) next.set(k, html);
        });
        return next;
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [texts, cache]);

  return <TexContext value={cache}>{children}</TexContext>;
}

/** A fixed formula cache (tests; server-rendered previews). */
export function StaticTex({
  cache,
  children,
}: {
  cache: ReadonlyMap<string, string>;
  children: ReactNode;
}) {
  return <TexContext value={cache}>{children}</TexContext>;
}

/** Cache key of a formula. */
export const texKey = key;

/**
 * The editor's `MathText`: the same Markdown-lite rendering and classes as
 * the student pages; a formula shows as its source until its HTML arrives.
 */
export function PreviewMathText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const cache = useContext(TexContext);
  return (
    <div className={cn("math-text", className)}>
      {renderMarkdownLite(text, (tex, display, k) => {
        const html = cache.get(key(tex, display));
        return html ? (
          <MathHtml key={k} html={html} display={display} />
        ) : (
          <code key={k} className="rounded bg-muted px-1 text-sm">
            {display ? `$$${tex}$$` : `$${tex}$`}
          </code>
        );
      })}
    </div>
  );
}

/** Every piece of text a question shows, for the KaTeX batch. */
export function questionTexts(questions: readonly Question[]): string[] {
  return questions.flatMap((q) => [
    q.stem,
    q.explanation ?? "",
    ...(q.type === "mcq" ? q.options.map((o) => o.text) : []),
    ...(q.type === "tf" ? q.statements.map((s) => s.text) : []),
  ]);
}
