import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/features/auth/guards";
import { getLessonForCorrection } from "@/features/lessons/admin-queries";
import { QuestionTextEditor } from "@/features/lessons/components/corrections/question-text-editor";
import { LessonIdSchema } from "@/features/lessons/domain/admin-list";
import { serializeQuestion } from "@/features/lessons/domain/serializer";
import { liveQuestions } from "@/features/lessons/domain/summary";
import { questionsCopy as t } from "@/features/lessons/messages";
import { QuestionIdSchema, QuestionsSchema } from "@/features/lessons/schema";

export const metadata: Metadata = { title: t.editMeta };

/**
 * `/admin/lessons/[id]/questions/[questionId]` (B-10): "Sửa nội dung" of
 * one published question, in the text format, then back to the questions
 * page. While corrections are refused (a draft, archived) it is that page.
 */
export default async function EditQuestionPage({
  params,
}: PageProps<"/admin/lessons/[id]/questions/[questionId]">) {
  await requireAdmin();
  const raw = await params;
  const id = LessonIdSchema.safeParse(raw.id);
  const questionId = QuestionIdSchema.safeParse(raw.questionId);
  if (!id.success || !questionId.success) notFound();
  const lesson = await getLessonForCorrection(id.data);
  if (!lesson) notFound();
  const back = `/admin/lessons/${lesson.id}/questions`;
  if (lesson.hasDraft || lesson.status === "archived") redirect(back);
  const questions = QuestionsSchema.safeParse(lesson.questions);
  if (!questions.success) notFound();
  const live = liveQuestions(questions.data);
  const index = live.findIndex((q) => q.id === questionId.data);
  const question = live[index];
  if (!question) notFound();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        back={{ href: `${back}#q-${question.id}`, label: t.editBack }}
        title={t.editTitle(index + 1)}
        lead={lesson.title}
      />
      <QuestionTextEditor
        lessonId={lesson.id}
        question={question}
        index={index}
        initialText={serializeQuestion(question, index)}
      />
    </div>
  );
}
