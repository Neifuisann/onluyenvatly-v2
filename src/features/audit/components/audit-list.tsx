import { UserX } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/app-shell/user-menu";
import { cardClass } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  auditTargetHref,
  shortTargetId,
  summarizeAuditData,
} from "../domain/audit-log";
import { auditCopy as t } from "../messages";
import type { AuditRow } from "../queries";

/**
 * One row per entry: who (students link to their page), what, on which
 * target (linked when it still has a page), the recorded ids and counts,
 * and when. Long list: no prefetch.
 */
export function AuditList({ rows }: { rows: readonly AuditRow[] }) {
  return (
    <ul
      aria-label={t.listLabel}
      className={cn(
        cardClass,
        "divide-y divide-border/70 overflow-hidden dark:divide-border",
      )}
    >
      {rows.map((r) => {
        const when = formatDateTime(r.createdAt);
        const label = t.action(r.action);
        const target = [t.target(r.targetType), shortTargetId(r.targetId)]
          .filter(Boolean)
          .join(" ");
        const href = auditTargetHref(r);
        const details = summarizeAuditData(r.data, t);
        return (
          <li key={r.id} className="flex gap-3 px-4 py-3">
            {r.actorName ? (
              <Avatar
                name={r.actorName}
                className="hidden size-10 bg-primary-soft text-primary sm:flex"
              />
            ) : (
              <span className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground sm:flex">
                <UserX aria-hidden className="size-5" />
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="break-words font-semibold">{label}</p>
                <time
                  dateTime={r.createdAt.toISOString()}
                  className="num shrink-0 text-muted-foreground text-xs"
                >
                  {when}
                </time>
              </div>
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                {r.actorName && r.actorRole === "student" && r.actorId ? (
                  <Link
                    href={`/admin/students/${r.actorId}`}
                    prefetch={false}
                    className="break-words underline-offset-4 hover:underline"
                  >
                    {r.actorName}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      "break-words",
                      !r.actorName && "text-muted-foreground",
                    )}
                  >
                    {r.actorName ?? t.deletedActor}
                  </span>
                )}
                {r.actorRole && (
                  <span className="text-muted-foreground text-xs">
                    {r.actorRole === "admin"
                      ? t.roleAdmin
                      : r.actorRole === "teacher"
                        ? t.roleTeacher
                        : t.roleStudent}
                  </span>
                )}
              </p>
              {(target || details.length > 0) && (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
                  {target &&
                    (href ? (
                      <Link
                        href={href}
                        prefetch={false}
                        aria-label={t.openTarget(target)}
                        className="inline-flex min-h-6 items-center font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        {target}
                      </Link>
                    ) : (
                      <span>{target}</span>
                    ))}
                  {details.map((d) => (
                    <span
                      key={d.key}
                      className="num break-all rounded-full bg-muted px-2 py-0.5 font-mono"
                    >
                      {d.key}: {d.value}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
