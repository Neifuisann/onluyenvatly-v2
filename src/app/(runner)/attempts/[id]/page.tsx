import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Runner } from "@/features/attempts/components/runner/runner";
import { toRunnerQuestion } from "@/features/attempts/components/runner/to-runner-question";
import { runnerCopy } from "@/features/attempts/messages";
import { getAttempt } from "@/features/attempts/queries";
import { AttemptIdSchema } from "@/features/attempts/schemas";
import { requireStudent } from "@/features/auth/guards";
import { withOptionOrder } from "@/features/lessons/domain/public-question";
import {
  getLessonForTaking,
  getLessonOverview,
} from "@/features/lessons/queries";

export const metadata: Metadata = {
  title: runnerCopy.pageTitle,
  robots: { index: false, follow: false },
};

/**
 * `/attempts/[id]`: the owner's test in progress (05 §1). Questions come from
 * the cached answer-free lesson view; the attempt row adds the order, option
 * shuffles and saved answers.
 */
export default async function AttemptPage({
  params,
}: PageProps<"/attempts/[id]">) {
  const user = await requireStudent();
  const parsed = AttemptIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const attempt = await getAttempt(parsed.data);
  if (!attempt || attempt.userId !== user.id) notFound();
  if (attempt.status !== "in_progress")
    redirect(`/attempts/${attempt.id}/result`);
  // Single-lesson tests only; personalized practice arrives in S7-06.
  const { lessonId, lessonVersionId } = attempt;
  if (!lessonId || !lessonVersionId) notFound();

  const [lesson, questions] = await Promise.all([
    getLessonOverview(lessonId, true),
    getLessonForTaking(lessonId, lessonVersionId),
  ]);
  if (!lesson || !questions) notFound();
  const byId = new Map(questions.map((q) => [q.id, q]));

  return (
    <Runner
      attemptId={attempt.id}
      lessonId={lessonId}
      title={lesson.title}
      questions={attempt.items.map((item) => {
        const q = byId.get(item.q);
        if (!q) throw new Error(`Question ${item.q} missing from its version`);
        return toRunnerQuestion(withOptionOrder(q, item.o), item.p);
      })}
      saved={{ answers: attempt.answers, flagged: attempt.flagged }}
    />
  );
}
