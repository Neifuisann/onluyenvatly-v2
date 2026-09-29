import type {
  MaterialCatalog,
  MaterialChapter,
  MaterialGrade,
  MaterialTopic,
} from "./types";

/** Pure helpers over the theory catalog (S8-02). */

export type TopicRef = {
  grade: MaterialGrade["grade"];
  chapter: MaterialChapter;
  topic: MaterialTopic;
  href: string;
};

export type TopicParams = { grade: string; chapter: string; slug: string };

export const topicHref = (grade: number, chapter: string, slug: string) =>
  `/ly-thuyet/${grade}/${chapter}/${slug}`;

export const gradeAnchor = (grade: number) => `lop-${grade}`;

/** Every topic in reading order: grade, then chapter, then topic. */
export function allTopics(catalog: MaterialCatalog): TopicRef[] {
  return catalog.flatMap((g) =>
    g.chapters.flatMap((chapter) =>
      chapter.topics.map((topic) => ({
        grade: g.grade,
        chapter,
        topic,
        href: topicHref(g.grade, chapter.slug, topic.slug),
      })),
    ),
  );
}

export function topicParams(catalog: MaterialCatalog): TopicParams[] {
  return allTopics(catalog).map((r) => ({
    grade: String(r.grade),
    chapter: r.chapter.slug,
    slug: r.topic.slug,
  }));
}

/** One topic with its neighbours inside the same chapter, or null. */
export function findTopic(
  catalog: MaterialCatalog,
  params: TopicParams,
): (TopicRef & { previous: TopicRef | null; next: TopicRef | null }) | null {
  const siblings = allTopics(catalog).filter(
    (r) =>
      String(r.grade) === params.grade && r.chapter.slug === params.chapter,
  );
  const i = siblings.findIndex((r) => r.topic.slug === params.slug);
  const hit = siblings[i];
  if (!hit) return null;
  return {
    ...hit,
    previous: siblings[i - 1] ?? null,
    next: siblings[i + 1] ?? null,
  };
}

/** Lowercase without Vietnamese accents, so "dao dong" finds "Dao động". */
export function foldVietnamese(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Topics whose title, chapter or subtopics contain every word of the query,
 * accents ignored; titles containing the whole query come first. An empty
 * query matches nothing (the full list shows).
 */
export function searchTopics(
  catalog: MaterialCatalog,
  query: string,
): TopicRef[] {
  const phrase = foldVietnamese(query);
  const words = phrase.split(" ").filter(Boolean);
  if (!words.length) return [];
  const hits = allTopics(catalog).filter((r) => {
    const haystack = foldVietnamese(
      [
        r.topic.title,
        r.chapter.title,
        `lop ${r.grade}`,
        ...r.topic.subtopics,
      ].join(" "),
    );
    return words.every((w) => haystack.includes(w));
  });
  const inTitle = (r: TopicRef) =>
    foldVietnamese(r.topic.title).includes(phrase) ? 0 : 1;
  return hits.sort((a, b) => inTitle(a) - inTitle(b));
}

/** v1 `/materials/grade10/…/file` URLs → their v2 page (S8-05). */
export function materialRedirects(
  catalog: MaterialCatalog,
): Array<{ source: string; destination: string }> {
  return allTopics(catalog).map((r) => ({
    source: `/materials/${r.topic.legacyPath}`,
    destination: r.href,
  }));
}
