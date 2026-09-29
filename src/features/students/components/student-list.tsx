import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "@/lib/dates";
import type { StudentListRow } from "../admin-queries";
import { studentsCopy as t } from "../messages";
import { StatusBadge } from "./status-badge";

/** One row per student, each linking to the detail page (no prefetch: long list). */
export function StudentList({ rows }: { rows: readonly StudentListRow[] }) {
  return (
    <ul
      aria-label={t.listLabel}
      className="divide-y rounded-lg border border-border/70 bg-surface shadow-card dark:border-border"
    >
      {rows.map((s) => (
        <li key={s.id}>
          <Link
            href={`/admin/students/${s.id}`}
            prefetch={false}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="break-words font-medium">{s.fullName}</span>
                <StatusBadge status={s.status} />
              </div>
              <p className="mt-1 text-muted-foreground text-xs">
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
              className="size-5 shrink-0 text-muted-foreground"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
