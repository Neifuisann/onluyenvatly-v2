import "server-only";
import { and, asc, count, desc, eq, type SQL, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db/client";
import { lessons, lessonVersions } from "@/db/schema";
import { tags } from "@/lib/cache-tags";
import { type CatalogFilters, PAGE_SIZE, searchTerms } from "./domain/catalog";
import {
  type PublicQuestion,
  toPublicQuestion,
} from "./domain/public-question";
import type { TypeCounts } from "./domain/summary";
import type { LessonConfig, Question } from "./schema";

/** What a lesson card needs, and nothing else (no questions, no config). */
export type CatalogItem = {
  id: number;
  title: string;
  grade: number | null;
  chapter: string | null;
  tags: string[];
  coverPath: string | null;
  questionCount: number;
  typeCounts: Partial<TypeCounts>;
  timeLimitSec: number | null;
};

export type Catalog = { items: CatalogItem[]; total: number };

const cardColumns = {
  id: lessons.id,
  title: lessons.title,
  grade: lessons.grade,
  chapter: lessons.chapter,
  tags: lessons.tags,
  coverPath: lessons.coverPath,
  questionCount: lessons.questionCount,
  typeCounts: lessons.typeCounts,
  timeLimitSec: sql<number | null>`(${lessons.config}->>'timeLimitSec')::int`,
};

function catalogWhere(f: CatalogFilters): SQL | undefined {
  return and(
    eq(lessons.status, "published"),
    // Accent-insensitive, every word must match; served by the trigram index (S2-01).
    ...searchTerms(f.q).map(
      (w) =>
        sql`${lessons.searchText} ilike '%' || lower(immutable_unaccent(${w})) || '%'`,
    ),
    f.grade ? eq(lessons.grade, f.grade) : undefined,
    f.chapter ? eq(lessons.chapter, f.chapter) : undefined,
    f.tag ? sql`${lessons.tags} @> array[${f.tag}]::text[]` : undefined,
  );
}

const ORDER = {
  order: [asc(lessons.sortOrder), asc(lessons.id)],
  newest: [sql`${lessons.publishedAt} desc nulls last`, desc(lessons.id)],
  popular: [
    desc(lessons.attemptCount),
    asc(lessons.sortOrder),
    asc(lessons.id),
  ],
  // Accent-free key: Vietnamese-friendly order on any DB collation ("Điện" near "Dao").
  title: [sql`lower(immutable_unaccent(${lessons.title}))`, asc(lessons.id)],
} satisfies Record<CatalogFilters["sort"], SQL[]>;

/**
 * Published lessons for `/lessons`, shared by every student (tag `lessons`,
 * 05 §4). "Xem thêm" is cumulative: page n returns the first n × 24 cards.
 */
export async function getCatalog(f: CatalogFilters): Promise<Catalog> {
  "use cache";
  cacheTag(tags.lessons);
  cacheLife("hours");
  const where = catalogWhere(f);
  const [items, [total]] = await Promise.all([
    db
      .select(cardColumns)
      .from(lessons)
      .where(where)
      .orderBy(...ORDER[f.sort])
      .limit(f.page * PAGE_SIZE),
    db.select({ n: count() }).from(lessons).where(where),
  ]);
  return { items, total: total?.n ?? 0 };
}

export type CatalogFacets = { chapters: string[]; tags: string[] };

/** Chapter and tag choices for the filter sheet (published lessons only). */
export async function getCatalogFacets(): Promise<CatalogFacets> {
  "use cache";
  cacheTag(tags.lessons);
  cacheLife("hours");
  const published = eq(lessons.status, "published");
  const [chapters, tagRows] = await Promise.all([
    db
      .selectDistinct({ chapter: lessons.chapter })
      .from(lessons)
      .where(and(published, sql`${lessons.chapter} is not null`)),
    db
      .selectDistinct({ tag: sql<string>`unnest(${lessons.tags})` })
      .from(lessons)
      .where(published),
  ]);
  // Vietnamese order regardless of the database collation ("Điện" near "Dao").
  const vi = new Intl.Collator("vi").compare;
  return {
    chapters: chapters.flatMap((c) => (c.chapter ? [c.chapter] : [])).sort(vi),
    tags: tagRows.map((t) => t.tag).sort(vi),
  };
}

/** Overview projection: never read version content, source text or full config. */
export async function getLessonOverview(
  id: number,
  includeUnpublished = false,
) {
  "use cache";
  cacheTag(tags.lesson(id));
  cacheLife("hours");
  const [lesson] = await db
    .select({
      ...cardColumns,
      description: lessons.description,
      status: lessons.status,
      maxAttempts: sql<number | null>`(${lessons.config}->>'maxAttempts')::int`,
      examGuard: sql<boolean>`coalesce((${lessons.config}->>'examGuard')::boolean, false)`,
      countsForRating: sql<boolean>`coalesce((${lessons.config}->>'countsForRating')::boolean, false)`,
      revealAnswers: sql<
        LessonConfig["revealAnswers"]
      >`coalesce(${lessons.config}->>'revealAnswers', 'after_submit')`,
      startsAt: sql<string | null>`${lessons.config}->>'startsAt'`,
    })
    .from(lessons)
    .where(
      and(
        eq(lessons.id, id),
        includeUnpublished ? undefined : eq(lessons.status, "published"),
      ),
    )
    .limit(1);
  return lesson ?? null;
}

export type LessonOverview = NonNullable<
  Awaited<ReturnType<typeof getLessonOverview>>
>;

/**
 * A version's questions WITH ANSWERS (05 §4). Server-only: grading and item
 * building. Never pass the result to a client component; the runner gets
 * `toPublicQuestion` output only.
 */
export async function getLessonWithAnswers(
  lessonId: number,
  versionId: number,
): Promise<Question[] | null> {
  "use cache";
  cacheTag(tags.lessonAnswers(lessonId));
  cacheLife("hours");
  const [row] = await db
    .select({ questions: lessonVersions.questions })
    .from(lessonVersions)
    .where(
      and(
        eq(lessonVersions.id, versionId),
        eq(lessonVersions.lessonId, lessonId),
      ),
    )
    .limit(1);
  // Validated with `QuestionsSchema` when written (editor, migration).
  return row ? (row.questions as Question[]) : null;
}

/**
 * The answer-free taking view of a version (05 §4), in teacher order with
 * options unshuffled; the runner applies each attempt's option order.
 */
export async function getLessonForTaking(
  lessonId: number,
  versionId: number,
): Promise<PublicQuestion[] | null> {
  "use cache";
  cacheTag(tags.lessonPublic(lessonId));
  cacheLife("hours");
  const [row] = await db
    .select({ questions: lessonVersions.questions })
    .from(lessonVersions)
    .where(
      and(
        eq(lessonVersions.id, versionId),
        eq(lessonVersions.lessonId, lessonId),
      ),
    )
    .limit(1);
  return row
    ? (row.questions as Question[]).map((q) => toPublicQuestion(q))
    : null;
}

/** Both hits and misses invalidate when lessons are published or imported. */
export async function getLessonIdByLegacyId(
  legacyId: string,
  includeUnpublished = false,
) {
  "use cache";
  cacheTag(tags.lessons);
  cacheLife("hours");
  const [lesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(
      and(
        eq(lessons.legacyId, legacyId),
        includeUnpublished ? undefined : eq(lessons.status, "published"),
      ),
    )
    .limit(1);
  return lesson?.id ?? null;
}
