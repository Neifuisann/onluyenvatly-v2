import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SharePreviewContent } from "@/features/lessons/components/share-preview";
import { shareCopy } from "@/features/lessons/messages";
import { sharePreviewFor } from "./preview";

type Props = PageProps<"/share/lessons/[id]">;

/**
 * `/share/lessons/[id]` (S8-03): public, no session read. The shell is
 * static and the lesson comes from the shared cache (`lesson:{id}` +
 * `lesson:{id}:public`, hours), so a shared link costs no per-visit query.
 * No `generateStaticParams`: that would need the database at build time.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lesson = await sharePreviewFor((await params).id);
  if (!lesson) return { robots: { index: false } };
  const description = lesson.description ?? shareCopy.eyebrow;
  return {
    title: lesson.title,
    description,
    alternates: { canonical: `/share/lessons/${lesson.id}` },
    openGraph: { type: "article", title: lesson.title, description },
    twitter: { card: "summary_large_image" },
  };
}

export default function SharePage({ params }: Props) {
  return (
    <Suspense fallback={<ShareSkeleton />}>
      <Share params={params} />
    </Suspense>
  );
}

async function Share({ params }: { params: Props["params"] }) {
  const lesson = await sharePreviewFor((await params).id);
  if (!lesson) notFound();
  return <SharePreviewContent lesson={lesson} />;
}

function ShareSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <Skeleton className="size-14 rounded-2xl" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
