import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SegmentedNav } from "@/components/segmented-nav";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getExplanationLessons,
  getFlaggedExplanations,
  getLessonExplanations,
} from "@/features/ai/admin-queries";
import { ExplanationCard } from "@/features/ai/components/admin/explanation-card";
import { LessonExplanationList } from "@/features/ai/components/admin/lesson-explanations";
import { PregeneratePanel } from "@/features/ai/components/admin/pregenerate-panel";
import { adminExplanationsCopy as t } from "@/features/ai/messages";
import { requireAdmin } from "@/features/auth/guards";
import { getSettings } from "@/features/settings/queries";

export const metadata: Metadata = { title: t.title };

const ParamsSchema = z.object({
  view: z.enum(["flagged", "lesson"]).catch("flagged"),
  lesson: z.coerce.number().int().positive().optional().catch(undefined),
});

/**
 * `/admin/explanations?view=&lesson=` (S7-03): the 👎 queue (default), or
 * one lesson's published questions with their explanations and "Tạo sẵn
 * cho cả bài". Per request, uncached (explanations change as students vote).
 */
export default async function AdminExplanationsPage({
  searchParams,
}: PageProps<"/admin/explanations">) {
  await requireAdmin();
  const params = ParamsSchema.parse(await searchParams);
  const view = params.lesson ? "lesson" : params.view;
  const [flagged, lessons, settings, lesson] = await Promise.all([
    getFlaggedExplanations(),
    view === "lesson" ? getExplanationLessons() : null,
    getSettings(),
    params.lesson ? getLessonExplanations(params.lesson) : null,
  ]);

  const tabs = [
    {
      id: "flagged",
      href: "/admin/explanations",
      label: t.tabFlagged(flagged.length),
    },
    {
      id: "lesson",
      href: "/admin/explanations?view=lesson",
      label: t.tabLesson,
    },
  ] as const;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title={t.title} lead={t.lead} />
      <SegmentedNav
        label={t.tabsLabel}
        items={tabs.map((tab) => ({
          key: tab.id,
          href: tab.href,
          label: tab.label,
          active: view === tab.id,
        }))}
      />

      {view === "flagged" ? (
        flagged.length === 0 ? (
          <EmptyState
            mascot="all-clear"
            title={t.flaggedEmpty}
            description={t.flaggedEmptyHint}
          />
        ) : (
          <ol className="flex flex-col gap-4">
            {flagged.map((e) => (
              <li
                key={e.hash}
                className="flex flex-col gap-3 rounded-lg border border-border/70 bg-surface p-5 shadow-card sm:p-6 dark:border-border"
              >
                <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {t.flaggedFrom(e.lessonTitle, e.questionId)}
                  </span>
                  {e.lessonId !== null && (
                    <Link
                      href={`/admin/explanations?lesson=${e.lessonId}`}
                      prefetch={false}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {t.openLesson}
                    </Link>
                  )}
                </p>
                <ExplanationCard explanation={e} />
              </li>
            ))}
          </ol>
        )
      ) : (
        <>
          <Form
            action="/admin/explanations"
            prefetch={false}
            scroll={false}
            aria-label={t.pickerLabel}
            key={params.lesson ?? "none"}
            className="flex flex-col gap-3 rounded-lg border border-border/70 bg-surface p-5 shadow-card sm:flex-row sm:items-end sm:p-6 dark:border-border"
          >
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="explanations-lesson">{t.lesson}</Label>
              <Select
                id="explanations-lesson"
                name="lesson"
                defaultValue={params.lesson ?? ""}
                required
              >
                <option value="" disabled>
                  {t.pickLesson}
                </option>
                {(lessons ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              {t.show}
            </Button>
          </Form>
          {lessons?.length === 0 && (
            <EmptyState icon={BookOpen} title={t.noLessons} />
          )}
          {params.lesson &&
            (lesson ? (
              <>
                <h2 className="heading-section">{lesson.lesson.title}</h2>
                <p className="text-muted-foreground text-sm">
                  {t.counts(lesson.counts)}
                </p>
                <PregeneratePanel
                  lessonId={lesson.lesson.id}
                  missing={lesson.counts.missing}
                  aiEnabled={settings.aiEnabled}
                />
                <LessonExplanationList rows={lesson.rows} />
              </>
            ) : (
              <EmptyState icon={BookOpen} title={t.lessonNotFound} />
            ))}
        </>
      )}
    </div>
  );
}
