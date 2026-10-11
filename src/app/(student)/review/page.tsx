import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Mascot } from "@/components/mascot";
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
        <h1 className="heading-page">{t.title}</h1>
        <p className="text-muted-foreground">{t.lead}</p>
      </header>

      {openReview && (
        <section
          aria-labelledby="open-review"
          className="flex animate-rise flex-col gap-4 rounded-xl bg-accent-soft p-5 sm:flex-row sm:items-center sm:p-6"
        >
          <Mascot
            pose="studying"
            size={88}
            className="hidden shrink-0 sm:block"
          />
          <div className="flex-1 space-y-1">
            <h2 id="open-review" className="heading-section">
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
          mascot="all-clear"
          title={t.empty}
          description={t.emptyHint}
          action={
            <Link
              href="/classes"
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
              className="relative isolate flex flex-col gap-3 overflow-hidden rounded-xl border border-primary/30 bg-primary-soft/60 p-5 sm:p-6 dark:border-primary/40"
            >
              <Mascot
                pose="idea"
                size={112}
                className="-right-2 -top-1 absolute hidden opacity-95 sm:block"
              />
              <h2 id="start-review" className="heading-section sm:pr-28">
                {t.startTitle}
              </h2>
              <p className="text-muted-foreground text-sm sm:pr-28">
                {t.startLead}
              </p>
              <p className="font-medium text-sm">
                {t.available(summary.practicable)}
              </p>
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
            <h2 id="mistakes" className="heading-section">
              {t.listTitle}{" "}
              <span className="font-normal text-muted-foreground text-sm">
                ({summary.matching})
              </span>
            </h2>
            {list.rows.length > 0 ? (
              <MistakeList rows={list.rows} questionOf={questionOf} />
            ) : (
              <EmptyState
                mascot="telescope"
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
