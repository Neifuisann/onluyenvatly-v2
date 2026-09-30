import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SegmentedNav } from "@/components/segmented-nav";
import { buttonVariants } from "@/components/ui/button";
import { AuditList } from "@/features/audit/components/audit-list";
import {
  AUDIT_AREA_KEYS,
  auditHref,
  parseAuditParams,
} from "@/features/audit/domain/audit-log";
import { auditCopy as t } from "@/features/audit/messages";
import { getAuditLog } from "@/features/audit/queries";
import { requireAdmin } from "@/features/auth/guards";

export const metadata: Metadata = { title: t.title };

/**
 * `/admin/audit?area=&page=` (M11): every `audit_log` entry, newest first,
 * 50 per page, filtered by area. Per request, uncached.
 */
export default async function AdminAuditPage({
  searchParams,
}: PageProps<"/admin/audit">) {
  await requireAdmin();
  const filters = parseAuditParams(await searchParams);
  const log = await getAuditLog(filters);
  const from = log.offset + 1;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader title={t.title} lead={t.lead} />
      <SegmentedNav
        label={t.areasLabel}
        items={[
          {
            key: "all",
            href: auditHref(filters, { area: null }),
            label: t.allAreas,
            active: !filters.area,
          },
          ...AUDIT_AREA_KEYS.map((area) => ({
            key: area,
            href: auditHref(filters, { area }),
            label: t.area(area),
            active: filters.area === area,
          })),
        ]}
      />
      {log.rows.length > 0 ? (
        <>
          <p className="num text-muted-foreground text-sm">
            {log.pageCount > 1
              ? t.countRange(
                  from,
                  log.offset + log.rows.length,
                  log.total,
                  log.capped,
                )
              : t.count(log.total)}
          </p>
          <AuditList rows={log.rows} />
          <Pagination
            page={log.page}
            pageCount={log.pageCount}
            href={(page) => auditHref(filters, { page })}
          />
          {log.capped && log.page === log.pageCount && (
            <p className="text-center text-muted-foreground text-sm">
              {t.capped(log.total)}
            </p>
          )}
        </>
      ) : (
        <EmptyState
          mascot={filters.area ? "telescope" : "sleeping"}
          title={filters.area ? t.noMatchTitle : t.emptyTitle}
          description={filters.area ? t.noMatchBody : t.emptyBody}
          action={
            filters.area ? (
              <Link
                href="/admin/audit"
                prefetch={false}
                className={buttonVariants({ variant: "secondary" })}
              >
                {t.clear}
              </Link>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
