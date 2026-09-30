import { SegmentedNav } from "@/components/segmented-nav";
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
  return (
    <SegmentedNav
      label={t.tabsLabel}
      items={[
        {
          key: "pending",
          href: studentsHref(filters, { view: "pending" }),
          label: t.tabPending,
          count: pendingCount,
          active: filters.view === "pending",
        },
        {
          key: "all",
          href: studentsHref(filters, { view: "all" }),
          label: t.tabAll,
          active: filters.view === "all",
        },
      ]}
    />
  );
}
