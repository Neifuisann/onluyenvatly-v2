import { ChartColumn, FilePenLine, Settings, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/features/auth/guards";
import { getLessonForCorrection } from "@/features/lessons/admin-queries";
import { QuestionCorrections } from "@/features/lessons/components/corrections/question-corrections";
import { LessonIdSchema } from "@/features/lessons/domain/admin-list";
import { questionsCopy as t } from "@/features/lessons/messages";
import {
  DEFAULT_LESSON_CONFIG,
  LessonConfigSchema,
  QuestionsSchema,
} from "@/features/lessons/schema";

export const metadata: Metadata = { title: t.metaTitle };

/**
 * `/admin/lessons/[id]/questions` (B-10): what "Sửa" opens for a published
 * lesson. The current version, rendered, with quick corrections that are
 * applied in place and regrade its attempts. Without a published version
 * there is nothing to correct: the editor.
 */
export default async function LessonQuestionsPage({
  params,
}: PageProps<"/admin/lessons/[id]/questions">) {
  await requireAdmin();
  const id = LessonIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const lesson = await getLessonForCorrection(id.data);
  if (!lesson) notFound();
  const questions = QuestionsSchema.safeParse(lesson.questions);
  if (!questions.success) notFound();
  const config = LessonConfigSchema.safeParse(lesson.config);
  const archived = lesson.status === "archived";
  const editHref = `/admin/lessons/${lesson.id}/edit`;
  const action = buttonVariants({ variant: "secondary", size: "sm" });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        back={{ href: "/admin/lessons", label: t.back }}
        title={t.title(lesson.title)}
        lead={t.lead(lesson.version, lesson.submitted)}
        actions={
          <>
            <Link
              href={`/admin/lessons/${lesson.id}/results`}
              prefetch={false}
              className={action}
            >
              <Users aria-hidden />
              {t.results}
            </Link>
            <Link
              href={`/admin/lessons/${lesson.id}/stats`}
              prefetch={false}
              className={action}
            >
              <ChartColumn aria-hidden />
              {t.stats}
            </Link>
            <Link href={editHref} prefetch={false} className={action}>
              <FilePenLine aria-hidden />
              {t.fullEditor}
            </Link>
            <Link
              href={`${editHref}?step=settings`}
              prefetch={false}
              className={action}
            >
              <Settings aria-hidden />
              {t.settings}
            </Link>
          </>
        }
      />
      {lesson.hasDraft && (
        <Alert>
          <p className="font-semibold">{t.draftTitle}</p>
          <p>{t.draftBody}</p>
          <Link
            href={editHref}
            prefetch={false}
            className="mt-1 inline-block font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t.openDraft}
          </Link>
        </Alert>
      )}
      {archived && <Alert>{t.archivedBody}</Alert>}
      <QuestionCorrections
        lessonId={lesson.id}
        questions={questions.data}
        config={config.success ? config.data : DEFAULT_LESSON_CONFIG}
        submitted={lesson.submitted}
        locked={lesson.hasDraft || archived}
      />
    </div>
  );
}
