import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ResultSummary } from "@/features/attempts/components/result-summary";
import { resultCopy } from "@/features/attempts/messages";
import { getAttempt } from "@/features/attempts/queries";
import { AttemptIdSchema } from "@/features/attempts/schemas";
import { requireStudent } from "@/features/auth/guards";
import { getLessonOverview } from "@/features/lessons/queries";

export const metadata: Metadata = {
  title: resultCopy.title,
  robots: { index: false, follow: false },
};

/** `/attempts/[id]/result`: owner or admin (05 §1). */
export default async function AttemptResultPage({
  params,
}: PageProps<"/attempts/[id]/result">) {
  const user = await requireStudent();
  const parsed = AttemptIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const attempt = await getAttempt(parsed.data);
  if (!attempt || (attempt.userId !== user.id && user.role !== "admin"))
    notFound();
  if (attempt.status === "in_progress") {
    if (attempt.userId === user.id) redirect(`/attempts/${attempt.id}`);
    notFound();
  }
  const lesson = attempt.lessonId
    ? await getLessonOverview(attempt.lessonId, true)
    : null;
  return <ResultSummary attempt={attempt} lessonTitle={lesson?.title ?? ""} />;
}
