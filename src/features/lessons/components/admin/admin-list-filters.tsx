import { Search } from "lucide-react";
import Form from "next/form";
import { SegmentedNav } from "@/components/segmented-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ADMIN_SORTS,
  type AdminListFilters,
  adminListHref,
  DEFAULT_SORT,
  defaultDir,
  LESSON_STATUSES,
} from "../../domain/admin-list";
import { adminLessonsCopy as t } from "../../messages";

const STATUSES = [null, ...LESSON_STATUSES] as const;

/**
 * Pill search (GET form) and a segmented status switch, the same shapes as
 * the student catalog (07 §5.5); the URL is the only state. On phones the
 * table has no column headers, so the order is a segmented switch too.
 */
export function AdminListFilterBar({ filters }: { filters: AdminListFilters }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
      <Form
        action="/admin/lessons"
        prefetch={false}
        scroll={false}
        role="search"
        className="relative min-w-0 flex-1"
      >
        {filters.status && (
          <input type="hidden" name="status" value={filters.status} />
        )}
        {filters.sort !== DEFAULT_SORT && (
          <input type="hidden" name="sort" value={filters.sort} />
        )}
        {filters.sort !== "manual" &&
          filters.dir !== defaultDir(filters.sort) && (
            <input type="hidden" name="dir" value={filters.dir} />
          )}
        <Label htmlFor="admin-lessons-q" className="sr-only">
          {t.searchLabel}
        </Label>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
        />
        <Input
          // Remount on navigation so the field shows the URL's value.
          key={filters.q ?? ""}
          id="admin-lessons-q"
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
      <SegmentedNav
        label={t.statusGroup}
        items={STATUSES.map((s) => ({
          key: s ?? "all",
          href: adminListHref(filters, { status: s }),
          label: s ? t.statuses[s] : t.statusAll,
          active: filters.status === s,
        }))}
      />
      <SegmentedNav
        label={t.sortGroup}
        className="md:hidden"
        items={ADMIN_SORTS.map((s) => ({
          key: s,
          href: adminListHref(filters, { sort: s, dir: defaultDir(s) }),
          label: t.sorts[s],
          active: filters.sort === s,
        }))}
      />
    </div>
  );
}
