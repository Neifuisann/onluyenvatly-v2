import { ChevronDown, LogOut, MonitorSmartphone, Shield } from "lucide-react";
import Link from "next/link";
import { logout, logoutAll } from "@/features/auth/actions";
import { authCopy, shellCopy } from "@/lib/messages";
import { cn } from "@/lib/utils";

export type ShellUser = { fullName: string; role: "student" | "admin" };

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts.at(-1) ?? "";
  const first = parts.length > 1 ? (parts[0] ?? "") : "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}

/**
 * Native <details> menu: keyboard and screen-reader friendly with no JS.
 * Logout is a form posting to a server action.
 */
export function UserMenu({
  user,
  variant,
  align = "end",
  compact = false,
}: {
  user: ShellUser;
  variant: "student" | "admin";
  align?: "start" | "end";
  /** Avatar only (phone top bar). The name stays available to screen readers. */
  compact?: boolean;
}) {
  const item =
    "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-muted";
  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-2 hover:bg-muted [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary text-xs"
        >
          {initials(user.fullName)}
        </span>
        <span
          className={cn(
            "max-w-40 truncate font-medium text-sm",
            compact && "sr-only",
          )}
        >
          {user.fullName}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 text-muted-foreground transition-transform group-open:rotate-180",
            compact && "hidden",
          )}
        />
      </summary>
      <div
        className={cn(
          "absolute z-40 mt-1 w-64 rounded-lg border bg-surface p-1 shadow-popover",
          align === "end" ? "right-0" : "left-0 bottom-full mb-1",
        )}
      >
        {user.role === "admin" && (
          <Link
            href={variant === "admin" ? "/dashboard" : "/admin"}
            className={item}
          >
            <Shield aria-hidden className="size-5" strokeWidth={1.75} />
            {variant === "admin" ? shellCopy.toStudentView : shellCopy.toAdmin}
          </Link>
        )}
        <form action={logout}>
          <button type="submit" className={item}>
            <LogOut aria-hidden className="size-5" strokeWidth={1.75} />
            {authCopy.logout}
          </button>
        </form>
        <form action={logoutAll}>
          <button type="submit" className={item}>
            <MonitorSmartphone
              aria-hidden
              className="size-5"
              strokeWidth={1.75}
            />
            {authCopy.logoutAll}
          </button>
        </form>
      </div>
    </details>
  );
}
