import { BookOpen, MessageSquareText } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
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
import { cn } from "@/lib/utils";

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
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-semibold text-2xl">{t.title}</h1>
        <p className="text-muted-foreground">{t.lead}</p>
      </header>
      <nav aria-label={t.tabsLabel} className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            prefetch={false}
            aria-current={view === tab.id ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center rounded-full border bg-surface px-4 font-medium text-sm transition-colors duration-150 hover:border-primary/60",
              view === tab.id &&
                "border-primary bg-primary text-primary-foreground hover:border-primary",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {view === "flagged" ? (
        flagged.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title={t.flaggedEmpty}
            description={t.flaggedEmptyHint}
          />
        ) : (
          <ol className="flex flex-col gap-4">
            {flagged.map((e) => (
              <li
                key={e.hash}
                className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card"
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
            className="flex flex-col gap-3 rounded-lg border bg-surface p-4 sm:flex-row sm:items-end"
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
                <h2 className="font-semibold text-xl">{lesson.lesson.title}</h2>
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
