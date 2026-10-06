import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Runner } from "@/features/attempts/components/runner/runner";
import { toRunnerQuestion } from "@/features/attempts/components/runner/to-runner-question";
import {
  itemPublicQuestions,
  itemQuestions,
  itemSources,
} from "@/features/attempts/content";
import { isPastGrace } from "@/features/attempts/domain/deadline";
import { runnerCopy } from "@/features/attempts/messages";
import { getAttempt } from "@/features/attempts/queries";
import { AttemptIdSchema } from "@/features/attempts/schemas";
import { submitExpired } from "@/features/attempts/service";
import { requireStudent } from "@/features/auth/guards";
import { withOptionOrder } from "@/features/lessons/domain/public-question";
import { getLessonOverview } from "@/features/lessons/queries";
import {
  type PracticeFeedback,
  practiceFeedback,
} from "@/features/review/domain/practice";
import { reviewCopy } from "@/features/review/messages";

export const metadata: Metadata = {
  title: runnerCopy.pageTitle,
  robots: { index: false, follow: false },
};

/**
 * `/attempts/[id]`: the owner's test in progress (05 §1). Questions come from
 * the cached answer-free lesson view; the attempt row adds the order, option
 * shuffles and saved answers. A review attempt (S7-06) takes its items from
 * several lessons and runs in practice mode: the items already checked get
 * their feedback back (their keys were shown already), nothing else.
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
  // Time ran out while the student was away: grade the saved answers now
  // (02 §4.1). Inside the grace the runner's own timer submits instead.
  const now = new Date();
  if (isPastGrace(attempt.deadlineAt, now)) {
    const closed = await submitExpired(user.id, attempt.id, now);
    if (closed.ok) redirect(`/attempts/${attempt.id}/result`);
  }
  const { lessonId } = attempt;
  const practice = attempt.mode !== "test";

  const sources = await itemSources(attempt);
  const checkedItems = practice
    ? attempt.checked.flatMap((i) => {
        const item = attempt.items[i];
        const source = sources?.[i];
        return item && source ? [{ i, item, source }] : [];
      })
    : [];
  const [lesson, questions, checkedQuestions] = await Promise.all([
    lessonId ? getLessonOverview(lessonId, true) : null,
    itemPublicQuestions(attempt, sources),
    checkedItems.length > 0
      ? itemQuestions(
          { ...attempt, items: checkedItems.map((c) => c.item) },
          checkedItems.map((c) => c.source),
        )
      : [],
  ]);
  if ((lessonId && !lesson) || !questions) notFound();

  const checked: Record<number, PracticeFeedback> = {};
  checkedItems.forEach(({ i, item }, k) => {
    const q = checkedQuestions?.[k];
    if (q) checked[i] = practiceFeedback(q, item, attempt.answers[i] ?? null);
  });

  return (
    <Runner
      attemptId={attempt.id}
      lessonId={lessonId}
      title={lesson?.title ?? reviewCopy.practiceTitle}
      questions={attempt.items.map((item, i) =>
        toRunnerQuestion(
          withOptionOrder(questions[i] as (typeof questions)[number], item.o),
          item.p,
        ),
      )}
      saved={{ answers: attempt.answers, flagged: attempt.flagged }}
      deadlineAt={attempt.deadlineAt?.toISOString() ?? null}
      serverNow={now.toISOString()}
      startedAt={attempt.startedAt.toISOString()}
      examGuard={lesson?.examGuard ?? false}
      {...(practice && { practice: { checked } })}
      {...(!lessonId && { exitHref: "/review" })}
    />
  );
}
