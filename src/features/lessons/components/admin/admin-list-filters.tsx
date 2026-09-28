import { Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  type AdminListFilters,
  adminListHref,
  LESSON_STATUSES,
} from "../../domain/admin-list";
import { adminLessonsCopy as t } from "../../messages";

const STATUSES = [null, ...LESSON_STATUSES] as const;

/** Search (GET form) and status chips; the URL is the only state. */
export function AdminListFilterBar({ filters }: { filters: AdminListFilters }) {
  return (
    <div className="flex flex-col gap-3">
      <Form
        action="/admin/lessons"
        prefetch={false}
        scroll={false}
        role="search"
        className="flex gap-2"
      >
        {filters.status && (
          <input type="hidden" name="status" value={filters.status} />
        )}
        <Label htmlFor="admin-lessons-q" className="sr-only">
          {t.searchLabel}
        </Label>
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
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
            className="pl-10"
          />
        </div>
        <Button type="submit" variant="secondary">
          {t.searchSubmit}
        </Button>
      </Form>
      <ul aria-label={t.statusGroup} className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => {
          const active = filters.status === s;
          return (
            <li key={s ?? "all"}>
              <Link
                href={adminListHref(filters, { status: s })}
                prefetch={false}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-surface hover:bg-muted",
                )}
              >
                {s ? t.statuses[s] : t.statusAll}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
