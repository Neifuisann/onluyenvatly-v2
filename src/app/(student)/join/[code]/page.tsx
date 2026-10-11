import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { Mascot } from "@/components/mascot";
import { buttonVariants } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { homePath } from "@/features/auth/core/login-policy";
import { requireStudent } from "@/features/auth/guards";
import { JoinButton } from "@/features/classes/components/join-button";
import {
  afterJoinPath,
  JoinCodeSchema,
  JoinLessonParamSchema,
} from "@/features/classes/domain/invite";
import { classesCopy } from "@/features/classes/messages";
import { getJoinTarget } from "@/features/classes/queries";
import { errorMessages } from "@/lib/messages";
import { rateLimit } from "@/lib/rate-limit";
import { subjectLabel } from "@/lib/subjects";
import { cn } from "@/lib/utils";

const t = classesCopy.join;

export const metadata: Metadata = {
  title: t.title,
  robots: { index: false },
};

/**
 * `/join/<code>?bai=<lessonId>` (B-03): a teacher's invite link. Signed out,
 * the proxy sends the visitor through login or register and back here. A
 * student already in the class goes straight on (to the lesson when the
 * class has it); anyone else confirms with "Vào lớp" (a server action).
 * Lookups are rate limited so codes can't be found by trying many.
 */
export default async function JoinPage({
  params,
  searchParams,
}: PageProps<"/join/[code]">) {
  const user = await requireStudent();
  if (user.role !== "student")
    return (
      <EmptyState
        mascot="idea"
        title={t.staffTitle}
        description={t.staff}
        action={<HomeLink href={homePath(user.role)} />}
      />
    );
  const code = JoinCodeSchema.safeParse((await params).code);
  const lessonId = JoinLessonParamSchema.parse((await searchParams).bai);
  if (!code.success) return <Invalid />;
  const limit = await rateLimit(`class-join-view:${user.id}`, 60, "1h");
  if (!limit.ok)
    return (
      <EmptyState
        mascot="space"
        title={t.title}
        description={errorMessages.RATE_LIMITED}
      />
    );
  const target = await getJoinTarget(code.data, user.id, lessonId);
  if (!target) return <Invalid />;
  if (target.member)
    redirect(afterJoinPath(target.id, lessonId, target.hasLesson));

  return (
    <div
      className={cn(
        cardClass,
        "mx-auto flex max-w-md flex-col items-center gap-5 p-6 text-center sm:p-8",
      )}
    >
      <Mascot pose="wave" size={112} />
      <div className="space-y-2">
        <h1 className="heading-section">{t.title}</h1>
        <p className="text-muted-foreground">{t.lead(target.teacherName)}</p>
        <p className="break-words font-bold font-display text-2xl tracking-tight">
          {target.name}
        </p>
        <p className="text-muted-foreground text-sm">
          {[
            subjectLabel(target.subject),
            target.grade ? classesCopy.gradeOption(target.grade) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {lessonId && target.hasLesson && (
        <p className="text-muted-foreground text-sm">{t.lessonNote}</p>
      )}
      <div className="w-full">
        <JoinButton code={code.data} lessonId={lessonId} />
      </div>
    </div>
  );
}

function Invalid() {
  return (
    <EmptyState
      mascot="telescope"
      title={t.notFoundTitle}
      description={t.notFoundBody}
      action={<HomeLink href="/classes" />}
    />
  );
}

function HomeLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={buttonVariants({ variant: "secondary" })}
    >
      {t.toHome}
    </Link>
  );
}
