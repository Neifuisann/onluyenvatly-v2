import { clsx } from "clsx";
import Link from "next/link";
import type * as React from "react";
import { LogoMark } from "@/components/logo";
import { Mascot, type MascotPose } from "@/components/mascot";
import { buttonVariants } from "@/components/ui/button";
import { gameCopy } from "../messages";

/**
 * The game's top bar on the ink stage: the brand mark, the room's title
 * and whatever status the screen needs on the right.
 */
export function StageBar({
  title,
  children,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={clsx(
        "flex min-h-14 items-center gap-3 px-4 py-2 sm:px-6",
        className,
      )}
    >
      <Link
        href="/dashboard"
        prefetch={false}
        className="shrink-0 rounded-full"
        aria-label={gameCopy.play.back}
      >
        <LogoMark className="size-9" />
      </Link>
      <p className="min-w-0 flex-1 truncate font-display font-semibold text-ink-foreground">
        {title}
      </p>
      {children}
    </header>
  );
}

/** A full-screen message on the stage: not found, removed, finished. */
export function StageMessage({
  pose,
  title,
  body,
  action = { href: "/dashboard", label: gameCopy.play.back },
}: {
  pose: MascotPose;
  title: string;
  body?: string;
  action?: { href: string; label: string } | null;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md animate-rise flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <Mascot pose={pose} size={160} />
      <h1 className="font-bold font-display text-2xl text-ink-foreground">
        {title}
      </h1>
      {body && <p className="text-balance text-ink-muted">{body}</p>}
      {action && (
        <Link
          href={action.href}
          prefetch={false}
          className={clsx(buttonVariants({ variant: "ink" }), "mt-2")}
        >
          {action.label}
        </Link>
      )}
    </main>
  );
}
