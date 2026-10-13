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
import { VideoLesson } from "@/features/video/components/video-lesson";
import { finishVideo } from "@/features/video/service";
import { ZombieGame } from "@/features/zombie/components/zombie-game";
import { finishGame } from "@/features/zombie/service";

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
  if (attempt.mode === "game") {
    // The last move was stored but its grading failed: grade it now.
    if (!attempt.game || attempt.game.over) {
      const done = await finishGame(user.id, attempt.id, now);
      if (done.ok) redirect(`/attempts/${attempt.id}/result`);
    }
    const [lesson, questions] = await Promise.all([
      lessonId ? getLessonOverview(lessonId, true) : null,
      itemPublicQuestions(attempt),
    ]);
    if (!lesson || !questions || !attempt.game) notFound();
    return (
      <ZombieGame
        host={{ kind: "attempt", attemptId: attempt.id, lessonId }}
        title={lesson.title}
        questions={attempt.items.map((item, i) =>
          toRunnerQuestion(
            withOptionOrder(questions[i] as (typeof questions)[number], item.o),
            item.p,
          ),
        )}
        initial={attempt.game}
        serverNow={now.getTime()}
      />
    );
  }
  if (attempt.mode === "video") {
    const video = attempt.video;
    // Every cue answered and the last one was the end of the video: the
    // grading failed after the answers were stored. Grade it now.
    const over =
      !video ||
      (video.done === video.cues.length && video.cues.at(-1)?.at === null);
    const [lesson, questions] = await Promise.all([
      lessonId ? getLessonOverview(lessonId, true) : null,
      itemPublicQuestions(attempt),
    ]);
    // The teacher removed the video meanwhile: grade what was answered.
    if (over || !lesson?.video) {
      const done = await finishVideo(user.id, attempt.id, now);
      if (done.ok) redirect(`/attempts/${attempt.id}/result`);
    }
    if (!video || !lesson?.video || !questions) notFound();
    return (
      <VideoLesson
        attemptId={attempt.id}
        lessonId={lessonId}
        title={lesson.title}
        youtubeId={lesson.video.youtubeId}
        questions={attempt.items.map((item, i) =>
          toRunnerQuestion(
            withOptionOrder(questions[i] as (typeof questions)[number], item.o),
            item.p,
          ),
        )}
        saved={attempt.answers}
        initial={video}
      />
    );
  }
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
