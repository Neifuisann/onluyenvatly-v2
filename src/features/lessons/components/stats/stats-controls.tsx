import Form from "next/form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  STATS_SORTS,
  type StatsParams,
  type StatsVersion,
  statsHref,
} from "../../domain/stats";
import { statsCopy as t } from "../../messages";

/**
 * Version picker: a GET form (the URL is the state), so it also works
 * before hydration. The sort rides along in a hidden field.
 */
export function VersionPicker({
  lessonId,
  versions,
  selected,
  currentId,
  sort,
}: {
  lessonId: number;
  versions: readonly StatsVersion[];
  selected: number;
  currentId: number | null;
  sort: StatsParams["sort"];
}) {
  return (
    <Form
      action={`/admin/lessons/${lessonId}/stats`}
      prefetch={false}
      scroll={false}
      // Remount on navigation so the select shows the version in the URL.
      key={selected}
      aria-label={t.versionPicker}
      className="flex flex-wrap items-end gap-2"
    >
      <div className="grid min-w-0 gap-1.5">
        <Label htmlFor="stats-version">{t.versionLabel}</Label>
        <Select
          id="stats-version"
          name="version"
          defaultValue={String(selected)}
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {t.versionOption(v.version, v.attempts, v.id === currentId)}
            </option>
          ))}
        </Select>
      </div>
      {sort !== "order" && <input type="hidden" name="sort" value={sort} />}
      <Button type="submit" variant="secondary">
        {t.versionSubmit}
      </Button>
    </Form>
  );
}

/** "Theo thứ tự" / "Khó nhất trước" as links (the sort is in the URL). */
export function SortToggle({
  lessonId,
  params,
}: {
  lessonId: number;
  params: StatsParams;
}) {
  return (
    <nav
      aria-label={t.sortLabel}
      className="flex gap-1 rounded-lg bg-muted p-1"
    >
      {STATS_SORTS.map((sort) => {
        const active = params.sort === sort;
        return (
          <Link
            key={sort}
            href={statsHref(lessonId, params, { sort })}
            prefetch={false}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-9 items-center rounded-md px-3 font-medium text-sm",
              active
                ? "bg-surface text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.sorts[sort]}
          </Link>
        );
      })}
    </nav>
  );
}
