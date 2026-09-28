import { Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  STUDENT_GRADES,
  STUDENT_STATUSES,
  type StudentListFilters,
  studentsHref,
} from "../domain/list";
import { studentsCopy as t } from "../messages";

const chip = (active: boolean) =>
  cn(
    "inline-flex h-9 items-center rounded-full border px-3.5 text-sm transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "bg-surface hover:bg-muted",
  );

/** Search (GET form), status and grade chips of the "Tất cả" tab. */
export function StudentFilterBar({ filters }: { filters: StudentListFilters }) {
  return (
    <div className="flex flex-col gap-3">
      <Form
        action="/admin/students"
        prefetch={false}
        scroll={false}
        role="search"
        className="flex gap-2"
      >
        <input type="hidden" name="view" value="all" />
        {filters.status && (
          <input type="hidden" name="status" value={filters.status} />
        )}
        {filters.grade && (
          <input type="hidden" name="grade" value={filters.grade} />
        )}
        <Label htmlFor="admin-students-q" className="sr-only">
          {t.searchLabel}
        </Label>
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
          />
          <Input
            // Remount on navigation so the field shows the value in the URL.
            key={filters.q ?? ""}
            id="admin-students-q"
            name="q"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={80}
            defaultValue={filters.q ?? ""}
            placeholder={t.searchPlaceholder}
            className="pl-10"
          />
        </div>
        <Button type="submit" variant="secondary">
          {t.searchSubmit}
        </Button>
      </Form>
      <ul aria-label={t.statusGroup} className="flex flex-wrap gap-1.5">
        {[null, ...STUDENT_STATUSES].map((s) => (
          <li key={s ?? "all"}>
            <Link
              href={studentsHref(filters, { status: s })}
              prefetch={false}
              scroll={false}
              aria-current={filters.status === s ? "page" : undefined}
              className={chip(filters.status === s)}
            >
              {s ? t.statuses[s] : t.filterAll}
            </Link>
          </li>
        ))}
      </ul>
      <ul aria-label={t.gradeGroup} className="flex flex-wrap gap-1.5">
        {[null, ...STUDENT_GRADES].map((g) => (
          <li key={g ?? "all"}>
            <Link
              href={studentsHref(filters, { grade: g })}
              prefetch={false}
              scroll={false}
              aria-current={filters.grade === g ? "page" : undefined}
              className={chip(filters.grade === g)}
            >
              {g ? t.grade(g) : t.filterAll}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
