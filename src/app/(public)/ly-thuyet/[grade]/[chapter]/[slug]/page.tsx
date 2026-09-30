import "katex/dist/katex.min.css";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mascot } from "@/components/mascot";
import { buttonVariants } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { catalog } from "@/content/ly-thuyet/catalog";
import {
  findTopic,
  gradeAnchor,
  type TopicParams,
  topicParams,
} from "@/features/materials/domain/materials";
import { materialsCopy as t } from "@/features/materials/messages";
import { cn } from "@/lib/utils";

type Props = PageProps<"/ly-thuyet/[grade]/[chapter]/[slug]">;

/** All 56 topics are prerendered; any other path is a 404 (S8-02). */
export function generateStaticParams(): TopicParams[] {
  return topicParams(catalog);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const hit = findTopic(catalog, await params);
  if (!hit) return {};
  return {
    title: `${hit.topic.title} · ${t.grade(hit.grade)}`,
    description: hit.topic.description,
    alternates: { canonical: hit.href },
    openGraph: { type: "article", title: hit.topic.title },
  };
}

/**
 * Every real topic is prerendered, so params are awaited here rather than
 * inside a Suspense boundary: an unknown path then answers a real 404.
 */
export default async function TheoryTopicPage({ params }: Props) {
  const hit = findTopic(catalog, await params);
  if (!hit) notFound();
  const { grade, chapter, topic, previous, next } = hit;
  const { default: Content } = await import(
    `@/content/ly-thuyet/${grade}/${chapter.slug}/${topic.slug}.mdx`
  );
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="space-y-4">
        <nav aria-label={t.breadcrumb}>
          <ol className="flex flex-wrap items-center gap-1 text-muted-foreground text-sm">
            <li>
              <Link
                href="/ly-thuyet"
                prefetch={false}
                className="inline-flex min-h-11 items-center hover:text-foreground"
              >
                {t.indexTitle}
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight aria-hidden className="size-4" />
              <Link
                href={`/ly-thuyet#${gradeAnchor(grade)}`}
                prefetch={false}
                className="inline-flex min-h-11 items-center hover:text-foreground"
              >
                {t.grade(grade)}
              </Link>
            </li>
            <li className="flex min-h-11 items-center gap-1">
              <ChevronRight aria-hidden className="size-4" />
              {chapter.title}
            </li>
          </ol>
        </nav>
        <h1 className="font-bold font-display text-3xl leading-tight tracking-tight sm:text-[2.5rem]">
          {topic.title}
        </h1>
        {topic.subtopics.length > 0 && (
          <div className="space-y-2">
            <p className="eyebrow text-muted-foreground">{t.subtopics}</p>
            <ul className="flex flex-wrap gap-2">
              {topic.subtopics.map((s) => (
                <li
                  key={s}
                  className="rounded-full bg-primary-soft px-3 py-1 font-medium text-sm"
                >
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>
      <div className="theory-content">
        <Content />
      </div>
      <nav aria-label={t.pager} className="grid gap-3 sm:grid-cols-2">
        {previous ? (
          <PagerLink href={previous.href} label={t.previous}>
            {previous.topic.title}
          </PagerLink>
        ) : (
          <span className="hidden sm:block" />
        )}
        {next && (
          <PagerLink href={next.href} label={t.next} forward>
            {next.topic.title}
          </PagerLink>
        )}
      </nav>
      <aside
        className={cn(
          cardClass,
          "flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:p-6 sm:text-left",
        )}
      >
        <Mascot pose="studying" size={96} className="shrink-0" />
        <div className="flex-1 space-y-1">
          <h2 className="heading-section">{t.practiceTitle}</h2>
          <p className="text-muted-foreground text-sm">{t.practiceBody}</p>
        </div>
        <Link
          href={`/lessons?grade=${grade}`}
          prefetch={false}
          className={buttonVariants()}
        >
          {t.practiceCta}
          <ArrowRight aria-hidden />
        </Link>
      </aside>
      <Link
        href="/ly-thuyet"
        prefetch={false}
        className={buttonVariants({ variant: "ghost" })}
      >
        <ArrowLeft aria-hidden />
        {t.backToIndex}
      </Link>
    </article>
  );
}

function PagerLink({
  href,
  label,
  forward = false,
  children,
}: {
  href: string;
  label: string;
  forward?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      rel={forward ? "next" : "prev"}
      className={cn(
        cardClass,
        "flex min-h-11 flex-col gap-1 p-4 hover:border-primary",
        forward && "sm:col-start-2 sm:items-end sm:text-right",
      )}
    >
      <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
        {!forward && <ArrowLeft aria-hidden className="size-4" />}
        {label}
        {forward && <ArrowRight aria-hidden className="size-4" />}
      </span>
      <span className="font-semibold">{children}</span>
    </Link>
  );
}
