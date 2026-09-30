import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The top of a page (07 §3): an optional back link, the display title with
 * chips next to it, a lead line and the page's actions on the right. Shared
 * by the student and admin screens so every page starts the same way.
 */
export function PageHeader({
  title,
  lead,
  back,
  badges,
  actions,
  className,
}: {
  title: React.ReactNode;
  lead?: React.ReactNode;
  /** A plain `<a>` when `native` (e.g. to keep a "leave page?" prompt). */
  back?: { href: string; label: string; native?: boolean };
  /** Status chips next to the title. */
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const backClass =
    "-ml-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full px-2 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground";
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1 basis-80 space-y-2">
        {back &&
          (back.native ? (
            <a href={back.href} className={backClass}>
              <ArrowLeft aria-hidden className="size-4" />
              {back.label}
            </a>
          ) : (
            <Link href={back.href} prefetch={false} className={backClass}>
              <ArrowLeft aria-hidden className="size-4" />
              {back.label}
            </Link>
          ))}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="break-words heading-page">{title}</h1>
          {badges}
        </div>
        {lead && <p className="max-w-2xl text-muted-foreground">{lead}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

/** A titled card section: the shape of every settings block and panel. */
export function SectionCard({
  id,
  title,
  lead,
  actions,
  children,
  className,
}: {
  id: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border/70 bg-surface p-5 shadow-card sm:p-6 dark:border-border",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id={id} className="heading-section">
            {title}
          </h2>
          {lead && <p className="text-muted-foreground text-sm">{lead}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
