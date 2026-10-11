import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { cardClass } from "@/components/ui/card";
import { subjectLabel } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { classesCopy as t } from "../../messages";
import type { TeacherClassRow } from "../../queries";

/**
 * The teacher's classes as cards (B-03): name, subject, counts; with
 * `showOwner` (an admin's list of every class) the class's teacher too.
 */
export function ClassList({
  rows,
  showOwner = false,
}: {
  rows: readonly TeacherClassRow[];
  showOwner?: boolean;
}) {
  return (
    <ul aria-label={t.listLabel} className="grid gap-3 sm:grid-cols-2">
      {rows.map((c) => (
        <li key={c.id}>
          <Link
            href={`/admin/classes/${c.id}`}
            prefetch={false}
            className={cn(
              cardClass,
              "group flex h-full items-center gap-4 p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised sm:p-5",
            )}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Users aria-hidden className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="break-words font-semibold">{c.name}</span>
                {c.archivedAt && (
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
                    {t.archivedBadge}
                  </span>
                )}
              </span>
              <span className="block text-muted-foreground text-sm">
                {[
                  showOwner ? t.teacher(c.ownerName) : null,
                  subjectLabel(c.subject),
                  c.grade ? t.gradeOption(c.grade) : null,
                  t.members(c.members),
                  t.lessons(c.lessons),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <ChevronRight
              aria-hidden
              className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
