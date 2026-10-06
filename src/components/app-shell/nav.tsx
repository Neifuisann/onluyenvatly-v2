import {
  BookOpen,
  ClipboardList,
  Flag,
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
import { shellCopy } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { NavLink } from "./nav-link";

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
    { href: "/admin/games", label: a.games, icon: Flag },
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

/** Vertical list for the desktop sidebar: the current page sits on a raised pill. */
export function SidebarNav({
  variant,
  badges,
}: {
  variant: ShellVariant;
  badges?: NavBadges | undefined;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV[variant].map((item) => {
        return (
          <li key={item.href}>
            <NavLink
              href={item.href}
              exact={item.exact}
              label={itemLabel(item, badges?.[item.href])}
              className={cn(
                "group flex min-h-11 items-center gap-3 rounded-md px-3 font-medium text-[0.9375rem] transition-[background-color,color,box-shadow] duration-150",
                "text-muted-foreground hover:bg-surface/70 hover:text-foreground dark:hover:bg-muted/60",
              )}
              selectedClassName="group flex min-h-11 items-center gap-3 rounded-md bg-surface px-3 font-medium text-[0.9375rem] text-foreground shadow-card transition-[background-color,color,box-shadow] duration-150 dark:bg-muted"
            >
              <item.icon
                aria-hidden
                className="size-5 transition-colors group-aria-[current=page]:text-primary group-aria-[current=page]:[stroke-width:2.25]"
                strokeWidth={1.75}
              />
              {item.label}
              <Badge count={badges?.[item.href]} />
            </NavLink>
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
  if (variant === "admin") {
    return (
      <ul className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none]">
        {NAV.admin.map((item) => {
          return (
            <li key={item.href} className="shrink-0">
              <NavLink
                href={item.href}
                exact={item.exact}
                label={itemLabel(item, badges?.[item.href])}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm transition-colors",
                  "text-muted-foreground hover:bg-muted",
                )}
                selectedClassName="flex min-h-11 items-center gap-2 rounded-full bg-foreground px-3.5 font-semibold text-background text-sm transition-colors"
              >
                <item.icon aria-hidden className="size-4" strokeWidth={2} />
                {item.label}
                <Badge count={badges?.[item.href]} />
              </NavLink>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-5 rounded-[1.75rem] border border-border/70 bg-surface/95 p-1.5 shadow-raised backdrop-blur-xl dark:border-border">
      {NAV.student.map((item) => {
        return (
          <li key={item.href}>
            <NavLink
              href={item.href}
              label={itemLabel(item, badges?.[item.href])}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.375rem] text-[0.6875rem] transition-colors duration-150",
                "text-muted-foreground active:bg-muted",
              )}
              selectedClassName="group flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.375rem] bg-primary-soft font-semibold text-[0.6875rem] text-foreground transition-colors duration-150"
            >
              <item.icon
                aria-hidden
                className="size-[1.375rem] group-aria-[current=page]:text-primary group-aria-[current=page]:[stroke-width:2.25]"
                strokeWidth={1.75}
              />
              {item.label}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}
