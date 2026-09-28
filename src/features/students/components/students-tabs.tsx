import Link from "next/link";
import { cn } from "@/lib/utils";
import { type StudentListFilters, studentsHref } from "../domain/list";
import { studentsCopy as t } from "../messages";

/** "Chờ duyệt" / "Tất cả" (links: the URL is the only state). */
export function StudentsTabs({
  filters,
  pendingCount,
}: {
  filters: StudentListFilters;
  pendingCount: number;
}) {
  const tabs = [
    { view: "pending", label: t.tabPending, count: pendingCount },
    { view: "all", label: t.tabAll, count: 0 },
  ] as const;
  return (
    <ul aria-label={t.tabsLabel} className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const active = filters.view === tab.view;
        return (
          <li key={tab.view}>
            <Link
              href={studentsHref(filters, { view: tab.view })}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-4 font-medium text-sm transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 font-semibold text-[0.6875rem] text-primary-foreground leading-none">
                  {tab.count}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
