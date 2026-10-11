import { Megaphone } from "lucide-react";
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
 * Signed-in frame (07 §2, §4): a sidebar ≥ 1024 px; on phones a slim top bar
 * plus a floating tab bar in the thumb zone (students) or a scrolling nav
 * strip (admins).
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
        className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {shellCopy.skipToContent}
      </a>

      <aside className="sticky top-0 hidden h-dvh w-[17rem] shrink-0 flex-col px-4 pt-5 pb-4 lg:flex">
        <div className="px-2 pb-6">
          <Logo href={home} />
        </div>
        {variant === "admin" && (
          <p className="eyebrow px-3 pb-2 text-muted-foreground">
            {shellCopy.adminBadge}
          </p>
        )}
        <nav
          aria-label={navLabel}
          className="-mx-1 flex-1 overflow-y-auto px-1"
        >
          <SidebarNav
            variant={variant}
            isAdmin={user.role === "admin"}
            badges={badges}
          />
        </nav>
        <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-surface p-1.5 shadow-card dark:border-border">
          <div className="min-w-0 flex-1">
            <UserMenu user={user} variant={variant} align="start" />
          </div>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:py-3 lg:pr-3">
        <header className="sticky top-0 z-30 border-border/60 border-b bg-background/80 backdrop-blur-xl lg:hidden">
          <div className="flex h-14 items-center gap-1 px-2">
            <Logo href={home} className="px-2" narrow />
            <div className="ml-auto flex items-center">
              <ThemeToggle />
              <UserMenu user={user} variant={variant} compact />
            </div>
          </div>
          {variant === "admin" && (
            <nav aria-label={navLabel}>
              <MobileNav
                variant="admin"
                isAdmin={user.role === "admin"}
                badges={badges}
              />
            </nav>
          )}
        </header>

        <div className="flex flex-1 flex-col lg:rounded-xl lg:border lg:border-border/60 lg:bg-panel lg:shadow-card dark:lg:border-border">
          {announcement && (
            <p className="flex items-start gap-2.5 border-accent/40 border-b bg-accent-soft px-4 py-2.5 text-foreground text-sm lg:rounded-t-xl lg:px-8">
              <Megaphone
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-accent-text"
                strokeWidth={2}
              />
              {announcement}
            </p>
          )}

          <main
            id="main"
            tabIndex={-1}
            className={cn(
              "flex-1 px-4 pt-5 pb-8 outline-none sm:px-6 lg:px-10 lg:pt-8 lg:pb-10",
              variant === "student" && "pb-32 lg:pb-10",
            )}
          >
            {children}
          </main>
        </div>
      </div>

      {variant === "student" && (
        <nav
          aria-label={navLabel}
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-md lg:hidden"
        >
          <MobileNav variant="student" isAdmin={false} />
        </nav>
      )}
    </div>
  );
}

/** Shown while the session is being checked (Suspense fallback). */
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-full flex-1">
      <div className="hidden w-[17rem] shrink-0 lg:block" />
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 lg:px-10 lg:py-11">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-40 w-full max-w-3xl rounded-lg" />
        <Skeleton className="h-32 w-full max-w-3xl rounded-lg" />
      </div>
    </div>
  );
}
