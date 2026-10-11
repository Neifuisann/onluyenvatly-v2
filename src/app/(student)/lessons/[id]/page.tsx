import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  LessonAttemptPanel,
  LessonAttemptPanelSkeleton,
} from "@/features/attempts/components/lesson-attempt-panel";
import { requireStudent } from "@/features/auth/guards";
import { canOpenLesson } from "@/features/classes/queries";
import { LessonOverviewContent } from "@/features/lessons/components/lesson-overview";
import { LessonIdSchema } from "@/features/lessons/domain/lesson-params";
import { overviewCopy } from "@/features/lessons/messages";
import { getLessonOverview } from "@/features/lessons/queries";

export const metadata: Metadata = { title: overviewCopy.title };

export default async function LessonPage({
  params,
}: PageProps<"/lessons/[id]">) {
  const user = await requireStudent();
  const parsed = LessonIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  // B-03: a student needs a class that has the lesson; a teacher must own it.
  if (!(await canOpenLesson(user.id, user.role, parsed.data))) notFound();
  const owner = user.role !== "student";
  // Owners may open their unpublished lessons ("Làm thử", 06 §2).
  const lesson = await getLessonOverview(parsed.data, owner);
  if (!lesson) notFound();
  return (
    <LessonOverviewContent
      lesson={lesson}
      attempts={
        <Suspense fallback={<LessonAttemptPanelSkeleton />}>
          <LessonAttemptPanel
            userId={user.id}
            lessonId={lesson.id}
            schedule={{
              startsAt: lesson.startsAt,
              timeLimitSec: lesson.timeLimitSec,
              revealAnswers: lesson.revealAnswers,
              maxAttempts: lesson.maxAttempts,
            }}
            unlimited={owner}
          />
        </Suspense>
      }
    />
  );
}
