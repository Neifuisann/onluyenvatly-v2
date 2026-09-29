"use client";

import {
  BookOpen,
  ClipboardList,
  House,
  LayoutDashboard,
  type LucideIcon,
  MessageSquareText,
  Repeat,
  ScrollText,
  Settings,
  Sparkles,
  Trophy,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { shellCopy } from "@/lib/messages";
import { cn } from "@/lib/utils";

export type ShellVariant = "student" | "admin";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

const s = shellCopy.studentNav;
const a = shellCopy.adminNavItems;

/** 07 §2 information architecture. */
export const NAV: Record<ShellVariant, NavItem[]> = {
  student: [
    { href: "/dashboard", label: s.dashboard, icon: House },
    { href: "/lessons", label: s.lessons, icon: BookOpen },
    { href: "/review", label: s.review, icon: Repeat },
    { href: "/leaderboard", label: s.leaderboard, icon: Trophy },
    { href: "/profile", label: s.profile, icon: User },
  ],
  admin: [
    { href: "/admin", label: a.overview, icon: LayoutDashboard, exact: true },
    { href: "/admin/lessons", label: a.lessons, icon: BookOpen },
    { href: "/admin/import", label: a.import, icon: Sparkles },
    { href: "/admin/students", label: a.students, icon: Users },
    { href: "/admin/results", label: a.results, icon: ClipboardList },
    {
      href: "/admin/explanations",
      label: a.explanations,
      icon: MessageSquareText,
    },
    { href: "/admin/settings", label: a.settings, icon: Settings },
    { href: "/admin/audit", label: a.audit, icon: ScrollText },
  ],
};

/** Counts shown next to nav items, keyed by `href` (only zero-free ones). */
export type NavBadges = Readonly<Record<string, number>>;

/**
 * Visual only: the link's `aria-label` (`itemLabel`) carries the count. No
 * `sr-only` text here, which is absolutely positioned and would escape the
 * clipping of the scrolling admin strip on phones.
 */
function Badge({ count }: { count: number | undefined }) {
  if (!count) return null;
  return (
    <span
      aria-hidden
      className="num ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 font-bold text-[0.6875rem] text-accent-foreground leading-none"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function itemLabel(item: NavItem, count: number | undefined) {
  return count ? `${item.label}${shellCopy.navBadge(count)}` : undefined;
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Vertical list for the desktop sidebar: the current page sits on a raised pill. */
export function SidebarNav({
  variant,
  badges,
}: {
  variant: ShellVariant;
  badges?: NavBadges | undefined;
}) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV[variant].map((item) => {
        const active = isActive(pathname, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-label={itemLabel(item, badges?.[item.href])}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex min-h-11 items-center gap-3 rounded-md px-3 font-medium text-[0.9375rem] transition-[background-color,color,box-shadow] duration-150",
                active
                  ? "bg-surface text-foreground shadow-card dark:bg-muted"
                  : "text-muted-foreground hover:bg-surface/70 hover:text-foreground dark:hover:bg-muted/60",
              )}
            >
              <item.icon
                aria-hidden
                className={cn(
                  "size-5 transition-colors",
                  active ? "text-primary" : "group-hover:text-foreground",
                )}
                strokeWidth={active ? 2.25 : 1.75}
              />
              {item.label}
              <Badge count={badges?.[item.href]} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Mobile: a floating 5-tab bar for students (thumb zone), a scrolling strip
 * for admins.
 */
export function MobileNav({
  variant,
  badges,
}: {
  variant: ShellVariant;
  badges?: NavBadges | undefined;
}) {
  const pathname = usePathname();
  if (variant === "admin") {
    return (
      <ul className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none]">
        {NAV.admin.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-label={itemLabel(item, badges?.[item.href])}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm transition-colors",
                  active
                    ? "bg-foreground font-semibold text-background"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <item.icon aria-hidden className="size-4" strokeWidth={2} />
                {item.label}
                <Badge count={badges?.[item.href]} />
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-5 rounded-[1.75rem] border border-border/70 bg-surface/85 p-1.5 shadow-raised backdrop-blur-xl dark:border-border dark:bg-surface/80">
      {NAV.student.map((item) => {
        const active = isActive(pathname, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-label={itemLabel(item, badges?.[item.href])}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.375rem] text-[0.6875rem] transition-colors duration-150",
                active
                  ? "bg-primary-soft font-semibold text-foreground"
                  : "text-muted-foreground active:bg-muted",
              )}
            >
              <item.icon
                aria-hidden
                className={cn("size-[1.375rem]", active && "text-primary")}
                strokeWidth={active ? 2.25 : 1.75}
              />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
