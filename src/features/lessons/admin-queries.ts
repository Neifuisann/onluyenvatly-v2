import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { lessons, lessonVersions } from "@/db/schema";
import type { AdminListFilters } from "./domain/admin-list";
import { searchTerms } from "./domain/catalog";
import type { ComposeSource } from "./domain/compose";
import type { QuestionType } from "./schema";

/**
 * Admin reads (S5-01). Per request and uncached: only the teacher uses them,
 * and the list must show a change as soon as it is made.
 */

export type AdminLessonRow = {
  id: number;
  title: string;
  status: "draft" | "published" | "archived";
  grade: number | null;
  chapter: string | null;
  questionCount: number;
  attemptCount: number;
  hasDraft: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Every matching lesson not deleted, in the teacher's order (the page sorts
 * it again when another order is chosen, `sortAdminRows`). ~170 small rows:
 * the page slices them in memory (`paginate`), because reordering one page
 * sends the full id order back.
 */
export async function getAdminLessons(
  f: Pick<AdminListFilters, "q" | "status">,
): Promise<AdminLessonRow[]> {
  return db
    .select({
      id: lessons.id,
      title: lessons.title,
      status: lessons.status,
      grade: lessons.grade,
      chapter: lessons.chapter,
      questionCount: lessons.questionCount,
      attemptCount: lessons.attemptCount,
      hasDraft: sql<boolean>`${lessons.draftVersionId} is not null`,
      createdAt: lessons.createdAt,
      updatedAt: lessons.updatedAt,
    })
    .from(lessons)
    .where(
      and(
        isNull(lessons.deletedAt),
        f.status ? eq(lessons.status, f.status) : undefined,
        ...searchTerms(f.q).map(
          (w) =>
            sql`${lessons.searchText} ilike '%' || lower(immutable_unaccent(${w})) || '%'`,
        ),
      ),
    )
    .orderBy(asc(lessons.sortOrder), asc(lessons.id));
}

export type LessonForEditing = {
  id: number;
  title: string;
  description: string | null;
  grade: number | null;
  chapter: string | null;
  tags: string[];
  coverPath: string | null;
  status: "draft" | "published" | "archived";
  /** Raw jsonb; the editor validates it with `LessonConfigSchema`. */
  config: unknown;
  /** The draft's text, else the published one's, else empty. */
  sourceText: string;
  /** Their questions, so re-parsing keeps question ids stable (04 §3.1). */
  questions: unknown;
  hasDraft: boolean;
  hasPublished: boolean;
};

/**
 * Everything the editor opens with (S5-02). Includes answers: admin only,
 * never reachable from student pages.
 */
export async function getLessonForEditing(
  id: number,
): Promise<LessonForEditing | null> {
  const [row] = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      description: lessons.description,
      grade: lessons.grade,
      chapter: lessons.chapter,
      tags: lessons.tags,
      coverPath: lessons.coverPath,
      status: lessons.status,
      config: lessons.config,
      sourceText: lessonVersions.sourceText,
      questions: lessonVersions.questions,
      hasDraft: sql<boolean>`${lessons.draftVersionId} is not null`,
      hasPublished: sql<boolean>`${lessons.currentVersionId} is not null`,
    })
    .from(lessons)
    .leftJoin(
      lessonVersions,
      eq(
        lessonVersions.id,
        sql`coalesce(${lessons.draftVersionId}, ${lessons.currentVersionId})`,
      ),
    )
    .where(and(eq(lessons.id, id), isNull(lessons.deletedAt)))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    sourceText: row.sourceText ?? "",
    questions: row.questions ?? [],
  };
}

/** Questions of one type in a version's jsonb, counted by Postgres. */
const countType = (type: QuestionType) =>
  sql<number>`(select count(*)::int from jsonb_array_elements(case when jsonb_typeof(${lessonVersions.questions}) = 'array' then ${lessonVersions.questions} else '[]'::jsonb end) as q where q->>'type' = ${type})`;

/**
 * "Tạo từ bài có sẵn" (S5-07): every lesson with questions to draw from,
 * newest change first, with its questions per type in the version the draw
 * reads (published, else draft). Counts only: the questions stay in the
 * database until the teacher submits.
 */
export async function getComposeSources(): Promise<ComposeSource[]> {
  const rows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      status: lessons.status,
      grade: lessons.grade,
      mcq: countType("mcq"),
      tf: countType("tf"),
      short: countType("short"),
    })
    .from(lessons)
    .innerJoin(
      lessonVersions,
      eq(
        lessonVersions.id,
        sql`coalesce(${lessons.currentVersionId}, ${lessons.draftVersionId})`,
      ),
    )
    .where(isNull(lessons.deletedAt))
    .orderBy(desc(lessons.updatedAt), desc(lessons.id));
  return rows.filter((r) => r.mcq + r.tf + r.short > 0);
}
