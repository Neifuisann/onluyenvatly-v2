import { ChevronRight, School } from "lucide-react";
import Link from "next/link";
import { cardClass } from "@/components/ui/card";
import { subjectLabel } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { classesCopy as t } from "../messages";
import type { StudentClassRow } from "../queries";

/** The student's classes (B-03): pick one to see its lessons. */
export function ClassCards({ rows }: { rows: readonly StudentClassRow[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((c) => (
        <li key={c.id}>
          <Link
            href={`/classes/${c.id}`}
            prefetch={false}
            aria-label={t.openClass(c.name)}
            className={cn(
              cardClass,
              "group flex h-full flex-col gap-3 p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised sm:p-5",
            )}
          >
            <span className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <School aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold font-display text-lg leading-snug">
                  {c.name}
                </span>
                <span className="block text-muted-foreground text-sm">
                  {[
                    subjectLabel(c.subject),
                    c.grade ? t.gradeOption(c.grade) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </span>
            {c.description && (
              <span className="line-clamp-2 text-muted-foreground text-sm">
                {c.description}
              </span>
            )}
            <span className="mt-auto flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-muted-foreground">
                {t.teacher(c.teacherName)}
              </span>
              <span className="flex shrink-0 items-center gap-1 font-semibold text-primary">
                {t.lessons(c.lessons)}
                <ChevronRight
                  aria-hidden
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
