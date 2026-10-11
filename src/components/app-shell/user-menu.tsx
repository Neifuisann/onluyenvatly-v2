import {
  ChevronsUpDown,
  LogOut,
  MonitorSmartphone,
  Settings,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { logout, logoutAll } from "@/features/auth/actions";
import { mediaUrl } from "@/lib/media";
import { authCopy, shellCopy } from "@/lib/messages";
import { cn } from "@/lib/utils";

export type ShellUser = {
  fullName: string;
  role: "student" | "teacher" | "admin";
  avatarPath?: string | null;
};

const roleLabel = {
  student: shellCopy.roleStudent,
  teacher: shellCopy.roleTeacher,
  admin: shellCopy.roleAdmin,
} as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts.at(-1) ?? "";
  const first = parts.length > 1 ? (parts[0] ?? "") : "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}

/**
 * The profile picture, or initials on a lagoon disc when there is none. The
 * name is always next to it or in the label, so the image is decorative.
 */
export function Avatar({
  name,
  path,
  className,
}: {
  name: string;
  /** Storage path of the uploaded picture (S8-04). */
  path?: string | null | undefined;
  className?: string;
}) {
  const src = path ? mediaUrl(path) : null;
  if (src)
    return (
      // biome-ignore lint/performance/noImgElement: ADR-006, pre-sized upload
      <img
        src={src}
        alt=""
        width={36}
        height={36}
        loading="lazy"
        decoding="async"
        className={cn(
          "size-9 shrink-0 rounded-full bg-muted object-cover",
          className,
        )}
      />
    );
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-xs tracking-wide",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
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
    "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left font-medium text-sm transition-colors hover:bg-muted";
  return (
    <details className="group relative">
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-md transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden",
          compact ? "px-1.5" : "px-1.5 py-1",
        )}
      >
        <Avatar
          name={user.fullName}
          path={user.avatarPath}
          className={cn(compact && "size-8")}
        />
        <span className={cn("min-w-0 flex-1 text-left", compact && "sr-only")}>
          <span className="block truncate font-semibold text-sm leading-tight">
            {user.fullName}
          </span>
          <span className="block text-muted-foreground text-xs">
            {roleLabel[user.role]}
          </span>
        </span>
        <ChevronsUpDown
          aria-hidden
          className={cn("size-4 text-muted-foreground", compact && "hidden")}
        />
      </summary>
      <div
        className={cn(
          "absolute z-40 w-64 animate-pop rounded-lg border border-border/70 bg-surface p-1.5 shadow-popover dark:border-border",
          align === "end" ? "top-full right-0 mt-2" : "bottom-full left-0 mb-3",
        )}
      >
        {user.role !== "student" && (
          <Link
            href={variant === "admin" ? "/dashboard" : "/admin"}
            className={item}
            prefetch={false}
          >
            <Shield aria-hidden className="size-5" strokeWidth={1.75} />
            {variant === "admin" ? shellCopy.toStudentView : shellCopy.toAdmin}
          </Link>
        )}
        <Link href="/settings" prefetch={false} className={item}>
          <Settings aria-hidden className="size-5" strokeWidth={1.75} />
          {shellCopy.accountSettings}
        </Link>
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
