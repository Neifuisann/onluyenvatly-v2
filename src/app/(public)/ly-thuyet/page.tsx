import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { cardClass } from "@/components/ui/card";
import { catalog } from "@/content/ly-thuyet/catalog";
import { TopicGlyph } from "@/features/lessons/components/topic-glyph";
import { lessonTopic } from "@/features/lessons/domain/topic";
import { TopicSearch } from "@/features/materials/components/topic-search";
import { gradeAnchor, topicHref } from "@/features/materials/domain/materials";
import { materialsCopy as t } from "@/features/materials/messages";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: t.indexTitle,
  description: t.indexLead,
  alternates: { canonical: "/ly-thuyet" },
};

/**
 * `/ly-thuyet` (S8-02): every theory topic by grade and chapter. Static; the
 * search runs in the browser over the same catalog.
 */
export default function TheoryIndexPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader title={t.indexTitle} lead={t.indexLead} />
      <nav aria-label={t.gradeNav}>
        <ul className="flex w-fit gap-1 rounded-full bg-muted p-1">
          {catalog.map((g) => (
            <li key={g.grade}>
              <a
                href={`#${gradeAnchor(g.grade)}`}
                className="inline-flex h-9 items-center rounded-full px-4 font-medium text-muted-foreground text-sm hover:bg-surface hover:text-foreground"
              >
                {t.grade(g.grade)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <TopicSearch catalog={catalog} />
      {catalog.map((g) => (
        <section
          key={g.grade}
          id={gradeAnchor(g.grade)}
          aria-labelledby={`${gradeAnchor(g.grade)}-title`}
          className="scroll-mt-20 space-y-4"
        >
          <h2
            id={`${gradeAnchor(g.grade)}-title`}
            className="heading-page sm:text-[2rem]"
          >
            {t.grade(g.grade)}
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {g.chapters.map((chapter) => (
              <li
                key={chapter.slug}
                className={cn(cardClass, "flex flex-col gap-4 p-5 sm:p-6")}
              >
                <div className="flex items-start gap-3">
                  <TopicGlyph
                    topic={lessonTopic(chapter.title)}
                    className="size-11 shrink-0 rounded-md"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <h3 className="heading-section">{chapter.title}</h3>
                    <p className="text-muted-foreground text-sm">
                      {t.topicCount(chapter.topics.length)}
                      {chapter.description !== chapter.title &&
                        ` · ${chapter.description}`}
                    </p>
                  </div>
                </div>
                <ol className="grid gap-1">
                  {chapter.topics.map((topic, i) => (
                    <li key={topic.slug}>
                      <Link
                        href={topicHref(g.grade, chapter.slug, topic.slug)}
                        prefetch={false}
                        className="flex min-h-11 items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
                      >
                        <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-xs">
                          {i + 1}
                        </span>
                        <span className="font-medium">{topic.title}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
                {chapter.links.length > 0 && (
                  <details className="group rounded-md border border-border/70 px-3">
                    <summary className="flex min-h-11 cursor-pointer items-center font-medium text-sm">
                      {t.chapterLinks} ({chapter.links.length})
                    </summary>
                    <ul className="space-y-1 pb-3">
                      {chapter.links.map((link) => (
                        <li key={link.url}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-9 items-center gap-1.5 text-primary text-sm underline-offset-4 hover:underline"
                          >
                            {link.title}
                            <ExternalLink aria-hidden className="size-3.5" />
                            <span className="sr-only">{t.externalHint}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
