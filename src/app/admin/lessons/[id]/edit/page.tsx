import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/auth/guards";
import { getLessonForEditing } from "@/features/lessons/admin-queries";
import { LessonEditor } from "@/features/lessons/components/editor/lesson-editor";
import { LessonIdSchema } from "@/features/lessons/domain/admin-list";
import { editorCopy } from "@/features/lessons/messages";
import {
  DEFAULT_LESSON_CONFIG,
  LessonConfigSchema,
  QuestionSchema,
} from "@/features/lessons/schema";

export const metadata: Metadata = { title: editorCopy.tabs.content };

export default async function EditLessonPage({
  params,
}: PageProps<"/admin/lessons/[id]/edit">) {
  await requireAdmin();
  const id = LessonIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const lesson = await getLessonForEditing(id.data);
  if (!lesson) notFound();
  const config = LessonConfigSchema.safeParse(lesson.config);
  const previous = Array.isArray(lesson.questions)
    ? lesson.questions.flatMap((q) => {
        const parsed = QuestionSchema.safeParse(q);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  return (
    <LessonEditor
      lesson={{
        id: lesson.id,
        status: lesson.status,
        coverPath: lesson.coverPath,
        meta: {
          title: lesson.title,
          description: lesson.description,
          grade: lesson.grade,
          chapter: lesson.chapter,
          tags: lesson.tags,
        },
        sourceText: lesson.sourceText,
        previous,
        config: config.success ? config.data : DEFAULT_LESSON_CONFIG,
        hasDraft: lesson.hasDraft,
        hasPublished: lesson.hasPublished,
      }}
    />
  );
}
