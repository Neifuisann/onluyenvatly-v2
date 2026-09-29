import { Repeat, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireStudent } from "@/features/auth/guards";
import { getLessonForTaking } from "@/features/lessons/queries";
import { MistakeList } from "@/features/review/components/mistake-list";
import { ReviewFilters } from "@/features/review/components/review-filters";
import { StartReviewForm } from "@/features/review/components/start-review-form";
import {
  BANK_MAX_PAGES,
  BANK_PAGE_SIZE,
  parseReviewParams,
  reviewHref,
  summarizeBank,
} from "@/features/review/domain/practice";
import { reviewCopy as t } from "@/features/review/messages";
import {
  getMistakeGroups,
  getMistakes,
  getOpenReview,
} from "@/features/review/queries";

export const metadata: Metadata = { title: t.title };

/**
 * `/review` (05 §1, S7-06): my open mistakes with chapter/type filters,
 * "Tạo bài ôn tập" and the practice in progress. Per request (per-student
 * data): three indexed reads, plus the cached answer-free versions of the
 * questions on screen.
 */
export default async function ReviewPage({
  searchParams,
}: PageProps<"/review">) {
  const user = await requireStudent();
  const params = parseReviewParams(await searchParams);
  const now = new Date();
  const [groups, list, openReview] = await Promise.all([
    getMistakeGroups(user.id, now),
    getMistakes(user.id, params, params.page * BANK_PAGE_SIZE, now),
    getOpenReview(user.id),
  ]);
  const summary = summarizeBank(groups, params);

  // Stems from the shared answer-free cache, one entry per version.
  const versions = new Map<number, number>(
    list.rows.map((r) => [r.versionId, r.lessonId]),
  );
  const content = new Map(
    await Promise.all(
      [...versions].map(
        async ([versionId, lessonId]) =>
          [versionId, await getLessonForTaking(lessonId, versionId)] as const,
      ),
    ),
  );
  const questionOf = (r: { versionId: number; questionId: string }) =>
    content.get(r.versionId)?.find((q) => q.id === r.questionId);
  const filtered = params.chapter !== null || params.type !== null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-semibold text-2xl">{t.title}</h1>
        <p className="text-muted-foreground">{t.lead}</p>
      </header>

      {openReview && (
        <section
          aria-labelledby="open-review"
          className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary-soft p-4 sm:flex-row sm:items-center"
        >
          <div className="flex-1">
            <h2 id="open-review" className="font-semibold">
              {t.continueTitle}
            </h2>
            <p className="text-sm">{t.continueLead(openReview.count)}</p>
          </div>
          <Link
            href={`/attempts/${openReview.id}`}
            prefetch={false}
            className={buttonVariants({ size: "lg" })}
          >
            {t.continue}
          </Link>
        </section>
      )}

      {summary.total === 0 ? (
        <EmptyState
          icon={Repeat}
          title={t.empty}
          description={t.emptyHint}
          action={
            <Link
              href="/lessons"
              prefetch={false}
              className={buttonVariants({ variant: "secondary" })}
            >
              {t.browse}
            </Link>
          }
        />
      ) : (
        <>
          <ReviewFilters params={params} summary={summary} />

          {!openReview && (
            <section
              aria-labelledby="start-review"
              className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card"
            >
              <h2 id="start-review" className="font-semibold text-lg">
                {t.startTitle}
              </h2>
              <p className="text-muted-foreground text-sm">{t.startLead}</p>
              <p className="text-sm">{t.available(summary.practicable)}</p>
              {summary.matching > summary.practicable && (
                <p className="text-muted-foreground text-sm">
                  {t.hiddenNote(summary.matching - summary.practicable)}
                </p>
              )}
              <StartReviewForm
                chapter={params.chapter}
                type={params.type}
                available={summary.practicable}
              />
            </section>
          )}

          <section aria-labelledby="mistakes" className="flex flex-col gap-3">
            <h2 id="mistakes" className="font-semibold text-lg">
              {t.listTitle}{" "}
              <span className="font-normal text-muted-foreground text-sm">
                ({summary.matching})
              </span>
            </h2>
            {list.rows.length > 0 ? (
              <MistakeList rows={list.rows} questionOf={questionOf} />
            ) : (
              <EmptyState
                icon={SearchX}
                title={t.emptyFiltered}
                action={
                  filtered && (
                    <Link
                      href="/review"
                      prefetch={false}
                      className={buttonVariants({ variant: "secondary" })}
                    >
                      {t.clearFilters}
                    </Link>
                  )
                }
              />
            )}
            {list.more && params.page < BANK_MAX_PAGES && (
              <Link
                href={reviewHref(params, { page: params.page + 1 })}
                prefetch={false}
                scroll={false}
                className={buttonVariants({
                  variant: "secondary",
                  className: "self-center",
                })}
              >
                {t.more}
              </Link>
            )}
          </section>
        </>
      )}
    </div>
  );
}
