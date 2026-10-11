import { Search } from "lucide-react";
import Form from "next/form";
import { SegmentedNav } from "@/components/segmented-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  STUDENT_GRADES,
  STUDENT_STATUSES,
  type StudentListFilters,
  studentsHref,
} from "../domain/list";
import { studentsCopy as t } from "../messages";

/** Pill search (GET form), status and grade switches of the "Tất cả" tab. */
export function StudentFilterBar({ filters }: { filters: StudentListFilters }) {
  return (
    <div className="flex flex-col gap-3">
      <Form
        action="/admin/students"
        prefetch={false}
        scroll={false}
        role="search"
        className="relative"
      >
        {filters.status && (
          <input type="hidden" name="status" value={filters.status} />
        )}
        {filters.grade && (
          <input type="hidden" name="grade" value={filters.grade} />
        )}
        <Label htmlFor="admin-students-q" className="sr-only">
          {t.searchLabel}
        </Label>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
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
          className="rounded-full pr-20 pl-11 shadow-card [&::-webkit-search-cancel-button]:hidden"
        />
        <Button
          type="submit"
          size="sm"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 active:-translate-y-1/2 active:scale-100"
        >
          {t.searchSubmit}
        </Button>
      </Form>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedNav
          label={t.statusGroup}
          items={[null, ...STUDENT_STATUSES].map((s) => ({
            key: s ?? "all",
            href: studentsHref(filters, { status: s }),
            label: s ? t.statuses[s] : t.filterAll,
            active: filters.status === s,
          }))}
        />
        <SegmentedNav
          label={t.gradeGroup}
          items={[null, ...STUDENT_GRADES].map((g) => ({
            key: String(g ?? "all"),
            href: studentsHref(filters, { grade: g }),
            label: g ? t.grade(g) : t.filterAll,
            active: filters.grade === g,
          }))}
        />
      </div>
    </div>
  );
}
