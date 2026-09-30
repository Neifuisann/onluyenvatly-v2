import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/app-shell/user-menu";
import { cardClass } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { StudentListRow } from "../admin-queries";
import { studentsCopy as t } from "../messages";
import { StatusBadge } from "./status-badge";

/** One row per student, each linking to the detail page (no prefetch: long list). */
export function StudentList({ rows }: { rows: readonly StudentListRow[] }) {
  return (
    <ul
      aria-label={t.listLabel}
      className={cn(
        cardClass,
        "divide-y divide-border/70 overflow-hidden dark:divide-border",
      )}
    >
      {rows.map((s) => (
        <li key={s.id}>
          <Link
            href={`/admin/students/${s.id}`}
            prefetch={false}
            className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <Avatar
              name={s.fullName}
              className="size-10 bg-primary-soft text-primary"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="break-words font-semibold">{s.fullName}</span>
                <StatusBadge status={s.status} />
              </div>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {[
                  s.phone,
                  [s.className, s.grade && t.gradeShort(s.grade)]
                    .filter(Boolean)
                    .join(" · "),
                  s.rating === null ? t.unrated : t.rating(s.rating),
                  s.lastLoginAt
                    ? t.lastLogin(formatDateTime(s.lastLoginAt))
                    : t.neverLoggedIn,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <ChevronRight
              aria-hidden
              className="size-5 shrink-0 text-muted-foreground transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-primary"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
