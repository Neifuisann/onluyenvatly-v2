import type * as React from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { shellCopy } from "@/lib/messages";
import { cn } from "@/lib/utils";
import {
  MobileNav,
  type NavBadges,
  type ShellVariant,
  SidebarNav,
} from "./nav";
import { type ShellUser, UserMenu } from "./user-menu";

/**
 * Signed-in frame (07 §2, §4): left sidebar ≥ 1024 px; on phones a top bar
 * plus bottom tabs (students) or a scrolling nav strip (admins).
 */
export function AppShell({
  user,
  variant,
  announcement,
  badges,
  children,
}: {
  user: ShellUser;
  variant: ShellVariant;
  announcement?: string | null;
  /** Counts next to nav items, keyed by `href`. */
  badges?: NavBadges | undefined;
  children: React.ReactNode;
}) {
  const home = variant === "admin" ? "/admin" : "/dashboard";
  const navLabel = variant === "admin" ? shellCopy.adminNav : shellCopy.mainNav;
  return (
    <div className="flex min-h-full flex-1">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {shellCopy.skipToContent}
      </a>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-surface lg:flex">
        <div className="px-4 py-3">
          <Logo href={home} />
        </div>
        <nav aria-label={navLabel} className="flex-1 overflow-y-auto px-3 py-2">
          <SidebarNav variant={variant} badges={badges} />
        </nav>
        <div className="flex items-center gap-1 border-t p-3">
          <div className="min-w-0 flex-1">
            <UserMenu user={user} variant={variant} align="start" />
          </div>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center gap-1 px-2">
            <Logo href={home} className="px-2" />
            <div className="ml-auto flex items-center">
              <ThemeToggle />
              <UserMenu user={user} variant={variant} compact />
            </div>
          </div>
          {variant === "admin" && (
            <nav aria-label={navLabel}>
              <MobileNav variant="admin" badges={badges} />
            </nav>
          )}
        </header>

        {announcement && (
          <p className="border-b bg-accent px-4 py-2 text-accent-foreground text-sm">
            {announcement}
          </p>
        )}

        <main
          id="main"
          tabIndex={-1}
          className={cn(
            "flex-1 px-4 py-6 outline-none lg:px-8",
            variant === "student" && "pb-24 lg:pb-6",
          )}
        >
          {children}
        </main>
      </div>

      {variant === "student" && (
        <nav
          aria-label={navLabel}
          className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <MobileNav variant="student" />
        </nav>
      )}
    </div>
  );
}

/** Shown while the session is being checked (Suspense fallback). */
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-full flex-1">
      <div className="hidden w-64 shrink-0 border-r bg-surface lg:block" />
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 lg:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full max-w-3xl" />
        <Skeleton className="h-32 w-full max-w-3xl" />
      </div>
    </div>
  );
}
