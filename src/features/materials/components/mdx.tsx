import Link from "next/link";
import type * as React from "react";
import { materialsCopy as t } from "@/features/materials/messages";

/**
 * The components the converted theory pages use (S8-02). Deliberately
 * unstyled: semantic markup and labels only, with `data-*` hooks for the
 * visual design. The MDX files use nothing else, so restyling happens here.
 */

export type CalloutKind =
  | "definition"
  | "example"
  | "note"
  | "warning"
  | "practice"
  | "solution"
  | "related";

/** A labelled box (definition, example, note, …). */
export function Callout({
  kind = "note",
  children,
}: {
  kind?: CalloutKind;
  children: React.ReactNode;
}) {
  return (
    <aside data-callout={kind} aria-label={t.callout[kind] ?? t.callout.note}>
      {children}
    </aside>
  );
}

/** A key formula (text or KaTeX). */
export function Formula({ children }: { children: React.ReactNode }) {
  return (
    <figure data-formula aria-label={t.callout.formula}>
      {children}
    </figure>
  );
}

/** Tables sit in a labelled region so a wide one can scroll on its own. */
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <section
      data-table
      aria-label={t.table}
      // A table wider than the screen scrolls, so it must take focus (axe).
      // biome-ignore lint/a11y/noNoninteractiveTabindex: scroll container
      tabIndex={0}
    >
      <table>{children}</table>
    </section>
  );
}

/** In-site links go through `Link`; other sites open in a new tab, marked. */
export function MdxLink({ href = "", children }: React.ComponentProps<"a">) {
  if (href.startsWith("/"))
    return (
      <Link href={href} prefetch={false}>
        {children}
      </Link>
    );
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" data-external>
      {children}
      <span> {t.externalHint}</span>
    </a>
  );
}
